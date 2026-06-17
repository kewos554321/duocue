const toggle      = document.getElementById('toggle')
const statusDot   = document.getElementById('statusDot')
const platformStatusEl = document.getElementById('platformStatus')
const apiKeyInput = document.getElementById('apiKey')
const eyeBtn      = document.getElementById('eyeBtn')
const keyStatus   = document.getElementById('keyStatus')
const saveBtn     = document.getElementById('save')
const colorPicker = document.getElementById('colorPicker')
const customSwatch = document.getElementById('customSwatch')
const swatches    = document.querySelectorAll('.color-swatch[data-color]')
const transcriptToggle = document.getElementById('transcriptToggle')
const transcriptBody = document.getElementById('transcriptBody')
const transcriptStatsEl = document.getElementById('transcriptStats')
const transcriptWarning = document.getElementById('transcriptWarning')
const downloadBtn = document.getElementById('downloadBtn')
const clearBtn = document.getElementById('clearBtn')
const segBtns          = document.querySelectorAll('#segControl .seg-btn')
const engineBtns       = document.querySelectorAll('#enginePicker .seg-btn')
const platformBtns     = document.querySelectorAll('#platformPicker .seg-btn')
const freeInfo         = document.getElementById('freeInfo')
const googleConfig     = document.getElementById('googleConfig')
const fontSizeRange    = document.getElementById('fontSizeRange')
const fontSizeLabel    = document.getElementById('fontSizeLabel')
const bgOpacityRange      = document.getElementById('bgOpacityRange')
const bgOpacityLabel      = document.getElementById('bgOpacityLabel')
const subtitleBottomRange = document.getElementById('subtitleBottomRange')
const subtitleBottomLabel = document.getElementById('subtitleBottomLabel')
const subtitleLeftRange   = document.getElementById('subtitleLeftRange')
const subtitleLeftLabel   = document.getElementById('subtitleLeftLabel')
const fontFamilySelect    = document.getElementById('fontFamilySelect')
const boldToggle          = document.getElementById('boldToggle')
const sourceLangSelect    = document.getElementById('sourceLangSelect')
const targetLangSelect    = document.getElementById('targetLangSelect')
const sourceLangRow       = document.getElementById('sourceLangRow')
const sourceLangAutoRow   = document.getElementById('sourceLangAutoRow')
const expToggle   = document.getElementById('expToggle')
const expApiKey   = document.getElementById('expApiKey')
const expEyeBtn   = document.getElementById('expEyeBtn')
const expFields   = document.getElementById('expFields')
const DUOCUE_API_ENDPOINT = 'https://duocue-api.kewos554321.workers.dev'

// ── Platform status indicator ─────────────────────────────────────────────
const WATCH_PATTERNS = [
  /^https?:\/\/play\.hbomax\.com\//,
  /^https?:\/\/www\.netflix\.com\/watch\//,
  /^https?:\/\/www\.youtube\.com\/watch(\?|$)/,
]
const PLATFORM_DOMAINS = [
  /^https?:\/\/([^/]*\.)?hbomax\.com\//,
  /^https?:\/\/www\.netflix\.com\//,
  /^https?:\/\/www\.youtube\.com\//,
]

function getTabStatus(url) {
  if (!url) return 'unsupported'
  if (WATCH_PATTERNS.some(p => p.test(url))) return 'watch'
  if (PLATFORM_DOMAINS.some(p => p.test(url))) return 'platform'
  return 'unsupported'
}

function updateStatusIndicator(url) {
  const status = getTabStatus(url)
  statusDot.classList.remove('yellow', 'red')
  platformStatusEl.classList.remove('yellow', 'red')
  platformStatusEl.textContent = ''
  if (status === 'platform') {
    statusDot.classList.add('yellow')
    platformStatusEl.classList.add('yellow')
    platformStatusEl.textContent = '請前往影片播放頁面'
  } else if (status === 'unsupported') {
    statusDot.classList.add('red')
    platformStatusEl.classList.add('red')
    platformStatusEl.textContent = '此頁面不支援 DuoCue'
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  updateStatusIndicator(tab?.url)
})

// ── Summaries + accordion ─────────────────────────────────────────────────
const PLATFORM_NAMES = { hbomax: 'HBO Max', netflix: 'Netflix', youtube: 'YouTube' }

const COLOR_NAMES = {
  '#FFD700': '金色', '#FFFFFF': '白色', '#00E5FF': '青色',
  '#FF6B6B': '紅色', '#98FB98': '綠色',
}

const LANG_LIST = [
  { code: 'zh-TW', label: '繁體中文', abbr: '繁中' },
  { code: 'zh-CN', label: '簡體中文', abbr: '簡中' },
  { code: 'en',    label: '英文',     abbr: 'EN'   },
  { code: 'ja',    label: '日文',     abbr: '日文' },
  { code: 'ko',    label: '韓文',     abbr: '韓文' },
  { code: 'es',    label: '西班牙文', abbr: '西文' },
  { code: 'fr',    label: '法文',     abbr: '法文' },
  { code: 'de',    label: '德文',     abbr: '德文' },
  { code: 'pt',    label: '葡萄牙文', abbr: '葡文' },
  { code: 'vi',    label: '越南文',   abbr: '越文' },
]

LANG_LIST.forEach(({ code, label }) => {
  sourceLangSelect.appendChild(new Option(label, code))
  targetLangSelect.appendChild(new Option(label, code))
})

function colorName(hex) {
  if (!hex) return '自訂'
  return COLOR_NAMES[hex.toUpperCase()] || '自訂'
}

function fontAbbr(ff) {
  return (ff || 'Arial').split(',')[0].replace(/['"]/g, '').trim()
}

function updateSummaries() {
  const activeMode = [...segBtns].find(b => b.classList.contains('active'))
  document.getElementById('summaryDisplay').textContent = activeMode?.textContent ?? '兩者'

  const selSwatch = [...swatches].find(s => s.classList.contains('selected'))
  const isCustom  = customSwatch.classList.contains('selected')
  const cName     = isCustom ? '自訂' : colorName(selSwatch?.dataset.color || '')
  const size      = fontSizeRange.value
  const font      = fontAbbr(fontFamilySelect.value)
  const op = bgOpacityRange.value
  document.getElementById('summaryAppearance').textContent = `${cName} · ${size}pt · ${font} · ${op}%`

  const activeEngine = [...engineBtns].find(b => b.classList.contains('active'))
  const isGoogle = activeEngine?.dataset.engine === 'google'
  const tgtAbbr = LANG_LIST.find(l => l.code === targetLangSelect.value)?.abbr ?? targetLangSelect.value
  if (isGoogle) {
    document.getElementById('summaryEngine').textContent = `Google · ${tgtAbbr}`
  } else {
    const srcAbbr = LANG_LIST.find(l => l.code === sourceLangSelect.value)?.abbr ?? sourceLangSelect.value
    document.getElementById('summaryEngine').textContent = `免費 · ${srcAbbr}→${tgtAbbr}`
  }

  document.getElementById('summaryTranscript').textContent =
    transcriptToggle.classList.contains('on') ? '記錄中' : '關閉'
}

function initSections() {
  document.querySelectorAll('.section-header').forEach(header => {
    const body = header.nextElementSibling
    header.addEventListener('click', () => {
      const isOpen = header.classList.contains('open')
      header.classList.toggle('open', !isOpen)
      header.setAttribute('aria-expanded', String(!isOpen))
      body.style.display = isOpen ? 'none' : ''
    })
  })
}

// ── Transcript helpers ────────────────────────────────────────────────────
function updateTranscriptStats(lines, isFull) {
  const kb = Math.round(JSON.stringify(lines).length / 1024)
  transcriptStatsEl.textContent = `${lines.length} lines · ${kb} KB`
  transcriptWarning.classList.toggle('hidden', !isFull)
}

async function downloadTranscript() {
  await chrome.storage.local.set({ transcriptFlushAt: Date.now() })
  await new Promise(r => setTimeout(r, 300))
  const { transcriptLines = [] } = await chrome.storage.local.get('transcriptLines')
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const generated = now.toISOString().slice(0, 19).replace('T', ' ')
  const header = [
    'DuoCue Transcript',
    `Generated: ${generated}`,
    `Lines: ${transcriptLines.length}`,
    '─'.repeat(33),
    '',
  ].join('\n')
  const body = transcriptLines.map(l => `[${l.t}] ${l.text}`).join('\n')
  const blob = new Blob([header + body], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  chrome.downloads.download(
    { url, filename: `duocue-transcript-${dateStr}.txt`, saveAs: true },
    () => setTimeout(() => URL.revokeObjectURL(url), 60_000)
  )
}

async function clearTranscript() {
  await chrome.storage.local.set({
    transcriptLines: [],
    transcriptStorageFull: false,
    transcriptClearedAt: Date.now(),
  })
  updateTranscriptStats([], false)
}

// ── Init ──────────────────────────────────────────────────────────────────
chrome.storage.local.get(
  ['translationApiKey', 'enabled', 'subtitleColor', 'displayMode', 'transcriptEnabled',
   'transcriptLines', 'transcriptStorageFull', 'fontSize', 'fontFamily', 'bold',
   'translationEngine', 'selectedPlatform', 'detectedPlatform', 'bgOpacity',
   'subtitleBottom', 'subtitleLeft', 'sourceLanguage', 'targetLanguage'],
  ({ translationApiKey, enabled, subtitleColor, displayMode, transcriptEnabled,
     transcriptLines = [], transcriptStorageFull, fontSize, fontFamily, bold,
     translationEngine, selectedPlatform, detectedPlatform, bgOpacity: savedOp,
     subtitleBottom: savedBottom, subtitleLeft: savedLeft,
     sourceLanguage, targetLanguage }) => {

    if (enabled !== false) toggle.classList.add('on')

    if (translationApiKey) apiKeyInput.value = translationApiKey
    setKeyStatus(!!translationApiKey)

    selectColor(subtitleColor || '#FFD700')
    selectMode(displayMode || 'both')

    const fs = fontSize ?? 18
    fontSizeRange.value       = fs
    fontSizeLabel.textContent = `${fs}pt`
    fontFamilySelect.value    = fontFamily || 'Arial, sans-serif'
    if (bold === true) boldToggle.classList.add('on')

    const op = savedOp ?? 75
    bgOpacityRange.value       = op
    bgOpacityLabel.textContent = `${op}%`

    const bottom = savedBottom ?? 10
    subtitleBottomRange.value       = bottom
    subtitleBottomLabel.textContent = `${bottom}%`

    const left = savedLeft ?? 50
    subtitleLeftRange.value       = left
    subtitleLeftLabel.textContent = `${left}%`

    if (transcriptEnabled === true) {
      transcriptToggle.classList.add('on')
      transcriptBody.classList.remove('hidden')
      updateTranscriptStats(transcriptLines, transcriptStorageFull === true)
    }

    selectEngine(translationEngine || 'free')
    sourceLangSelect.value = sourceLanguage || 'en'
    targetLangSelect.value = targetLanguage || 'zh-TW'
    selectPlatform(selectedPlatform || 'auto', detectedPlatform)
    initSections()
    updateSummaries()
  }
)

// ── Toggle ────────────────────────────────────────────────────────────────
toggle.addEventListener('click', () => {
  const isOn = toggle.classList.toggle('on')
  chrome.storage.local.set({ enabled: isOn })
  updateSummaries()
})

// ── Transcript toggle ─────────────────────────────────────────────────────
transcriptToggle.addEventListener('click', () => {
  const isOn = transcriptToggle.classList.toggle('on')
  transcriptBody.classList.toggle('hidden', !isOn)
  chrome.storage.local.set({ transcriptEnabled: isOn })
  updateSummaries()
})

// ── Live transcript stats + detected platform ─────────────────────────────
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  if (changes.detectedPlatform) {
    chrome.storage.local.get('selectedPlatform', ({ selectedPlatform }) => {
      updatePlatformSummary(selectedPlatform || 'auto', changes.detectedPlatform.newValue)
    })
  }
  if (changes.transcriptLines || changes.transcriptStorageFull) {
    chrome.storage.local.get(
      ['transcriptLines', 'transcriptStorageFull'],
      ({ transcriptLines = [], transcriptStorageFull }) => {
        if (transcriptToggle.classList.contains('on')) {
          updateTranscriptStats(transcriptLines, transcriptStorageFull === true)
        }
      }
    )
  }
})

// ── Download / Clear ──────────────────────────────────────────────────────
downloadBtn.addEventListener('click', downloadTranscript)
clearBtn.addEventListener('click', clearTranscript)

// ── Display Mode ──────────────────────────────────────────────────────────
segBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode
    selectMode(mode)
    chrome.storage.local.set({ displayMode: mode })
    updateSummaries()
  })
})

// ── Engine picker ──────────────────────────────────────────────────────────
function selectEngine(engine) {
  engineBtns.forEach(b => b.classList.toggle('active', b.dataset.engine === engine))
  freeInfo.style.display          = engine === 'free'   ? ''     : 'none'
  googleConfig.style.display      = engine === 'google' ? 'flex' : 'none'
  sourceLangRow.style.display     = engine === 'free'   ? ''     : 'none'
  sourceLangAutoRow.style.display = engine === 'google' ? ''     : 'none'
  chrome.storage.local.set({ translationEngine: engine })
  updateSummaries()
}

engineBtns.forEach(btn => {
  btn.addEventListener('click', () => selectEngine(btn.dataset.engine))
})

// ── Language pickers ──────────────────────────────────────────────────────
sourceLangSelect.addEventListener('change', () => {
  chrome.storage.local.set({ sourceLanguage: sourceLangSelect.value })
  updateSummaries()
})

targetLangSelect.addEventListener('change', () => {
  chrome.storage.local.set({ targetLanguage: targetLangSelect.value })
  updateSummaries()
})

// ── Platform picker ───────────────────────────────────────────────────────
function updatePlatformSummary(selectedId, detectedId) {
  const el = document.getElementById('summaryPlatform')
  if (!selectedId || selectedId === 'auto') {
    const name = PLATFORM_NAMES[detectedId]
    el.textContent = name ? `自動（${name}）` : '自動（未偵測）'
  } else {
    el.textContent = PLATFORM_NAMES[selectedId] ?? selectedId
  }
}

function selectPlatform(id, detectedId) {
  platformBtns.forEach(b => b.classList.toggle('active', b.dataset.platform === id))
  chrome.storage.local.set({ selectedPlatform: id })
  chrome.storage.local.get('detectedPlatform', ({ detectedPlatform }) => {
    updatePlatformSummary(id, detectedId ?? detectedPlatform)
  })
}

platformBtns.forEach(btn => {
  btn.addEventListener('click', () => selectPlatform(btn.dataset.platform))
})

// ── Font size ─────────────────────────────────────────────────────────────
fontSizeRange.addEventListener('input', () => {
  const size = Number(fontSizeRange.value)
  fontSizeLabel.textContent = `${size}pt`
  chrome.storage.local.set({ fontSize: size })
  updateSummaries()
})

// ── Font family ───────────────────────────────────────────────────────────
fontFamilySelect.addEventListener('change', () => {
  chrome.storage.local.set({ fontFamily: fontFamilySelect.value })
  updateSummaries()
})

// ── Background opacity ────────────────────────────────────────────────────
bgOpacityRange.addEventListener('input', () => {
  const op = Number(bgOpacityRange.value)
  bgOpacityLabel.textContent = `${op}%`
  chrome.storage.local.set({ bgOpacity: op })
  updateSummaries()
})

// ── Subtitle position ─────────────────────────────────────────────────────
subtitleBottomRange.addEventListener('input', () => {
  const v = Number(subtitleBottomRange.value)
  subtitleBottomLabel.textContent = `${v}%`
  chrome.storage.local.set({ subtitleBottom: v })
})

subtitleLeftRange.addEventListener('input', () => {
  const v = Number(subtitleLeftRange.value)
  subtitleLeftLabel.textContent = `${v}%`
  chrome.storage.local.set({ subtitleLeft: v })
})

// ── Bold ──────────────────────────────────────────────────────────────────
boldToggle.addEventListener('click', () => {
  const isOn = boldToggle.classList.toggle('on')
  chrome.storage.local.set({ bold: isOn })
  updateSummaries()
})

// ── Eye button ────────────────────────────────────────────────────────────
const EYE_OPEN  = '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3.5C4.5 3.5 1.5 8 1.5 8C1.5 8 4.5 12.5 8 12.5C11.5 12.5 14.5 8 14.5 8C14.5 8 11.5 3.5 8 3.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg>'
const EYE_SLASH = '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3.5C4.5 3.5 1.5 8 1.5 8C1.5 8 4.5 12.5 8 12.5C11.5 12.5 14.5 8 14.5 8C14.5 8 11.5 3.5 8 3.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/><line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'

eyeBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password'
  apiKeyInput.type = isPassword ? 'text' : 'password'
  eyeBtn.innerHTML = isPassword ? EYE_SLASH : EYE_OPEN
})

// ── Save Key ──────────────────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim()
  const action = key
    ? (cb) => chrome.storage.local.set({ translationApiKey: key }, cb)
    : (cb) => chrome.storage.local.remove('translationApiKey', cb)
  action(() => {
    setKeyStatus(!!key)
    saveBtn.textContent = '✓ Saved'
    saveBtn.classList.add('saved')
    setTimeout(() => {
      saveBtn.textContent = 'Save Key'
      saveBtn.classList.remove('saved')
    }, 1500)
  })
})

// ── Color swatches ────────────────────────────────────────────────────────
swatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color
    selectColor(color)
    chrome.storage.local.set({ subtitleColor: color })
    updateSummaries()
  })
})

customSwatch.addEventListener('click', () => colorPicker.click())

colorPicker.addEventListener('input', () => {
  const color = colorPicker.value
  selectColor(color, true)
  chrome.storage.local.set({ subtitleColor: color })
  updateSummaries()
})

// ── Helpers ───────────────────────────────────────────────────────────────
function selectColor(color, isCustom = false) {
  swatches.forEach(s => s.classList.remove('selected'))
  customSwatch.classList.remove('selected')

  if (!isCustom) {
    const match = [...swatches].find(
      s => s.dataset.color.toLowerCase() === color.toLowerCase()
    )
    if (match) {
      match.classList.add('selected')
      return
    }
  }

  // 自訂顏色（或找不到對應的預設色票）
  customSwatch.classList.add('selected')
  customSwatch.style.setProperty('--swatch-color', color)
  colorPicker.value = color
}

function selectMode(mode) {
  segBtns.forEach(b => b.classList.remove('active'))
  const match = [...segBtns].find(b => b.dataset.mode === mode)
  if (match) match.classList.add('active')
}

function setKeyStatus(isSet) {
  keyStatus.textContent = isSet ? '✓ Set' : '⚠ Not set'
  keyStatus.className = 'field-status ' + (isSet ? 'set' : 'unset')
}

// ── Experimental settings ─────────────────────────────────────────────────
function setTokenStatus(state) {
  const el = document.getElementById('tokenStatus')
  el.className = 'field-status'
  const map = {
    empty:    ['', ''],
    checking: ['驗證中...', 'checking'],
    valid:    ['✓ 已連線', 'set'],
    invalid:  ['Token 無效', 'unset'],
  }
  const [text, cls] = map[state] ?? map.empty
  el.textContent = text
  if (cls) el.classList.add(cls)
}

async function validateToken(token) {
  try {
    const res = await fetch(`${DUOCUE_API_ENDPOINT}/sentences/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    setTokenStatus(res.ok ? 'valid' : 'invalid')
  } catch {
    setTokenStatus('invalid')
  }
}

let tokenValidateTimer = null

chrome.storage.local.set({ apiEndpoint: DUOCUE_API_ENDPOINT })
chrome.storage.local.get(['experimentalMode', 'apiKey'], ({ experimentalMode, apiKey }) => {
  if (experimentalMode) {
    expToggle.classList.add('on')
    expFields.style.opacity = '1'
    expFields.style.pointerEvents = ''
    document.getElementById('summaryExp').textContent = '開啟'
  }
  if (apiKey) {
    expApiKey.value = apiKey
    if (experimentalMode) validateToken(apiKey)
  }
})

expToggle.addEventListener('click', () => {
  const isOn = expToggle.classList.toggle('on')
  expFields.style.opacity = isOn ? '1' : '0.4'
  expFields.style.pointerEvents = isOn ? '' : 'none'
  document.getElementById('summaryExp').textContent = isOn ? '開啟' : '關閉'
  chrome.storage.local.set({ experimentalMode: isOn })
  if (isOn && expApiKey.value.trim()) validateToken(expApiKey.value.trim())
})

expApiKey.addEventListener('input', () => {
  const val = expApiKey.value.trim()
  chrome.storage.local.set({ apiKey: val })
  clearTimeout(tokenValidateTimer)
  if (!val) { setTokenStatus('empty'); return }
  setTokenStatus('checking')
  tokenValidateTimer = setTimeout(() => validateToken(val), 700)
})

expEyeBtn.addEventListener('click', () => {
  expApiKey.type = expApiKey.type === 'password' ? 'text' : 'password'
})

document.getElementById('getTokenBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://duocue-web.pages.dev' })
})

document.getElementById('openWebBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://duocue-web.pages.dev' })
})
