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

// Strict app-style viewport. Expo's template ships without maximum-scale, so
// iOS Safari auto-zooms whenever an input with font-size < 16px is focused and
// leaves the page zoomed in. maximum-scale=1 disables that focus auto-zoom
// (iOS still allows pinch-zoom in the browser tab; installed PWAs behave like
// native apps, which is what we want here).
const VIEWPORT =
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />';

let html = fs.readFileSync(INDEX, "utf8");

const withViewport = html.replace(/<meta name="viewport"[^>]*\/?>/, VIEWPORT);
if (withViewport !== html) {
  html = withViewport;
  fs.writeFileSync(INDEX, html);
  console.log("✓ inject-pwa-head: normalized viewport meta (maximum-scale=1)");
} else if (!html.includes('name="viewport"')) {
  console.error("inject-pwa-head: no viewport meta found in dist/index.html");
  process.exit(1);
}

if (html.includes('rel="apple-touch-icon"') && html.includes('rel="icon"')) {
  console.log("inject-pwa-head: PWA tags already present — skipping.");
} else if (!html.includes("</head>")) {
  console.error("inject-pwa-head: no </head> found in dist/index.html");
  process.exit(1);
} else {
  html = html.replace("</head>", TAGS + "  </head>");
  fs.writeFileSync(INDEX, html);
  console.log("✓ inject-pwa-head: injected apple-touch-icon + manifest into dist/index.html");
}
