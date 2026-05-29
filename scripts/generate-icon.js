/**
 * Generates app icon assets with a dark→indigo gradient background and a white star.
 * Run: node scripts/generate-icon.js
 */
const sharp = require("sharp");
const path  = require("path");
const fs    = require("fs");

const OUT = path.join(__dirname, "../assets/images");
const PUB = path.join(__dirname, "../public");

// Five-pointed star SVG path centred at (512,512), radius 380
function starPath(cx, cy, r, size) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return `M${pts.join("L")}Z`;
}

function makeSVG(size) {
  const half = size / 2;
  const starR = size * 0.37;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D0D0D"/>
      <stop offset="100%" stop-color="#5B6AD0"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" rx="${size * 0.22}" ry="${size * 0.22}"/>
  <path d="${starPath(half, half, starR, size)}" fill="white"/>
</svg>`;
}

async function generate(svg, outPath, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ ${path.basename(outPath)} (${size}×${size})`);
}

async function main() {
  await generate(makeSVG(1024), path.join(OUT, "icon.png"),          1024);
  await generate(makeSVG(1024), path.join(OUT, "adaptive-icon.png"), 1024);
  await generate(makeSVG(512),  path.join(OUT, "splash-icon.png"),   512);
  await generate(makeSVG(196),  path.join(OUT, "favicon.png"),       196);

  // PWA / iOS home-screen icons. These live in public/ and are copied to the
  // web root at build time. iOS "Add to Home Screen" uses apple-touch-icon.png;
  // the icon-NNN.png files are referenced by public/manifest.json.
  await generate(makeSVG(180),  path.join(PUB, "apple-touch-icon.png"), 180);
  await generate(makeSVG(192),  path.join(PUB, "icon-192.png"),         192);
  await generate(makeSVG(512),  path.join(PUB, "icon-512.png"),         512);
  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
