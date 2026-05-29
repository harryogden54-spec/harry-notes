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

const TAGS = `    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0D0D0D" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="harry notes" />
`;

let html = fs.readFileSync(INDEX, "utf8");

if (html.includes('rel="apple-touch-icon"')) {
  console.log("inject-pwa-head: tags already present — skipping.");
} else if (!html.includes("</head>")) {
  console.error("inject-pwa-head: no </head> found in dist/index.html");
  process.exit(1);
} else {
  html = html.replace("</head>", TAGS + "  </head>");
  fs.writeFileSync(INDEX, html);
  console.log("✓ inject-pwa-head: injected apple-touch-icon + manifest into dist/index.html");
}
