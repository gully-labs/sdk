# swoop-webview

Reference samples for showing a **Swoop Ads** unit inside a phone app or a game with a web view. Not published to npm.

| File | What | Tested here |
|---|---|---|
| `unit.html` | The page every platform loads: asks for the hosted tag and passes height and state to the app | Yes (jsdom, three bridge styles) |
| `ios/SwoopAdView.swift` | UIKit view around `WKWebView` | **No** (no Swift toolchain) |
| `android/SwoopAdView.kt` | `WebView` subclass | **No** (no Kotlin or Android toolchain) |
| `unity/SwoopAdView.cs` | Unity script for the open-source `gree/unity-webview` plugin | **No** (no Unity) |

How it works: the app fills `{{SPOT}}`, `{{UNIT}}`, `{{THEME}}` and `{{SLOT}}` in `unit.html`, loads it with a base address that is
listed on the Spot, and listens for `height` (0 means collapse) and `state` (`filled`, `viewed`, `empty`). No cookies or storage.
Guide: https://docs.swoopads.xyz/mobile/
