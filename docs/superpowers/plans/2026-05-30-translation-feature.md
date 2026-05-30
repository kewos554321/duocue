# Translation Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bilingual subtitle display to DuoCue — English original on top, Traditional Chinese translation below — powered by Google Cloud Translation API with the API key managed via an Extension popup.

**Architecture:** `content.js` fetches translation from Google Cloud Translation API directly (with `host_permissions` declared in manifest), storing the result in the overlay as two `<div>` children. A 150ms debounce prevents API spam during fast dialogue. The API key is entered via `popup.html`, saved to `chrome.storage.local`, and read by `content.js` at translation time. If no key is set or the API call fails, only English is shown.

**Tech Stack:** Vanilla JS, Chrome Extension MV3, Google Cloud Translation API v2, chrome.storage.local

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `manifest.json` | Modify | Add `storage` permission, `host_permissions` for translation API, `action` for popup |
| `styles.css` | Modify | Add `.duocue-en` and `.duocue-zh` child styles |
| `popup.html` | Create | API key input UI |
| `popup.js` | Create | Read/write API key to chrome.storage.local |
| `content.js` | Modify | Refactor `updateOverlay`, add `translate()`, add debounce in observer |

---

### Task 1: Update manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Replace manifest.json with this content**

```json
{
  "manifest_version": 3,
  "name": "DuoCue",
  "version": "0.1.0",
  "description": "Bilingual subtitles for streaming platforms",
  "permissions": ["storage"],
  "host_permissions": ["https://translation.googleapis.com/*"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "DuoCue Settings"
  },
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

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add storage permission, host_permissions, and popup action to manifest"
```

---

### Task 2: Update styles.css — bilingual child styles

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Append these rules to the bottom of styles.css**

```css

.duocue-en {
  color: #ffffff;
  font-size: 1.4rem;
}

.duocue-zh {
  color: #FFD700;
  font-size: 1.2rem;
  margin-top: 4px;
}
```

The existing `#duocue-overlay` rule stays unchanged. `.duocue-en` and `.duocue-zh` will be applied to child `<div>` elements injected by `updateOverlay`.

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "feat: add bilingual child styles for overlay"
```

---

### Task 3: Create popup.html

**Files:**
- Create: `popup.html`

- [ ] **Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { width: 280px; padding: 16px; font-family: Arial, sans-serif; }
    input { width: 100%; box-sizing: border-box; padding: 6px; margin: 8px 0; }
    button { width: 100%; padding: 8px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer; }
    #status { margin-top: 8px; font-size: 0.85rem; color: green; }
  </style>
</head>
<body>
  <h3 style="margin:0 0 8px">DuoCue</h3>
  <label>Google Translation API Key</label>
  <input type="password" id="apiKey" placeholder="AIza...">
  <button id="save">Save Key</button>
  <div id="status"></div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add popup.html
git commit -m "feat: add popup HTML for API key management"
```

---

### Task 4: Create popup.js

**Files:**
- Create: `popup.js`

- [ ] **Step 1: Create popup.js**

```js
const input = document.getElementById('apiKey')
const status = document.getElementById('status')

chrome.storage.local.get('translationApiKey', ({ translationApiKey }) => {
  if (translationApiKey) input.value = translationApiKey
})

document.getElementById('save').addEventListener('click', () => {
  const key = input.value.trim()
  chrome.storage.local.set({ translationApiKey: key }, () => {
    status.textContent = key ? '✅ Key saved' : '🗑 Key cleared'
    setTimeout(() => { status.textContent = '' }, 2000)
  })
})
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./popup.js')" 2>&1 || true
```

Expected: An error about `chrome` not being defined — that's correct (it's a browser API). The important thing is **no syntax errors**. A `SyntaxError` would appear before the `chrome` error.

- [ ] **Step 3: Commit**

```bash
git add popup.js
git commit -m "feat: add popup.js for API key read/write via chrome.storage.local"
```

---

### Task 5: Refactor updateOverlay in content.js

**Files:**
- Modify: `content.js` (lines 21–31, the `updateOverlay` function)

- [ ] **Step 1: Replace the updateOverlay function**

Find this in `content.js`:

```js
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

Replace it with:

```js
function updateOverlay(english, chinese) {
  const overlay = document.getElementById('duocue-overlay')
  if (!overlay) return
  if (!english) {
    overlay.innerHTML = ''
    overlay.style.display = 'none'
    return
  }
  const chineseHtml = chinese ? `<div class="duocue-zh">${chinese}</div>` : ''
  overlay.innerHTML = `<div class="duocue-en">${english}</div>${chineseHtml}`
  overlay.style.display = 'block'
}
```

> The existing call `updateOverlay(text)` in the observer still works after this change — `chinese` will be `undefined` (falsy), so no Chinese line is shown until Task 7 wires in translation.

- [ ] **Step 2: Verify syntax**

```bash
node --check content.js && echo "syntax ok"
```

Expected: `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add content.js
git commit -m "refactor: updateOverlay accepts (english, chinese) and uses innerHTML"
```

---

### Task 6: Add translate() to content.js

**Files:**
- Modify: `content.js` (add function before `startObserver`)

- [ ] **Step 1: Add the translate function**

Insert this block **before** the `function startObserver(platform)` line in `content.js`:

```js
async function translate(text) {
  const { translationApiKey } = await chrome.storage.local.get('translationApiKey')
  if (!translationApiKey) return null

  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${translationApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: 'zh-TW', format: 'text' }),
      }
    )
    const data = await res.json()
    return data?.data?.translations?.[0]?.translatedText ?? null
  } catch {
    return null
  }
}

```

- [ ] **Step 2: Verify syntax**

```bash
node --check content.js && echo "syntax ok"
```

Expected: `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add content.js
git commit -m "feat: add translate() function using Google Cloud Translation API"
```

---

### Task 7: Wire debounce into MutationObserver callback

**Files:**
- Modify: `content.js` (the `startObserver` function)

- [ ] **Step 1: Replace the startObserver function**

Find this in `content.js`:

```js
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
```

Replace it with:

```js
function startObserver(platform) {
  const container = document.querySelector(platform.containerSelector)
  if (!container) return

  createOverlay()

  let debounceTimer = null

  const observer = new MutationObserver(() => {
    const english = extractText(platform)
    console.log(`[DuoCue] ${english || '(no subtitle)'}`)

    if (!english) {
      updateOverlay(null, null)
      return
    }

    updateOverlay(english, null)

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      const chinese = await translate(english)
      updateOverlay(english, chinese)
    }, 150)
  })

  observer.observe(container, { childList: true, subtree: true })
  console.log(`[DuoCue] Observing ${platform.name} subtitle container`)
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check content.js && echo "syntax ok"
```

Expected: `syntax ok`

- [ ] **Step 3: Verify the full content.js looks correct**

```bash
cat -n /Users/kewos/Documents/projects/duocue/content.js
```

The file should have these functions in order:
1. `PLATFORMS` + `detectPlatform`
2. `createOverlay`
3. `updateOverlay(english, chinese)`
4. `extractText`
5. `translate`
6. `startObserver` (with debounce)
7. `pollForContainer`
8. Entry point (`const platform = detectPlatform()...`)

- [ ] **Step 4: Commit**

```bash
git add content.js
git commit -m "feat: wire translate() into observer with 150ms debounce"
```

---

### Task 8: Load and verify in Chrome

**Files:** none (manual verification)

- [ ] **Step 1: Reload the extension**

Go to `chrome://extensions` → find DuoCue → click the **refresh icon** (↺).

If you see an error badge, click "Errors" to read it. Common issues:
- JSON syntax error in manifest → re-run `node -e "JSON.parse(...)"` to find it
- Missing file → check that `popup.html` and `popup.js` exist in the project root

- [ ] **Step 2: Enter your API key**

Click the DuoCue icon in the Chrome toolbar → the popup opens → paste your Google Cloud Translation API key → click "Save Key" → verify "✅ Key saved" appears.

To get a key if you don't have one:
1. Go to console.cloud.google.com
2. Enable "Cloud Translation API"
3. Create an API key under APIs & Services → Credentials

- [ ] **Step 3: Test bilingual display**

Open `https://play.hbomax.com`, play any video, enable subtitles in the HBO player.

Expected overlay:
```
Timo, I'm down here.      ← white text
提摩，我在下面。           ← yellow text, appears ~150-400ms after English
```

In DevTools Console you should see:
```
[DuoCue] Observing HBO Max subtitle container
[DuoCue] Timo, I'm down here.
[DuoCue] (no subtitle)
```

- [ ] **Step 4: Test fallback (no key)**

Open popup → clear the API key field → Save → reload the HBO tab.

Expected: overlay shows only English, no yellow line, no errors in Console.

- [ ] **Step 5: Commit verification**

```bash
git commit --allow-empty -m "chore: translation feature manually verified on play.hbomax.com"
```

---

## Done

After Task 8 passes:

- [x] Popup lets user enter and save API key
- [x] Overlay shows English (white) + Chinese (yellow) bilingual subtitles
- [x] 150ms debounce prevents API spam
- [x] Graceful fallback to English-only when key is missing or API fails

Next steps (outside this plan): translation caching (same sentence → skip API call), target language switcher in popup.
