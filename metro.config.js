const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");
// Disable ESM package exports resolution — Metro picks up the "import" condition
// which points to .mjs files that don't ship. Falls back to "main" (CJS) instead.
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: "./global.css" });
