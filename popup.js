const toggle = document.getElementById('toggle')
const apiKeyInput = document.getElementById('apiKey')
const eyeBtn = document.getElementById('eyeBtn')
const saveBtn = document.getElementById('saveBtn')
const keyStatus = document.getElementById('keyStatus')

// Load saved state on open
chrome.storage.local.get(['translationApiKey', 'enabled'], ({ translationApiKey, enabled }) => {
  if (enabled === false) {
    toggle.classList.remove('on')
  }

  if (translationApiKey) {
    apiKeyInput.value = translationApiKey
    keyStatus.textContent = '✓ Set'
    keyStatus.className = 'key-status set'
  }
})

// Toggle: enable / disable DuoCue
toggle.addEventListener('click', () => {
  const isOn = toggle.classList.toggle('on')
  chrome.storage.local.set({ enabled: isOn })
})

// Eye button: show / hide API key
let keyVisible = false
eyeBtn.addEventListener('click', () => {
  keyVisible = !keyVisible
  apiKeyInput.type = keyVisible ? 'text' : 'password'
  eyeBtn.textContent = keyVisible ? '🙈' : '👁'
})

// Save button: persist key + visual feedback
saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim()
  chrome.storage.local.set({ translationApiKey: key }, () => {
    keyStatus.textContent = key ? '✓ Set' : '⚠ Not set'
    keyStatus.className = key ? 'key-status set' : 'key-status not-set'

    saveBtn.textContent = '✓ Saved'
    saveBtn.classList.add('saved')
    setTimeout(() => {
      saveBtn.textContent = 'Save Key'
      saveBtn.classList.remove('saved')
    }, 1500)
  })
})
