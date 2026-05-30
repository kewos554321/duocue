const input = document.getElementById('apiKey')
const status = document.getElementById('status')

chrome.storage.local.get('translationApiKey', ({ translationApiKey }) => {
  if (translationApiKey) input.value = translationApiKey
})

document.getElementById('save').addEventListener('click', () => {
  const key = input.value.trim()
  chrome.storage.local.set({ translationApiKey: key }, () => {
    status.textContent = key ? '✅ Key saved' : '🗑 Key cleared'
    setTimeout(() => { status.textContent = '' }, 2000)
  })
})
