// Inject PWA / iOS home-screen <head> tags into the exported dist/index.html.
//
// Why this exists: app.json uses web.output:"single", and in single (SPA) mode
// Expo Router IGNORES app/+html.tsx — so the apple-touch-icon link, web manifest,
// and apple-mobile-web-app meta never reach the shipped HTML. Without an explicit
// apple-touch-icon, iOS "Add to Home Screen" falls back to a generic icon.
//
// The service-worker registration is here for the same reason, and it is the
// ONLY place it exists. It used to live in app/+html.tsx, which stopped shipping
// when web.output became "single" — so public/sw.js was exported to dist/ on
// every deploy and never once registered. The app had no offline support at all
// between then and 2026-08-28, despite a complete and working sw.js sitting in
// the bundle. If you move this, move it somewhere that actually reaches
// dist/index.html, and verify with: grep serviceWorker dist/index.html
//
// This runs after `expo export`, in the deploy pipeline.
const fs = require("fs");
const path = require("path");

const INDEX = path.join(__dirname, "..", "dist", "index.html");

const PWA_TAGS = `    <link rel="icon" type="image/png" href="/icon-192.png?v=2" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
    <link rel="manifest" href="/manifest.json?v=2" />
    <meta name="theme-color" content="#0D0D0D" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="harry notes" />
`;

const SW_TAG = `    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function (err) {
            console.warn('[sw] registration failed', err);
          });
        });
      }
    </script>
`;

// Keep in sync with VIEWPORT_CONTENT in lib/webViewport.ts.
// maximum-scale=1 stops iOS Safari auto-zooming on input focus (font-size
// <16px); pinch-zoom still works — iOS ignores maximum-scale for gestures.
const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover";

let html = fs.readFileSync(INDEX, "utf8");
let changed = false;

// ── Viewport (iOS input-focus zoom fix) ─────────────────────────────────────
const viewportTag = `<meta name="viewport" content="${VIEWPORT_CONTENT}" />`;
if (/<meta name="viewport"[^>]*>/.test(html)) {
  const updated = html.replace(/<meta name="viewport"[^>]*>/, viewportTag);
  if (updated !== html) { html = updated; changed = true; }
} else if (html.includes("</head>")) {
  html = html.replace("</head>", `    ${viewportTag}\n  </head>`);
  changed = true;
}

// ── PWA tags and the service worker, injected independently ─────────────────
//
// Two guarded injections rather than one block. They were a single block until
// the SW script was added to it: on a dist/ that already carried the PWA tags
// but no script, the combined guard failed and the WHOLE block went in again,
// duplicating every link and meta tag. `expo export --clear` rewrites
// index.html so the deploy pipeline never actually hit that, but a script that
// can corrupt its own output given a plausible input is a bug either way.
if (!html.includes("</head>")) {
  console.error("inject-pwa-head: no </head> found in dist/index.html");
  process.exit(1);
}

const injections = [
  { name: "PWA tags", have: () => html.includes('rel="apple-touch-icon"'), tag: PWA_TAGS },
  { name: "service worker", have: () => html.includes("serviceWorker"), tag: SW_TAG },
];

const added = [];
for (const { name, have, tag } of injections) {
  if (have()) continue;
  html = html.replace("</head>", tag + "  </head>");
  added.push(name);
  changed = true;
}

if (changed) {
  fs.writeFileSync(INDEX, html);
  const what = added.length ? added.join(" + ") : "viewport";
  console.log(`✓ inject-pwa-head: updated dist/index.html (${what})`);
} else {
  console.log("inject-pwa-head: nothing to do — already up to date.");
}
