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

function createOverlay() {
  if (document.getElementById('duocue-overlay')) return
  const div = document.createElement('div')
  div.id = 'duocue-overlay'
  document.body.appendChild(div)
}

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

const platform = detectPlatform()
if (platform) pollForContainer(platform)
