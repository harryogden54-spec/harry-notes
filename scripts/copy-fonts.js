/**
 * Post-export font copy script.
 *
 * On web, useFonts({}) is a no-op, so Expo never exports font TTFs into
 * dist/assets/___node_modules. We copy them directly from node_modules.
 * Wrangler also silently excludes node_modules from uploads, so this
 * ensures fonts land at /assets/fonts/ on Cloudflare Pages.
 */

const fs   = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const OUT  = path.join(DIST, "assets", "fonts");

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Walk up from __dirname to find the node_modules that has our fonts.
function findNodeModules(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "node_modules");
    if (fs.existsSync(path.join(candidate, "@expo-google-fonts", "inter"))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const NM = findNodeModules(__dirname);
if (!NM) {
  console.error("✗ Could not find node_modules with @expo-google-fonts/inter");
  process.exit(1);
}

const FONTS = [
  {
    src:  path.join(NM, "@expo-google-fonts", "inter", "400Regular", "Inter_400Regular.ttf"),
    dest: "Inter_400Regular.ttf",
  },
  {
    src:  path.join(NM, "@expo-google-fonts", "inter", "500Medium", "Inter_500Medium.ttf"),
    dest: "Inter_500Medium.ttf",
  },
  {
    src:  path.join(NM, "@expo-google-fonts", "inter", "600SemiBold", "Inter_600SemiBold.ttf"),
    dest: "Inter_600SemiBold.ttf",
  },
  {
    src:  path.join(NM, "@expo-google-fonts", "inter", "700Bold", "Inter_700Bold.ttf"),
    dest: "Inter_700Bold.ttf",
  },
  {
    src:  path.join(NM, "@expo", "vector-icons", "build", "vendor", "react-native-vector-icons", "Fonts", "Ionicons.ttf"),
    dest: "Ionicons.ttf",
  },
];

for (const { src, dest } of FONTS) {
  const destPath = path.join(OUT, dest);
  if (!fs.existsSync(src)) {
    console.error(`✗ Missing: ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, destPath);
  console.log(`✓ ${dest}`);
}

console.log(`\nFonts copied to dist/assets/fonts/`);
