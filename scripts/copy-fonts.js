/**
 * Post-export font copy script.
 *
 * On web, fonts are declared via CSS @font-face in global.css pointing at
 * /assets/fonts/. Expo does not emit font TTFs during web export (since useFonts
 * is skipped on web). This script copies the fonts directly from node_modules
 * to dist/assets/fonts/ before wrangler runs.
 *
 * Uses require.resolve so it works in both the main repo and git worktrees
 * (which share the parent's node_modules).
 */

const fs   = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "dist", "assets", "fonts");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function resolveFont(pkg) {
  try {
    return require.resolve(pkg);
  } catch {
    return null;
  }
}

const FONTS = [
  { pkg: "@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf", dest: "Inter_400Regular.ttf" },
  { pkg: "@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf",   dest: "Inter_500Medium.ttf" },
  { pkg: "@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf", dest: "Inter_600SemiBold.ttf" },
  { pkg: "@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf",       dest: "Inter_700Bold.ttf" },
  { pkg: "@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf", dest: "Ionicons.ttf" },
];

for (const { pkg, dest } of FONTS) {
  const srcPath = resolveFont(pkg);
  if (!srcPath || !fs.existsSync(srcPath)) {
    console.error(`✗ Could not resolve: ${pkg}`);
    process.exit(1);
  }
  fs.copyFileSync(srcPath, path.join(OUT, dest));
  console.log(`✓ ${dest}`);
}

console.log(`\nFonts copied to dist/assets/fonts/`);
