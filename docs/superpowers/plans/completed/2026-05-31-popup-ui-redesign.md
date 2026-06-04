# Popup UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare-bones popup with an Apple Dark Mode UI featuring a toggle, API key visibility switch, key status indicator, and save feedback.

**Architecture:** `popup.html` is a complete self-contained rewrite (inline styles, no external CSS) that references DOM IDs consumed by `popup.js`. `popup.js` is also rewritten to handle three interactions: toggle (saves `enabled` to storage), eye button (switches input type), and save (stores key + button feedback). `content.js` gets a one-block addition at the top of the polling interval to check `enabled` state and hide the overlay when disabled.

**Tech Stack:** Vanilla HTML/CSS/JS, Chrome Extension MV3, chrome.storage.local

---

## File Map

| File | Action | Lines affected |
|------|--------|---------------|
| `popup.html` | Full rewrite | All |
| `popup.js` | Full rewrite | All |
| `content.js` | Modify `startPolling` | Lines 69–89 (setInterval callback) |

---

### Task 1: Rewrite popup.html

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: Replace popup.html with the new design**

Write the complete file at `/Users/kewos/Documents/projects/duocue/popup.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      width: 300px;
      background: #1C1C1E;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
      color: #FFFFFF;
      overflow: hidden;
    }

    .header {
      background: #2C2C2E;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #3A3A3C;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .logo-dot {
      width: 10px;
      height: 10px;
      background: #0A84FF;
      border-radius: 50%;
    }

    .header-title {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.4px;
    }

    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .header-subtitle {
      font-size: 12px;
      color: #8E8E93;
    }

    .toggle {
      width: 44px;
      height: 26px;
      background: #636366;
      border-radius: 13px;
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
    }

    .toggle.on { background: #30D158; }

    .toggle-knob {
      width: 22px;
      height: 22px;
      background: #FFFFFF;
      border-radius: 50%;
      position: absolute;
      top: 2px;
      left: 2px;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }

    .toggle.on .toggle-knob { transform: translateX(18px); }

    .body { padding: 16px; }

    .field-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .field-label {
      font-size: 13px;
      color: #8E8E93;
      font-weight: 500;
    }

    .key-status {
      font-size: 12px;
      font-weight: 500;
    }

    .key-status.set { color: #30D158; }
    .key-status.not-set { color: #FF9F0A; }

    .input-wrapper {
      position: relative;
      margin-bottom: 12px;
    }

    .input-wrapper input {
      width: 100%;
      height: 44px;
      background: #2C2C2E;
      border: 1.5px solid #3A3A3C;
      border-radius: 10px;
      color: #FFFFFF;
      font-size: 15px;
      font-family: inherit;
      padding: 0 44px 0 12px;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .input-wrapper input:focus {
      border-color: #0A84FF;
      box-shadow: 0 0 0 3px rgba(10,132,255,0.3);
    }

    .eye-btn {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 0;
      line-height: 1;
      opacity: 0.6;
      transition: opacity 0.15s;
    }

    .eye-btn:hover { opacity: 1; }

    .save-btn {
      width: 100%;
      height: 44px;
      background: #0A84FF;
      border: none;
      border-radius: 10px;
      color: #FFFFFF;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s, opacity 0.15s;
    }

    .save-btn:hover { opacity: 0.85; }
    .save-btn.saved { background: #30D158; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="logo-dot"></div>
      <span class="header-title">DuoCue</span>
    </div>
    <div class="header-right">
      <span class="header-subtitle">Bilingual Subtitles</span>
      <div class="toggle on" id="toggle">
        <div class="toggle-knob"></div>
      </div>
    </div>
  </div>

  <div class="body">
    <div class="field-header">
      <span class="field-label">API Key</span>
      <span class="key-status not-set" id="keyStatus">⚠ Not set</span>
    </div>

    <div class="input-wrapper">
      <input type="password" id="apiKey" placeholder="AIza..." autocomplete="off">
      <button class="eye-btn" id="eyeBtn" title="Toggle visibility">👁</button>
    </div>

    <button class="save-btn" id="saveBtn">Save Key</button>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify the file saved correctly**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('/Users/kewos/Documents/projects/duocue/popup.html', 'utf8');
const checks = ['id=\"toggle\"', 'id=\"apiKey\"', 'id=\"eyeBtn\"', 'id=\"saveBtn\"', 'id=\"keyStatus\"', 'popup.js'];
checks.forEach(c => console.log(html.includes(c) ? '✓ ' + c : '✗ MISSING: ' + c));
"
```

Expected: 6 lines all starting with `✓`

- [ ] **Step 3: Commit**

```bash
cd /Users/kewos/Documents/projects/duocue
git add popup.html
git commit -m "feat: redesign popup with Apple Dark Mode UI"
```

---

### Task 2: Rewrite popup.js

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: Replace popup.js with the new logic**

Write the complete file at `/Users/kewos/Documents/projects/duocue/popup.js`:

```js
const toggle = document.getElementById('toggle')
const apiKeyInput = document.getElementById('apiKey')
const eyeBtn = document.getElementById('eyeBtn')
const saveBtn = document.getElementById('saveBtn')
const keyStatus = document.getElementById('keyStatus')

// Load saved state on open
chrome.storage.local.get(['translationApiKey', 'enabled'], ({ translationApiKey, enabled }) => {
  if (enabled === false) {
    toggle.classList.remove('on')
  }

  if (translationApiKey) {
    apiKeyInput.value = translationApiKey
    keyStatus.textContent = '✓ Set'
    keyStatus.className = 'key-status set'
  }
})

// Toggle: enable / disable DuoCue
toggle.addEventListener('click', () => {
  const isOn = toggle.classList.toggle('on')
  chrome.storage.local.set({ enabled: isOn })
})

// Eye button: show / hide API key
let keyVisible = false
eyeBtn.addEventListener('click', () => {
  keyVisible = !keyVisible
  apiKeyInput.type = keyVisible ? 'text' : 'password'
  eyeBtn.textContent = keyVisible ? '🙈' : '👁'
})

// Save button: persist key + visual feedback
saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim()
  chrome.storage.local.set({ translationApiKey: key }, () => {
    keyStatus.textContent = key ? '✓ Set' : '⚠ Not set'
    keyStatus.className = key ? 'key-status set' : 'key-status not-set'

    saveBtn.textContent = '✓ Saved'
    saveBtn.classList.add('saved')
    setTimeout(() => {
      saveBtn.textContent = 'Save Key'
      saveBtn.classList.remove('saved')
    }, 1500)
  })
})
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./popup.js')" 2>&1 || true
```

Expected: error about `document` not defined (browser API) — no `SyntaxError`.

- [ ] **Step 3: Verify all DOM IDs referenced in popup.js exist in popup.html**

```bash
node -e "
const html = require('fs').readFileSync('/Users/kewos/Documents/projects/duocue/popup.html', 'utf8');
['toggle','apiKey','eyeBtn','saveBtn','keyStatus'].forEach(id => {
  console.log(html.includes('id=\"' + id + '\"') ? '✓ ' + id : '✗ MISSING: ' + id);
});
"
```

Expected: 5 lines all starting with `✓`

- [ ] **Step 4: Commit**

```bash
cd /Users/kewos/Documents/projects/duocue
git add popup.js
git commit -m "feat: rewrite popup.js with toggle, eye button, and save feedback"
```

---

### Task 3: Add enabled check to content.js polling loop

**Files:**
- Modify: `content.js` (inside `startPolling`, the `setInterval` callback starting at the `const english = extractText(platform)` line)

- [ ] **Step 1: Replace the setInterval callback**

Find this block inside `startPolling`:

```js
  setInterval(async () => {
    const english = extractText(platform)

    if (english === lastText) return
    lastText = english

    console.log(`[DuoCue] ${english || '(no subtitle)'}`)

    if (!english) {
      updateOverlay(null, null)
      return
    }

    updateOverlay(english, null)

    clearTimeout(translateTimer)
    translateTimer = setTimeout(async () => {
      const chinese = await translate(english)
      updateOverlay(english, chinese)
    }, 150)
  }, 200)
```

Replace it with:

```js
  setInterval(async () => {
    const { enabled } = await chrome.storage.local.get('enabled')
    if (enabled === false) {
      updateOverlay(null, null)
      lastText = null
      return
    }

    const english = extractText(platform)

    if (english === lastText) return
    lastText = english

    console.log(`[DuoCue] ${english || '(no subtitle)'}`)

    if (!english) {
      updateOverlay(null, null)
      return
    }

    updateOverlay(english, null)

    clearTimeout(translateTimer)
    translateTimer = setTimeout(async () => {
      const chinese = await translate(english)
      updateOverlay(english, chinese)
    }, 150)
  }, 200)
```

- [ ] **Step 2: Verify syntax**

```bash
node --check /Users/kewos/Documents/projects/duocue/content.js && echo "syntax ok"
```

Expected: `syntax ok`

- [ ] **Step 3: Commit**

```bash
cd /Users/kewos/Documents/projects/duocue
git add content.js
git commit -m "feat: respect enabled toggle in polling loop"
```

---

### Task 4: Load and verify in Chrome

**Files:** none (manual verification)

- [ ] **Step 1: Reload the extension**

Go to `chrome://extensions` → find DuoCue → click **↺ reload**.

No error badge should appear.

- [ ] **Step 2: Open the popup**

Click the DuoCue icon in the Chrome toolbar. Verify:

- Background is dark (`#1C1C1E`)
- Header shows blue dot + "DuoCue" + "Bilingual Subtitles" + green toggle (ON)
- "API Key" label with `⚠ Not set` in orange (if no key saved yet), or `✓ Set` in green
- Password input with eye icon on the right
- Blue "Save Key" button

- [ ] **Step 3: Test toggle**

Click the toggle → it turns grey (OFF). Go to HBO Max → overlay should disappear within 200ms. Click toggle again → overlay returns.

- [ ] **Step 4: Test eye button**

Click 👁 → input shows plaintext. Icon changes to 🙈. Click again → input back to password dots.

- [ ] **Step 5: Test Save Key**

Type a key (or use an existing one) → click "Save Key" → button turns green and shows "✓ Saved" → reverts to "Save Key" after 1.5 seconds → `⚠ Not set` indicator changes to `✓ Set`.

- [ ] **Step 6: Commit verification**

```bash
cd /Users/kewos/Documents/projects/duocue
git commit --allow-empty -m "chore: popup redesign manually verified"
```

---

## Done

After Task 4 passes:

- [x] Apple Dark Mode popup UI
- [x] Toggle enables / disables overlay in real time (≤200ms)
- [x] Eye button shows / hides API key
- [x] Key status indicator updates on save
- [x] Save button has 1.5s green feedback
