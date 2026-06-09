# DuoCue Web UI Design System

## Style

Dark/light switchable. Default: dark. Toggle with ☀️/🌙 button in header.
Typography: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif` (system UI).

---

## Color Tokens

| Role | Light | Dark |
|---|---|---|
| App background | `bg-gray-50` | `bg-black` |
| Panel / Card / Sidebar | `bg-white` | `bg-[#1C1C1E]` |
| Tooltip | `bg-white` | `bg-[#2C2C2E]` |
| Border | `border-gray-200` | `border-white/10` |
| Border (tooltip) | `border-gray-200` | `border-white/15` |
| Text primary | `text-gray-900` | `text-white` |
| Text secondary | `text-gray-500` | `text-white/60` |
| Text tertiary | `text-gray-400` | `text-white/40` |
| Text disabled | `text-gray-300` | `text-white/25` |
| Interactive hover bg | `bg-gray-100` | `bg-white/10` |
| Interactive subtle bg | `bg-gray-50` | `bg-white/5` |
| Chip / badge bg | `bg-gray-100` | `bg-white/10` |
| Link | `text-blue-500` | `text-blue-400` |
| Learning (word) | `text-orange-400` / `bg-orange-500/20` | same |
| Learned (word) | `text-green-400` / `bg-green-500/20` | same |
| Danger (delete) | `hover:text-red-400` | same |

Word-status semantic colors (orange/green) are the same in both modes.

---

## Tailwind v4 Dark Mode

Configured via `@variant dark (&:where(.dark, .dark *))` in `index.css`.
Toggle: `document.documentElement.classList.toggle('dark')`.
Preference stored in `localStorage` key `duocue-theme`.

---

## Layout

```
┌─ Header (h-12) ────────────────────────────────────┐
│ ● DuoCue                               ☀️/🌙 toggle │
├─ Sidebar (w-56) ──┬─ Main (flex-1 overflow-y-auto) ┤
│ nav               │ page content                    │
│ video groups      │                                 │
│ account           │                                 │
└───────────────────┴─────────────────────────────────┘
```

- `h-screen overflow-hidden` on root
- Sidebar: `shrink-0 w-56`, scrollable independently
- Main: `flex-1 overflow-y-auto p-6`

---

## Components

### SentenceCard

Rounded card `rounded-xl p-4`. Header row: platform badge + video title + timestamp jump link + delete (✕).
English text with `WordSpan` for each word token. Chinese translation below in secondary color.
Word chips at bottom (orange = learning, green = learned).

### WordSpan + Tooltip

Hover on any English word → tooltip after 100ms delay.
Tooltip rendered via React Portal at `document.body` (`position: fixed`) to escape `overflow-y: auto` clipping.

Tooltip boundary clamping:
- Width fixed at `w-56` (224px)
- Horizontal: clamped within 8px of viewport edges
- Vertical: flips below the word if word is within 220px of top of screen

Tooltip actions:
- **📙 學習中** / **✅ 已學習** buttons — click to mark; clicking the already-active status removes the mark
- Active button shows `✕ 學習中` / `✕ 已學習` with lighter hover to indicate it's removable

### Sidebar

Platform groups collapsible. Active item: `bg-gray-100 dark:bg-white/10`.
Bottom: hardcoded account avatar (blue circle, initial "W").

### Filter Pills (SentencesPage)

`rounded-full` pills. Active: `bg-gray-900 dark:bg-white text-white dark:text-black`.

---

## Spacing

4/8pt incremental system (Tailwind defaults). Cards: `gap-4`. Sidebar nav: `gap-1`. Tooltip: `p-3`.
