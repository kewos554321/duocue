function detectPlatform() {
  const platform = PLATFORMS.find(p => location.hostname === p.hostname)
  if (!platform) return null
  if (platform.watchMatcher && !platform.watchMatcher()) return null
  return platform
}

function createOverlay() {
  if (document.getElementById('duocue-overlay')) return
  const div = document.createElement('div')
  div.id = 'duocue-overlay'
  div.style.fontSize   = `${fontSize}px`
  div.style.fontFamily = fontFamily
  div.style.fontWeight = bold ? 'bold' : 'normal'
  document.body.appendChild(div)
}

let subtitleColor = '#FFD700'
let fontSize   = 18
let fontFamily = 'Arial, sans-serif'
let bold       = false
let translationEngine = 'free'

function sanitizeColor(c) {
  return /^#[0-9A-Fa-f]{3,8}$|^[a-zA-Z]+$/.test(c) ? c : '#FFD700'
}

chrome.storage.local.get('subtitleColor', ({ subtitleColor: c }) => {
  if (c) subtitleColor = sanitizeColor(c)
})

chrome.storage.local.get(['fontSize', 'fontFamily', 'bold'], ({ fontSize: fs, fontFamily: ff, bold: b }) => {
  if (fs != null) fontSize   = fs
  if (ff != null) fontFamily = ff
  if (b  != null) bold       = b
})

chrome.storage.local.get('translationEngine', ({ translationEngine: e }) => {
  if (e) translationEngine = e
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
  if (changes.fontSize) {
    fontSize = changes.fontSize.newValue
    const el = document.getElementById('duocue-overlay')
    if (el) el.style.fontSize = `${fontSize}px`
  }
  if (changes.fontFamily) {
    fontFamily = changes.fontFamily.newValue
    const el = document.getElementById('duocue-overlay')
    if (el) el.style.fontFamily = fontFamily
  }
  if (changes.bold) {
    bold = changes.bold.newValue
    const el = document.getElementById('duocue-overlay')
    if (el) el.style.fontWeight = bold ? 'bold' : 'normal'
  }
  if (changes.translationEngine) {
    translationEngine = changes.translationEngine.newValue
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

let _pollInterval = null

function stopPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval)
    _pollInterval = null
  }
  document.getElementById('duocue-overlay')?.remove()
  document.getElementById('duocue-hide-native')?.remove()
  lastEnglish = null
  lastChinese = null
}

function injectHideNativeCSS(platform) {
  const id = 'duocue-hide-native'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `${platform.hideNativeSelector} { display: none !important; }`
  document.head.appendChild(style)
}

function extractText(platform) {
  const nodes = document.querySelectorAll(platform.textSelector)
  return Array.from(nodes)
    .map(n => n.textContent.trim())
    .filter(Boolean)
    .join(platform.textJoin ?? '\n')
}

async function translateFree(text) {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`
    )
    const data = await res.json()
    if (data.responseStatus !== 200) return null
    return data.responseData?.translatedText ?? null
  } catch {
    return null
  }
}

async function translateGoogle(text) {
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

async function translate(text) {
  return translationEngine === 'google'
    ? translateGoogle(text)
    : translateFree(text)
}

function startPolling(platform) {
  createOverlay()
  injectHideNativeCSS(platform)

  function syncOverlayParent() {
    const overlay = document.getElementById('duocue-overlay')
    if (!overlay) return
    const player = platform.playerSelector
      ? document.querySelector(platform.playerSelector)
      : null
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

  _pollInterval = setInterval(async () => {
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

let _currentUrl = ''

function tryInit() {
  if (location.href === _currentUrl) return
  _currentUrl = location.href
  stopPolling()
  const platform = detectPlatform()
  if (platform) startPolling(platform)
}

const _origPush = history.pushState.bind(history)
history.pushState = (...args) => { _origPush(...args); tryInit() }

const _origReplace = history.replaceState.bind(history)
history.replaceState = (...args) => { _origReplace(...args); tryInit() }

window.addEventListener('popstate', tryInit)

tryInit()
