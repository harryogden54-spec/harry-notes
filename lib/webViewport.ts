import { Platform } from "react-native";

/**
 * iOS Safari auto-zooms the page when focusing an input whose font-size is
 * under 16px (most of ours are 13–15px), and the layout is often left zoomed
 * or offset afterwards. Capping maximum-scale=1 disables that focus auto-zoom.
 * Accessibility is preserved: since iOS 10, Safari ignores maximum-scale for
 * user pinch gestures, so manual zoom still works.
 *
 * scripts/inject-pwa-head.js applies the same content to the exported
 * dist/index.html so the deployed PWA is covered before the JS bundle runs;
 * this runtime hook covers the Metro dev server (and is a belt-and-braces for
 * prod). Keep VIEWPORT_CONTENT in sync with that script.
 */
export const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover";

export function applyMobileViewport(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", VIEWPORT_CONTENT);
  installKeyboardScrollRestore();
}

/**
 * iOS Safari scrolls the (fixed-height, overflow:hidden) page to keep a
 * focused input visible above the keyboard, and often leaves that scroll
 * offset behind after the keyboard closes — the whole app sits shifted up
 * with a bar of raw body background exposed at the bottom. Snap the window
 * scroll back to 0 whenever an input loses focus or the visual viewport
 * grows back (keyboard dismissed).
 */
function installKeyboardScrollRestore(): void {
  if (typeof window === "undefined") return;
  const restore = () => {
    if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
      window.scrollTo(0, 0);
    }
  };
  window.addEventListener("focusout", () => { setTimeout(restore, 60); });
  const vv = window.visualViewport;
  if (vv) {
    let lastHeight = vv.height;
    vv.addEventListener("resize", () => {
      if (vv.height > lastHeight) setTimeout(restore, 60);
      lastHeight = vv.height;
    });
  }
}
