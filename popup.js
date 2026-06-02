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
const segBtns          = document.querySelectorAll('.seg-btn')
const fontSizeRange    = document.getElementById('fontSizeRange')
const fontSizeLabel    = document.getElementById('fontSizeLabel')
const fontFamilySelect = document.getElementById('fontFamilySelect')
const boldToggle       = document.getElementById('boldToggle')

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
  ['translationApiKey', 'enabled', 'subtitleColor', 'displayMode', 'transcriptEnabled', 'transcriptLines', 'transcriptStorageFull', 'fontSize', 'fontFamily', 'bold'],
  ({ translationApiKey, enabled, subtitleColor, displayMode, transcriptEnabled, transcriptLines = [], transcriptStorageFull, fontSize, fontFamily, bold }) => {
    if (enabled !== false) {
      toggle.classList.add('on')
    }

    if (translationApiKey) {
      apiKeyInput.value = translationApiKey
    }
    setKeyStatus(!!translationApiKey)

    selectColor(subtitleColor || '#FFD700')

    // Display Mode
    selectMode(displayMode || 'both')

    const fs = fontSize ?? 18
    fontSizeRange.value       = fs
    fontSizeLabel.textContent = `${fs}pt`

    fontFamilySelect.value = fontFamily || 'Arial, sans-serif'

    if (bold === true) boldToggle.classList.add('on')

    if (transcriptEnabled === true) {
      transcriptToggle.classList.add('on')
      transcriptBody.classList.remove('hidden')
      updateTranscriptStats(transcriptLines, transcriptStorageFull === true)
    }
  }
)

// ── Toggle ────────────────────────────────────────────────────────────────
toggle.addEventListener('click', () => {
  const isOn = toggle.classList.toggle('on')
  chrome.storage.local.set({ enabled: isOn })
})

// ── Transcript toggle ─────────────────────────────────────────────────────
transcriptToggle.addEventListener('click', () => {
  const isOn = transcriptToggle.classList.toggle('on')
  transcriptBody.classList.toggle('hidden', !isOn)
  chrome.storage.local.set({ transcriptEnabled: isOn })
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
  })
})

// ── Font size ─────────────────────────────────────────────────────────────
fontSizeRange.addEventListener('input', () => {
  const size = Number(fontSizeRange.value)
  fontSizeLabel.textContent = `${size}pt`
  chrome.storage.local.set({ fontSize: size })
})

// ── Font family ───────────────────────────────────────────────────────────
fontFamilySelect.addEventListener('change', () => {
  chrome.storage.local.set({ fontFamily: fontFamilySelect.value })
})

// ── Bold ──────────────────────────────────────────────────────────────────
boldToggle.addEventListener('click', () => {
  const isOn = boldToggle.classList.toggle('on')
  chrome.storage.local.set({ bold: isOn })
})

// ── Eye button ────────────────────────────────────────────────────────────
eyeBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password'
  apiKeyInput.type = isPassword ? 'text' : 'password'
  eyeBtn.textContent = isPassword ? '🙈' : '👁'
})

// ── Save Key ──────────────────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim()
  const action = key
    ? chrome.storage.local.set.bind(null, { translationApiKey: key })
    : chrome.storage.local.remove.bind(null, 'translationApiKey')
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
  })
})

customSwatch.addEventListener('click', () => colorPicker.click())

colorPicker.addEventListener('input', () => {
  const color = colorPicker.value
  selectColor(color, true)
  chrome.storage.local.set({ subtitleColor: color })
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
