import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover fills the notch/dynamic island area */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        <title>harry notes</title>

        {/* PWA manifest + theme */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0D0D0D" />
        <meta name="application-name" content="harry notes" />

        {/* iOS standalone PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="harry notes" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />

        {/* Favicon */}
        <link rel="icon" type="image/png" href="/assets/images/favicon.png" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: bodyStyle }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const bodyStyle = `
body {
  background-color: #0D0D0D;
  overflow: hidden;
}`;

const swScript = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js');
  });
}`;
