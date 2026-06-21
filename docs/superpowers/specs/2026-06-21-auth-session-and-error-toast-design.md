# Auth Session Sliding Expiry + Actionable Error Toast

**Date:** 2026-06-21
**Status:** Approved

## Problem

Users with expired session tokens see a generic `× 儲存失敗` toast when pressing S to save a sentence, with no indication of why it failed or what to do. Additionally, sessions expire after exactly 30 days with no renewal, forcing active users to re-login on a fixed schedule.

**Root cause of the immediate bug:** `POST /sentences` returns 401 when `sessions.expires_at < now`. The content script only checks `res.ok` and shows a generic error.

---

## Feature 1: Sliding Session Expiry (API)

**File:** `api/src/index.ts`

### Behaviour

After each successful authenticated request, if the session expires in fewer than 15 days, extend it to 30 days from now. Users who make at least one API call within any 30-day window will never be unexpectedly logged out.

### Implementation

In the auth middleware, after `await next()`, add a conditional DB update:

```typescript
// Sliding expiry: refresh if < 15 days remain
const fifteenDaysFromNow = new Date(Date.now() + 15 * 86400 * 1000)
if (new Date(session.expires_at) < fifteenDaysFromNow) {
  await c.env.DB.prepare(
    `UPDATE sessions SET expires_at = ? WHERE token = ?`
  ).bind(newExpiry(), token).run()
}
```

### Design decisions

- **Threshold of 15 days** (half of 30): avoids a DB write on every request for new sessions, starts refreshing when the session is old enough to be worth renewing.
- **After `next()`**: response is already constructed; the update does not affect response latency for requests that don't need renewal.
- **Still expires** if a user is inactive for 30+ days — correct security behaviour.

---

## Feature 2: Actionable Error Toast (Extension)

**File:** `extension/content.js`

### Behaviour

When saving a sentence fails with 401 Unauthorized, show a toast that:
1. States the specific reason: `× Token 已過期`
2. Offers an action button: `重新登入 →`
3. Clicking the button opens `https://duocue-web.pages.dev` in a new tab via `window.open(..., '_blank')` (requires a user gesture — the button click — so browsers do not block it; no background service worker needed)

For all other non-OK responses, keep the existing `× 儲存失敗` toast.

### API change: `showToast(message, action?)`

Add an optional second argument `action: { label: string; onClick: () => void }`.

When `action` is present:
- Build the toast content via DOM (not `textContent`) to include a `<button>`.
- Button is inline, visually consistent with the toast (white, slightly brighter, cursor pointer).
- Clicking the button fires `onClick` then dismisses the toast immediately.

```javascript
// Extended signature
function showToast(message, action) {
  let toast = document.getElementById('duocue-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'duocue-toast'
    document.body.appendChild(toast)
  }

  // Rebuild content each call
  toast.innerHTML = ''
  const span = document.createElement('span')
  span.textContent = message
  toast.appendChild(span)

  if (action) {
    const btn = document.createElement('button')
    btn.textContent = action.label
    // inline styles to keep scoped; no risk of page CSS collision
    btn.style.cssText = 'margin-left:10px;background:none;border:none;color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;padding:0;'
    btn.addEventListener('click', () => {
      action.onClick()
      toast.classList.remove('duocue-toast-show')
      toast.classList.add('duocue-toast-hide')
      clearTimeout(toast._timer)
    })
    toast.appendChild(btn)
  }

  toast.classList.remove('duocue-toast-hide')
  toast.classList.add('duocue-toast-show')
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => {
    toast.classList.remove('duocue-toast-show')
    toast.classList.add('duocue-toast-hide')
  }, action ? 6000 : 3000) // longer timeout when there's an action to click
}
```

### S key handler change

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

---

## Scope

| Area | File | Change |
|------|------|--------|
| API auth middleware | `api/src/index.ts` | Add sliding expiry after `next()` |
| Toast helper | `extension/content.js` | `showToast` accepts optional `action` |
| S key handler | `extension/content.js` | 401 → action toast; others → generic error |

No new files. No schema changes. No popup changes.

---

## Out of Scope

- Refreshing the token validation status shown in the popup (it already re-validates on `input`)
- Handling 401 in `setWordStatus` sync (fire-and-forget, failure is already `console.warn`; not user-visible)
- Auto-opening the popup (technically not possible from content scripts without a background worker)
