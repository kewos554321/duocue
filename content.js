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

function sanitizeColor(c) {
  return /^#[0-9A-Fa-f]{3,8}$|^[a-zA-Z]+$/.test(c) ? c : '#FFD700'
}

chrome.storage.local.get('subtitleColor', ({ subtitleColor: c }) => {
  if (c) subtitleColor = sanitizeColor(c)
})

let displayMode = 'both'
chrome.storage.local.get('displayMode', ({ displayMode: m }) => {
  if (m) displayMode = m
})

let lastEnglish = null
let lastChinese = null

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  if (changes.subtitleColor) {
    subtitleColor = sanitizeColor(changes.subtitleColor.newValue)
    document.querySelectorAll('.duocue-zh').forEach(el => {
      el.style.color = subtitleColor
    })
  }
  if (changes.displayMode) {
    displayMode = changes.displayMode.newValue
    if (lastEnglish) updateOverlay(lastEnglish, lastChinese)
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

  const showEn = displayMode === 'both' || displayMode === 'original'
  const showZh = (displayMode === 'both' || displayMode === 'translation') && chinese

  const enHtml = showEn ? `<div class="duocue-en">${english}</div>` : ''
  const zhHtml = showZh ? `<div class="duocue-zh" style="color:${subtitleColor}">${chinese}</div>` : ''

  if (!enHtml && !zhHtml) {
    overlay.innerHTML = ''
    overlay.style.display = 'none'
    return
  }

  overlay.innerHTML = enHtml + zhHtml
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

  // Keep overlay inside playerContainer so it survives fullscreen transitions.
  // HBO Max fullscreens playerContainer, so the overlay must be its descendant.
  function syncOverlayParent() {
    const overlay = document.getElementById('duocue-overlay')
    if (!overlay) return
    const player = document.querySelector('[data-testid="playerContainer"]')
    const target = player || document.body
    if (overlay.parentElement !== target) target.appendChild(overlay)
  }

  let transcriptEnabled = false
  let transcriptStartTime = null
  let transcriptBuffer = []
  let transcriptFull = false
  let flushInProgress = false

  chrome.storage.local.get(['transcriptEnabled', 'transcriptStorageFull'], (result) => {
    transcriptEnabled = result.transcriptEnabled === true
    transcriptFull = result.transcriptStorageFull === true
    if (transcriptEnabled) transcriptStartTime = Date.now()
  })

  function elapsed() {
    if (!transcriptStartTime) return '00:00:00'
    const s = Math.floor((Date.now() - transcriptStartTime) / 1000)
    const h = String(Math.floor(s / 3600)).padStart(2, '0')
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const sec = String(s % 60).padStart(2, '0')
    return `${h}:${m}:${sec}`
  }

  async function flushTranscriptBuffer() {
    if (transcriptBuffer.length === 0 || flushInProgress) return
    flushInProgress = true
    try {
      const toWrite = transcriptBuffer.splice(0)
      const { transcriptLines = [] } = await chrome.storage.local.get('transcriptLines')
      const updated = [...transcriptLines, ...toWrite]
      await chrome.storage.local.set({ transcriptLines: updated })
      const bytes = await chrome.storage.local.getBytesInUse('transcriptLines')
      if (bytes > 9 * 1024 * 1024) {
        transcriptFull = true
        await chrome.storage.local.set({ transcriptStorageFull: true })
      }
    } catch (e) {
      transcriptFull = true
      chrome.storage.local.set({ transcriptStorageFull: true })
    } finally {
      flushInProgress = false
    }
  }

  function recordSubtitle(text) {
    transcriptBuffer.push({ t: elapsed(), text: text.replace(/\n/g, ' ') })
    if (transcriptBuffer.length >= 3) flushTranscriptBuffer()
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return
    if (changes.transcriptEnabled) {
      transcriptEnabled = changes.transcriptEnabled.newValue === true
      if (transcriptEnabled) {
        transcriptStartTime = Date.now()
        transcriptFull = false
      } else {
        flushTranscriptBuffer()
      }
    }
    if (changes.transcriptClearedAt) {
      transcriptStartTime = Date.now()
      transcriptBuffer = []
      transcriptFull = false
    }
    if (changes.transcriptFlushAt) {
      flushTranscriptBuffer()
    }
  })

  window.addEventListener('beforeunload', () => {
    flushTranscriptBuffer()
  })

  let translateTimer = null

  setInterval(async () => {
    syncOverlayParent()
    const { enabled } = await chrome.storage.local.get('enabled')
    if (enabled === false) {
      updateOverlay(null, null)
      lastEnglish = null
      lastChinese = null
      return
    }

    const english = extractText(platform)

    if (english === lastEnglish) return
    lastEnglish = english

    console.log(`[DuoCue] ${english || '(no subtitle)'}`)

    if (!english) {
      updateOverlay(null, null)
      lastEnglish = null
      lastChinese = null
      return
    }

    updateOverlay(english, null)
    if (transcriptEnabled && !transcriptFull) recordSubtitle(english)

    clearTimeout(translateTimer)
    translateTimer = setTimeout(async () => {
      const chinese = await translate(english)
      lastChinese = chinese
      updateOverlay(english, chinese)
    }, 150)
  }, 200)
}

const platform = detectPlatform()
if (platform) startPolling(platform)
