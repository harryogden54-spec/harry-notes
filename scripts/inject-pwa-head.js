// Inject PWA / iOS home-screen <head> tags into the exported dist/index.html.
//
// Why this exists: app.json uses web.output:"single", and in single (SPA) mode
// Expo Router IGNORES app/+html.tsx — so the apple-touch-icon link, web manifest,
// and apple-mobile-web-app meta never reach the shipped HTML. Without an explicit
// apple-touch-icon, iOS "Add to Home Screen" falls back to a generic icon.
//
// This runs after `expo export`, in the deploy pipeline.
const fs = require("fs");
const path = require("path");

const INDEX = path.join(__dirname, "..", "dist", "index.html");

const TAGS = `    <link rel="icon" type="image/png" href="/icon-192.png?v=2" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
    <link rel="manifest" href="/manifest.json?v=2" />
    <meta name="theme-color" content="#0D0D0D" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="harry notes" />
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

// ── PWA tags ────────────────────────────────────────────────────────────────
if (html.includes('rel="apple-touch-icon"') && html.includes('rel="icon"')) {
  console.log("inject-pwa-head: PWA tags already present — skipping.");
} else if (!html.includes("</head>")) {
  console.error("inject-pwa-head: no </head> found in dist/index.html");
  process.exit(1);
} else {
  html = html.replace("</head>", TAGS + "  </head>");
  changed = true;
}

if (changed) {
  fs.writeFileSync(INDEX, html);
  console.log("✓ inject-pwa-head: updated dist/index.html (viewport + PWA tags)");
}
