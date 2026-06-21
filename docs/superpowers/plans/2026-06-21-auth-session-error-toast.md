# Auth Session Sliding Expiry + Action Error Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix expired-session saves silently failing by (1) auto-renewing active sessions and (2) showing "Token 已過期 [重新登入 →]" instead of a generic error.

**Architecture:** Two independent changes — the API middleware gets a conditional `UPDATE sessions` after each authenticated request; the extension's `showToast` gains an optional `action` button and the S key handler distinguishes 401 from other errors.

**Tech Stack:** Hono (Cloudflare Workers), Vitest (API unit tests), vanilla JS (extension)

## Global Constraints

- API tests run with: `cd api && npm test`
- Extension has no test framework — verification is manual via Chrome DevTools
- `newExpiry()` is already defined in `api/src/index.ts` — reuse it, do not redefine
- Toast dismiss timeout: 1500 ms for text-only toasts, 6000 ms when an action button is present
- Web app URL for re-login: `https://duocue-web.pages.dev`

---

## File Map

| File | Change |
|------|--------|
| `api/src/index.ts` | Add `needsRefresh()` helper; call it in auth middleware after `next()` |
| `api/src/__tests__/session.test.ts` | New — unit tests for `needsRefresh()` |
| `extension/content.js` | Extend `showToast(msg, action?)`, fix `pointer-events`, update S key handler |

---

## Task 1: API — Sliding Session Expiry

**Files:**
- Modify: `api/src/index.ts`
- Create: `api/src/__tests__/session.test.ts`

**Interfaces:**
- Produces: `needsRefresh(expiresAt: string, now?: Date): boolean` — exported from `api/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `api/src/__tests__/session.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { needsRefresh } from '../index'

describe('needsRefresh', () => {
  test('returns false when session expires in more than 15 days', () => {
    const future = new Date(Date.now() + 20 * 86400 * 1000).toISOString()
    expect(needsRefresh(future)).toBe(false)
  })

  test('returns true when session expires in fewer than 15 days', () => {
    const soon = new Date(Date.now() + 10 * 86400 * 1000).toISOString()
    expect(needsRefresh(soon)).toBe(true)
  })

  test('returns true when session is already expired', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(needsRefresh(past)).toBe(true)
  })

  test('returns true when exactly at the 15-day threshold', () => {
    const now = new Date()
    const threshold = new Date(now.getTime() + 15 * 86400 * 1000)
    // expires_at == threshold means < threshold is false — should NOT refresh
    expect(needsRefresh(new Date(threshold.getTime() + 1).toISOString(), now)).toBe(false)
    // expires_at one ms before threshold — should refresh
    expect(needsRefresh(new Date(threshold.getTime() - 1).toISOString(), now)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/kewos/Documents/projects/duocue/api && npm test
```

Expected: error `needsRefresh is not exported from '../index'`

- [ ] **Step 3: Add `needsRefresh` and the middleware update to `api/src/index.ts`**

After the existing `function newExpiry(): string { ... }` (around line 44), add:

```typescript
export function needsRefresh(expiresAt: string, now: Date = new Date()): boolean {
  const fifteenDaysFromNow = new Date(now.getTime() + 15 * 86400 * 1000)
  return new Date(expiresAt) < fifteenDaysFromNow
}
```

Then in the auth middleware, after `c.set('userId', session.user_id)` and `await next()`, add the conditional refresh. The middleware block currently ends at `await next()`. Change it to:

```typescript
  c.set('token', token)
  c.set('userId', session.user_id)
  await next()

  if (needsRefresh(session.expires_at)) {
    await c.env.DB.prepare(
      `UPDATE sessions SET expires_at = ? WHERE token = ?`
    ).bind(newExpiry(), token).run()
  }
})
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/kewos/Documents/projects/duocue/api && npm test
```

Expected: all tests pass including the new `session.test.ts` suite

- [ ] **Step 5: Commit**

```bash
git add api/src/index.ts api/src/__tests__/session.test.ts
git commit -m "feat(api): sliding session expiry — refresh when < 15 days remain"
```

---

## Task 2: Extension — Action Toast + 401 Error Handling

**Files:**
- Modify: `extension/content.js`

**Interfaces:**
- Consumes: nothing from Task 1 (fully independent)
- Produces: `showToast(message: string, action?: { label: string; onClick: () => void }): void`

- [ ] **Step 1: Replace `showToast` in `extension/content.js`**

Find the existing `showToast` function (around line 819) and replace it entirely:

```javascript
// ── Experimental: toast notification ──────────────────────────────────────
function showToast(message, action) {
  let toast = document.getElementById('duocue-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'duocue-toast'
    document.body.appendChild(toast)
  }

  toast.innerHTML = ''
  const span = document.createElement('span')
  span.textContent = message
  toast.appendChild(span)

  if (action) {
    const btn = document.createElement('button')
    btn.textContent = action.label
    btn.style.cssText = 'margin-left:10px;background:none;border:none;color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;padding:0;'
    btn.addEventListener('click', () => {
      action.onClick()
      clearTimeout(toast._timer)
      toast.classList.remove('duocue-toast-show')
      toast.classList.add('duocue-toast-hide')
    })
    toast.appendChild(btn)
  }

  toast.style.pointerEvents = action ? 'auto' : 'none'
  toast.classList.remove('duocue-toast-hide')
  toast.classList.add('duocue-toast-show')
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => {
    toast.classList.remove('duocue-toast-show')
    toast.classList.add('duocue-toast-hide')
  }, action ? 6000 : 1500)
}
```

Note: `pointer-events: none` is set in `styles.css` for `#duocue-toast`. The inline `toast.style.pointerEvents` overrides it per call — no CSS change needed.

- [ ] **Step 2: Update the S key handler to distinguish 401**

Find the existing error handling inside the S key `keydown` listener (around line 869):

```javascript
    if (!res.ok) showToast('× 儲存失敗')
```

Replace those two lines (the `if (!res.ok)` line AND the `catch` block's `showToast`) with:

```javascript
    if (res.status === 401) {
      showToast('× Token 已過期', {
        label: '重新登入 →',
        onClick: () => window.open('https://duocue-web.pages.dev', '_blank'),
      })
    } else if (!res.ok) {
      showToast('× 儲存失敗')
    }
```

And in the `catch` block (currently `showToast('× 儲存失敗')`), keep as-is — network errors are not auth errors.

After the edit the S key handler error section should look like:

```javascript
  showToast('✓ 已儲存')
  try {
    const res = await fetch(`${_expApiEndpoint}/sentences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_expApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        platform: platform?.id ?? 'unknown',
        videoUrl: location.href,
        title: platform?.getTitle?.() || '',
        text: textToSave,
        translation,
        timestampS
      })
    })
    if (res.status === 401) {
      showToast('× Token 已過期', {
        label: '重新登入 →',
        onClick: () => window.open('https://duocue-web.pages.dev', '_blank'),
      })
    } else if (!res.ok) {
      showToast('× 儲存失敗')
    }
  } catch {
    showToast('× 儲存失敗')
  }
```

- [ ] **Step 3: Manual verification — action toast**

Load the extension in Chrome (chrome://extensions → Load unpacked → select `extension/`).

Open any page, open DevTools console, paste and run:

```javascript
// Simulate the action toast
const event = new Event('test')
document.dispatchEvent(event)

// Call showToast directly via the content script context
// (in the DevTools console for the page where content.js is injected)
showToast('× Token 已過期', {
  label: '重新登入 →',
  onClick: () => alert('would open duocue-web.pages.dev'),
})
```

Expected:
- Toast appears bottom-right with text `× Token 已過期` and underlined button `重新登入 →`
- Clicking the button fires the alert and dismisses the toast immediately
- Toast auto-dismisses after 6 seconds if not clicked
- Calling `showToast('× 儲存失敗')` (no action) still works as before, dismisses after 1.5s and button is not clickable through the toast area

- [ ] **Step 4: Manual verification — S key 401 flow**

Temporarily corrupt the stored API key to force a 401:

1. Open DevTools → Application → Extension Storage → find the extension → Local Storage → set `apiKey` to `bad-token`
2. Reload the page, navigate to a video with subtitles
3. Wait for a subtitle line to appear, press S
4. Expected: `✓ 已儲存` toast appears first (optimistic), then immediately replaced by `× Token 已過期 [重新登入 →]`
5. Click `重新登入 →` — new tab opens to `https://duocue-web.pages.dev`
6. Restore the correct API key

- [ ] **Step 5: Commit**

```bash
git add extension/content.js
git commit -m "feat(ext): action toast for 401 — show 'Token 已過期' with re-login button"
```
