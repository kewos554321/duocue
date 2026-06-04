# DuoCue PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that captures subtitles from play.hbomax.com and displays them in a fixed overlay on the page.

**Architecture:** A single `content.js` is injected into `play.hbomax.com`. It polls for the subtitle container to appear, then attaches a `MutationObserver` to watch for text changes. On each change it reads the subtitle text and updates a fixed `#duocue-overlay` div appended to `document.body`. Platform configs (selectors) are inlined as a `PLATFORMS` array — adding a new platform means adding one object to that array.

**Tech Stack:** Vanilla JS (no bundler), Chrome Extension Manifest V3, CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `manifest.json` | Create | MV3 config: inject content.js + styles.css into play.hbomax.com |
| `content.js` | Create | Platform detection, poll, MutationObserver, overlay update |
| `styles.css` | Create | Overlay positioning and appearance |

---

### Task 1: manifest.json

**Files:**
- Create: `manifest.json`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "DuoCue",
  "version": "0.1.0",
  "description": "Bilingual subtitles for streaming platforms",
  "content_scripts": [
    {
      "matches": ["*://play.hbomax.com/*"],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
cd /Users/kewos/Documents/projects/duocue
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('valid')"
```

Expected output: `valid`

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add manifest.json for MV3 Chrome extension"
```

---

### Task 2: styles.css — overlay appearance

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Create styles.css**

```css
#duocue-overlay {
  position: fixed;
  bottom: 12%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  font-size: 1.4rem;
  font-family: Arial, sans-serif;
  padding: 6px 16px;
  border-radius: 4px;
  max-width: 80vw;
  text-align: center;
  pointer-events: none;
  white-space: pre-wrap;
  display: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "feat: add overlay styles for subtitle display"
```

---

### Task 3: content.js — platform config + detectPlatform

**Files:**
- Create: `content.js`

- [ ] **Step 1: Write platform config and detectPlatform**

Create `content.js` with the following content (this is the complete file for this step — subsequent steps append to it):

```js
const PLATFORMS = [
  {
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    containerSelector: '[class*="CaptionWindow-Fuse-Web-Play"]',
    textSelector: '[class*="TextCue-Fuse-Web-Play"]',
  },
]

function detectPlatform() {
  return PLATFORMS.find(p => location.hostname === p.hostname) ?? null
}
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./content.js'); console.log('syntax ok')" 2>&1 || node --input-type=module < content.js 2>&1; echo "check above for errors"
```

> Note: `node` will warn about browser globals (`location`) not existing — that's expected. Look only for syntax errors.

- [ ] **Step 3: Commit**

```bash
git add content.js
git commit -m "feat: add platform config and detectPlatform"
```

---

### Task 4: content.js — overlay creation

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Append createOverlay function to content.js**

Add this to the **bottom** of `content.js`:

```js
function createOverlay() {
  if (document.getElementById('duocue-overlay')) return
  const div = document.createElement('div')
  div.id = 'duocue-overlay'
  document.body.appendChild(div)
}

function updateOverlay(text) {
  const overlay = document.getElementById('duocue-overlay')
  if (!overlay) return
  if (text) {
    overlay.textContent = text
    overlay.style.display = 'block'
  } else {
    overlay.textContent = ''
    overlay.style.display = 'none'
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add content.js
git commit -m "feat: add overlay create and update helpers"
```

---

### Task 5: content.js — MutationObserver + poll

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Append pollForContainer and startObserver to content.js**

Add this to the **bottom** of `content.js`:

```js
function extractText(platform) {
  const nodes = document.querySelectorAll(platform.textSelector)
  return Array.from(nodes)
    .map(n => n.textContent.trim())
    .filter(Boolean)
    .join('\n')
}

function startObserver(platform) {
  const container = document.querySelector(platform.containerSelector)
  if (!container) return

  createOverlay()

  const observer = new MutationObserver(() => {
    const text = extractText(platform)
    console.log(`[DuoCue] ${text || '(no subtitle)'}`)
    updateOverlay(text)
  })

  observer.observe(container, { childList: true, subtree: true })
  console.log(`[DuoCue] Observing ${platform.name} subtitle container`)
}

function pollForContainer(platform, intervalMs = 500, timeoutMs = 30000) {
  const start = Date.now()
  const timer = setInterval(() => {
    if (document.querySelector(platform.containerSelector)) {
      clearInterval(timer)
      startObserver(platform)
      return
    }
    if (Date.now() - start > timeoutMs) {
      clearInterval(timer)
      console.warn('[DuoCue] Subtitle container not found after 30s — giving up')
    }
  }, intervalMs)
}
```

- [ ] **Step 2: Append entry point to content.js**

Add this as the very last line of `content.js`:

```js
const platform = detectPlatform()
if (platform) pollForContainer(platform)
```

- [ ] **Step 3: Commit**

```bash
git add content.js
git commit -m "feat: add MutationObserver, poll, and entry point"
```

---

### Task 6: Load extension in Chrome and verify

**Files:** none (manual verification)

- [ ] **Step 1: Open Chrome extension management**

Navigate to `chrome://extensions` in Chrome.

- [ ] **Step 2: Enable Developer Mode**

Toggle "Developer mode" switch in the top-right corner of the extensions page.

- [ ] **Step 3: Load unpacked extension**

Click "Load unpacked" → select `/Users/kewos/Documents/projects/duocue`

Verify: "DuoCue" appears in the extension list with no error badge.

- [ ] **Step 4: Open HBO Max and play a video**

Navigate to `https://play.hbomax.com`, open any episode/movie, and start playback. Make sure subtitles are enabled in the HBO player settings.

- [ ] **Step 5: Verify overlay appears**

Open DevTools (F12 → Console). You should see:

```
[DuoCue] Observing HBO Max subtitle container
[DuoCue] Timo, I'm down here.
[DuoCue] (no subtitle)
[DuoCue] What are you doing?
```

On screen: a semi-transparent black bar near the bottom of the player should display the current subtitle text and clear when the subtitle disappears.

- [ ] **Step 6: If overlay does not appear — debug checklist**

Check the following in order:

1. In DevTools Console, run:
   ```js
   document.querySelector('[class*="CaptionWindow-Fuse-Web-Play"]')
   ```
   If this returns `null`, the selector has changed. Use the scan script from the brainstorming session to find the new selector, then update `PLATFORMS[0].containerSelector` in `content.js`.

2. Check for extension errors: go to `chrome://extensions` → click "Errors" on the DuoCue card.

3. Reload the extension (click the refresh icon on the DuoCue card), then reload the HBO Max tab.

- [ ] **Step 7: Commit verification result**

```bash
cd /Users/kewos/Documents/projects/duocue
git commit --allow-empty -m "chore: PoC manually verified on play.hbomax.com"
```

---

## Done

After Task 6 passes, the PoC is complete. The verified capabilities are:

- [x] Chrome MV3 extension loads on `play.hbomax.com`
- [x] Subtitle container found via polling
- [x] MutationObserver fires on subtitle change
- [x] Overlay displays subtitle text in sync with video
- [x] Overlay clears when subtitle disappears

Next steps (outside this plan): connect a translation API to add Chinese subtitles below the English line.
