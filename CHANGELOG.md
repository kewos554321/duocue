# Changelog

## v0.1.1 — 2026-06-04

### New Features
- Background opacity slider: adjust subtitle overlay transparency from the popup
- Auto platform detection: popup shows detected platform name when in auto mode
- Platform warning: displays an alert and disables controls when on an unsupported site

### Files changed
- `popup.html` — platform warning banner CSS + HTML
- `popup.js` — opacity slider wiring, auto mode display, platform warning logic
- `content.js` — reads bgOpacity from chrome.storage and applies to overlay
- `platforms.js` — auto detection helper
- `manifest.json` — version bump 0.1.0 → 0.1.1

### Release artifact
`duocue-v0.1.1.zip`

---

## v0.1.0 — 2026-06-02

Initial release on Chrome Web Store.

### Features
- Bilingual subtitle overlay on HBO Max (Max)
- Font size, font family, bold styling controls
- Google Translate integration (user-supplied API key)
- Subtitle transcript export as .txt
- Auto / manual platform detection

### Release artifact
`duocue-v0.1.0.zip`
