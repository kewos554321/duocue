const toggle      = document.getElementById('toggle')
const apiKeyInput = document.getElementById('apiKey')
const eyeBtn      = document.getElementById('eyeBtn')
const keyStatus   = document.getElementById('keyStatus')
const saveBtn     = document.getElementById('save')
const colorPicker = document.getElementById('colorPicker')
const customSwatch = document.getElementById('customSwatch')
const swatches    = document.querySelectorAll('.color-swatch[data-color]')

// ── Init ──────────────────────────────────────────────────────────────────
chrome.storage.local.get(['translationApiKey', 'enabled', 'subtitleColor'], (data) => {
  // Toggle
  if (data.enabled !== false) toggle.classList.add('on')

  // API Key
  if (data.translationApiKey) {
    apiKeyInput.value = data.translationApiKey
    setKeyStatus(true)
  } else {
    setKeyStatus(false)
  }

  // Color
  selectColor(data.subtitleColor || '#FFD700')
})

// ── Toggle ────────────────────────────────────────────────────────────────
toggle.addEventListener('click', () => {
  const isOn = toggle.classList.toggle('on')
  chrome.storage.local.set({ enabled: isOn })
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

function setKeyStatus(isSet) {
  keyStatus.textContent = isSet ? '✓ Set' : '⚠ Not set'
  keyStatus.className = 'field-status ' + (isSet ? 'set' : 'unset')
}
