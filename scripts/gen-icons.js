const Jimp = require("jimp");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "images");

// Design tokens
const BG    = 0x0D0D0DFF; // deep dark background
const CARD  = 0x161616FF; // slightly lighter card bg
const FROST = 0x88C0D0FF; // Nord frost blue — accent
const WHITE = 0xFFFFFFFF;

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function fillCircle(img, cx, cy, r, color) {
  for (let py = cy - r; py <= cy + r; py++) {
    for (let px = cx - r; px <= cx + r; px++) {
      const dx = px - cx, dy = py - cy;
      if (dx * dx + dy * dy <= r * r) {
        if (px >= 0 && py >= 0 && px < img.bitmap.width && py < img.bitmap.height) {
          img.setPixelColor(color, px, py);
        }
      }
    }
  }
}

function fillRect(img, x, y, w, h, color) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (px >= 0 && py >= 0 && px < img.bitmap.width && py < img.bitmap.height) {
        img.setPixelColor(color, px, py);
      }
    }
  }
}

function fillRoundRect(img, x, y, w, h, r, color) {
  fillRect(img, x + r, y,         w - r * 2, h,         color);
  fillRect(img, x,     y + r,     r,          h - r * 2, color);
  fillRect(img, x + w - r, y + r, r,          h - r * 2, color);
  fillCircle(img, x + r,     y + r,     r, color);
  fillCircle(img, x + w - r, y + r,     r, color);
  fillCircle(img, x + r,     y + h - r, r, color);
  fillCircle(img, x + w - r, y + h - r, r, color);
}

function drawLine(img, x1, y1, x2, y2, thickness, color) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const cx = Math.round(x1 + dx * t);
    const cy = Math.round(y1 + dy * t);
    fillCircle(img, cx, cy, Math.round(thickness / 2), color);
  }
}

// ─── Icon design ──────────────────────────────────────────────────────────────
// Simple bold checkmark on dark background — clean and minimal.

async function makeIcon(size) {
  const img = new Jimp(size, size, BG);
  const s   = size;

  // Subtle card background
  const pad = Math.round(s * 0.08);
  const r   = Math.round(s * 0.20);
  fillRoundRect(img, pad, pad, s - pad * 2, s - pad * 2, r, CARD);

  // Checkmark — two line segments
  // Points designed so the whole mark fits within the Android adaptive safe zone (66% radius)
  const T  = Math.round(s * 0.065); // stroke thickness
  const p1 = [Math.round(s * 0.235), Math.round(s * 0.498)]; // left
  const pm = [Math.round(s * 0.405), Math.round(s * 0.695)]; // bend
  const p2 = [Math.round(s * 0.752), Math.round(s * 0.303)]; // right

  drawLine(img, p1[0], p1[1], pm[0], pm[1], T, FROST);
  drawLine(img, pm[0], pm[1], p2[0], p2[1], T, FROST);

  return img;
}

async function main() {
  console.log("Generating icons…");

  const icon = await makeIcon(1024);
  await icon.writeAsync(path.join(OUT, "icon.png"));
  console.log("✓ icon.png");

  const adaptive = await makeIcon(1024);
  await adaptive.writeAsync(path.join(OUT, "adaptive-icon.png"));
  console.log("✓ adaptive-icon.png");

  const splash = await makeIcon(512);
  await splash.writeAsync(path.join(OUT, "splash-icon.png"));
  console.log("✓ splash-icon.png");

  // Favicon — tiny, just the checkmark
  const favicon = await makeIcon(48);
  await favicon.writeAsync(path.join(OUT, "favicon.png"));
  console.log("✓ favicon.png");

  // Notification icon — white checkmark on transparent bg
  const notif = new Jimp(96, 96, 0x00000000);
  fillRoundRect(notif, 8, 8, 80, 80, 14, WHITE);
  drawLine(notif, 22, 48, 38, 65, 10, BG);
  drawLine(notif, 38, 65, 74, 29, 10, BG);
  await notif.writeAsync(path.join(OUT, "notification-icon.png"));
  console.log("✓ notification-icon.png");

  console.log("\nAll icons written to assets/images/");
}

main().catch(console.error);
