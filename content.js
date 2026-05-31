const PLATFORMS = [
  {
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    containerSelector: '[class*="VerticalCueSpacer-Fuse-Web-Play"]',
    textSelector: '[class*="TextCue-Fuse-Web-Play"]',
  },
]

function detectPlatform() {
  return PLATFORMS.find(p => location.hostname === p.hostname) ?? null
}

function createOverlay() {
  if (document.getElementById('duocue-overlay')) return
  const div = document.createElement('div')
  div.id = 'duocue-overlay'
  document.body.appendChild(div)
}

let subtitleColor = '#FFD700'
chrome.storage.local.get('subtitleColor', ({ subtitleColor: c }) => {
  if (c) subtitleColor = c
})

chrome.storage.onChanged.addListener((changes) => {
  if (changes.subtitleColor) {
    subtitleColor = changes.subtitleColor.newValue
    document.querySelectorAll('.duocue-zh').forEach(el => {
      el.style.color = subtitleColor
    })
  }
})

function updateOverlay(english, chinese) {
  const overlay = document.getElementById('duocue-overlay')
  if (!overlay) return
  if (!english) {
    overlay.innerHTML = ''
    overlay.style.display = 'none'
    return
  }
  const chineseHtml = chinese
    ? `<div class="duocue-zh" style="color:${subtitleColor}">${chinese}</div>`
    : ''
  overlay.innerHTML = `<div class="duocue-en">${english}</div>${chineseHtml}`
  overlay.style.display = 'block'
}

function extractText(platform) {
  const nodes = document.querySelectorAll(platform.textSelector)
  return Array.from(nodes)
    .map(n => n.textContent.trim())
    .filter(Boolean)
    .join('\n')
}

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

function startPolling(platform) {
  createOverlay()
  console.log(`[DuoCue] Polling subtitles for ${platform.name}`)

  let lastText = null
  let translateTimer = null

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
}

const platform = detectPlatform()
if (platform) startPolling(platform)
