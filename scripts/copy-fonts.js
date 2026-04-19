/**
 * Post-export font copy script.
 *
 * Wrangler pages deploy silently excludes `node_modules` directories,
 * so font TTFs in dist/assets/node_modules/... are never uploaded.
 * This script copies the fonts we actually use to dist/assets/fonts/
 * before wrangler runs.
 */

const fs   = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const OUT  = path.join(DIST, "assets", "fonts");

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const FONTS = [
  {
    src: "assets/node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.51b6ad87261f18b6433ec52871ddfabc.ttf",
    dest: "Inter_400Regular.ttf",
  },
  {
    src: "assets/node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.137ab18bace28dd0bd83eb3b8ed2bc54.ttf",
    dest: "Inter_500Medium.ttf",
  },
  {
    src: "assets/node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.a5f35888d2da465de352e0dcfaf33324.ttf",
    dest: "Inter_600SemiBold.ttf",
  },
  {
    src: "assets/node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.6e237de4f1f413afa2fcc45c77ac343a.ttf",
    dest: "Inter_700Bold.ttf",
  },
  {
    src: "assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf",
    dest: "Ionicons.ttf",
  },
];

for (const { src, dest } of FONTS) {
  const srcPath  = path.join(DIST, src);
  const destPath = path.join(OUT, dest);
  if (!fs.existsSync(srcPath)) {
    console.error(`✗ Missing: ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(srcPath, destPath);
  console.log(`✓ ${dest}`);
}

console.log(`\nFonts copied to dist/assets/fonts/`);
