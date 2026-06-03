# DuoCue — 平台不適用警告設計文件

**日期：** 2026-06-03
**階段：** UX 改善
**目標：** 用戶在不支援的網站或非播放頁開啟 popup 時，顯示清楚的警告訊息

---

## 成功標準

1. 在不支援的網站開啟 popup → 顯示「此網站不支援」警告
2. 在 Netflix/YouTube 但非播放頁開啟 popup → 顯示「請前往播放頁面」警告
3. 在正確播放頁面 → 無警告，UI 正常顯示
4. 警告出現時 sections 半透明（0.4），狀態點變灰色

---

## UI 設計

### 位置

Header 下方、`#sections` 上方，全寬橫幅。

### 三種狀態

| 情況 | 狀態點 | 警告文字 |
|------|--------|---------|
| 不支援的網站 | 灰色 `#636366` | ⚠ 此網站不支援，請前往 HBO Max、Netflix 或 YouTube |
| 支援平台但非播放頁（Netflix） | 灰色 `#636366` | ⚠ 請前往 Netflix 播放頁面以啟動字幕 |
| 支援平台但非播放頁（YouTube） | 灰色 `#636366` | ⚠ 請前往 YouTube 影片頁面以啟動字幕 |
| 正常播放頁面 | 綠色 `#30D158` | （無警告） |

### 警告樣式（沿用 `.engine-warning`）

```css
#platformWarning {
  background: rgba(255, 159, 10, 0.12);
  border-bottom: 1px solid rgba(255, 159, 10, 0.25);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #FF9F0A;
  font-size: 12px;
  line-height: 1.4;
}
#platformWarning.hidden { display: none; }
```

### sections 半透明

```css
#sections.inactive { opacity: 0.4; pointer-events: none; }
```

---

## 實作範圍

### `popup.html`

1. 新增 `#platformWarning` div（預設 hidden），位於 header 和 `#sections` 之間
2. 新增對應 CSS

### `popup.js`

在 init 末尾（`initSections()` 之後）加入：

```js
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab?.url) return
  let url
  try { url = new URL(tab.url) } catch { return }

  const SUPPORTED = {
    'play.hbomax.com':  () => true,
    'www.netflix.com':  () => url.pathname.startsWith('/watch/'),
    'www.youtube.com':  () => url.pathname === '/watch',
  }

  const matcher = SUPPORTED[url.hostname]
  const warning  = document.getElementById('platformWarning')
  const dot      = document.querySelector('.status-dot')
  const sections = document.getElementById('sections')
  const msgEl    = document.getElementById('platformWarningText')

  if (!matcher) {
    msgEl.textContent = '此網站不支援，請前往 HBO Max、Netflix 或 YouTube'
    warning.classList.remove('hidden')
    dot.style.background = '#636366'
    sections.classList.add('inactive')
  } else if (!matcher()) {
    const names = { 'www.netflix.com': 'Netflix', 'www.youtube.com': 'YouTube' }
    msgEl.textContent = `請前往 ${names[url.hostname]} 播放頁面以啟動字幕`
    warning.classList.remove('hidden')
    dot.style.background = '#636366'
    sections.classList.add('inactive')
  }
})
```

---

## 不在本次範圍

- 警告訊息包含「前往」連結（直接跳轉播放頁）
- 手動選擇平台時的差異處理（警告邏輯只看 URL，不看 selectedPlatform）
