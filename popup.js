const toggle      = document.getElementById('toggle')
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
const fontFamilySelect = document.getElementById('fontFamilySelect')
const boldToggle       = document.getElementById('boldToggle')

// ── Summaries + accordion ─────────────────────────────────────────────────
const COLOR_NAMES = {
  '#FFD700': '金色', '#FFFFFF': '白色', '#00E5FF': '青色',
  '#FF6B6B': '紅色', '#98FB98': '綠色',
}

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
  document.getElementById('summaryAppearance').textContent = `${cName} · ${size}pt · ${font}`

  const activeEngine = [...engineBtns].find(b => b.classList.contains('active'))
  document.getElementById('summaryEngine').textContent =
    activeEngine?.dataset.engine === 'google' ? 'Google Translate' : '免費'

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
   'translationEngine', 'selectedPlatform'],
  ({ translationApiKey, enabled, subtitleColor, displayMode, transcriptEnabled,
     transcriptLines = [], transcriptStorageFull, fontSize, fontFamily, bold,
     translationEngine, selectedPlatform }) => {

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

    if (transcriptEnabled === true) {
      transcriptToggle.classList.add('on')
      transcriptBody.classList.remove('hidden')
      updateTranscriptStats(transcriptLines, transcriptStorageFull === true)
    }

    selectEngine(translationEngine || 'free')
    if (selectedPlatform) selectPlatform(selectedPlatform)
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

// ── Live transcript stats ─────────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
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
  freeInfo.style.display     = engine === 'free'   ? ''     : 'none'
  googleConfig.style.display = engine === 'google' ? 'flex' : 'none'
  chrome.storage.local.set({ translationEngine: engine })
  updateSummaries()
}

engineBtns.forEach(btn => {
  btn.addEventListener('click', () => selectEngine(btn.dataset.engine))
})

// ── Platform picker ───────────────────────────────────────────────────────
function selectPlatform(id) {
  platformBtns.forEach(b => b.classList.toggle('active', b.dataset.platform === id))
  const name = [...platformBtns].find(b => b.dataset.platform === id)?.textContent ?? '未選擇'
  document.getElementById('summaryPlatform').textContent = name
  chrome.storage.local.set({ selectedPlatform: id })
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
