# Android & React Native

Custom elements need a DOM, and React Native's native views don't have one. On mobile you run
`<tour-guide>` inside a **WebView**, which every modern Android System WebView (Chromium 67+)
and iOS WKWebView supports. Use the single-file IIFE build, `dist/browser/tour-guide.iife.js`. It
registers the element and exposes `window.TourGuide`.

> If your React Native screen is native (not a WebView), use a native tour library for that screen.
> `@xkid1/tour-guide` covers the web parts of your app: WebView screens, React Native Web, and
> Expo web.

## React Native (react-native-webview)

```bash
yarn add react-native-webview
```

```tsx
import { useRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Bundle the IIFE file as an asset or load it from a CDN you control:
const TOUR_SCRIPT =
  'https://cdn.jsdelivr.net/npm/@xkid1/tour-guide/dist/browser/tour-guide.iife.js';

const html = /* html */ `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <script src="${TOUR_SCRIPT}"></script>
  </head>
  <body>
    <button id="profile">Profile</button>
    <tour-guide id="tour"></tour-guide>
    <script>
      const tour = document.getElementById('tour');
      tour.steps = [
        { target: '#profile', title: 'Your profile', content: 'Manage your account here.' },
        { title: 'All set', content: 'Enjoy the app!' },
      ];
      // Forward tour events to React Native
      ['tour-step-change', 'tour-end'].forEach((type) =>
        tour.addEventListener(type, (e) =>
          window.ReactNativeWebView.postMessage(JSON.stringify({ type, index: e.detail.index, reason: e.detail.reason })),
        ),
      );
      // Receive commands from React Native
      window.addEventListener('message', (e) => {
        const { command, index } = JSON.parse(e.data);
        if (typeof tour[command] === 'function') tour[command](index);
      });
    </script>
  </body>
</html>`;

export function TourScreen() {
  const webview = useRef<WebView>(null);
  const send = (command: 'start' | 'next' | 'back' | 'close', index?: number) =>
    webview.current?.postMessage(JSON.stringify({ command, index }));

  return (
    <WebView
      ref={webview}
      originWhitelist={['*']}
      source={{ html }}
      onLoadEnd={() => send('start')}
      onMessage={(event: WebViewMessageEvent) =>
        console.log('tour event', JSON.parse(event.nativeEvent.data))
      }
    />
  );
}
```

## Native Android WebView (Kotlin)

Copy `dist/browser/tour-guide.iife.js` to `app/src/main/assets/`, then:

```kotlin
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true
webView.addJavascriptInterface(object {
    @JavascriptInterface fun onTourEvent(json: String) { Log.d("Tour", json) }
}, "AndroidTour")
webView.loadUrl("file:///android_asset/index.html") // index.html includes <script src="tour-guide.iife.js">

// Drive the tour from Kotlin:
webView.evaluateJavascript("document.querySelector('tour-guide').start()", null)
```

Inside the page:

```js
tour.addEventListener('tour-end', (e) => window.AndroidTour?.onTourEvent(JSON.stringify(e.detail)));
```

## Tips for mobile

- Below `mobileBreakpoint` (default `640px`) the popover becomes a bottom sheet with 44px touch
  targets and `env(safe-area-inset-bottom)` padding.
- Add `viewport-fit=cover` to the viewport meta tag so the safe-area padding works on notched devices.
- Use `scrollBehavior: 'auto'` on low-end devices if smooth scrolling feels slow.
