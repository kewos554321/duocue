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

function updateOverlay(text) {
  const overlay = document.getElementById('duocue-overlay')
  if (!overlay) return
  if (text) {
    overlay.textContent = text
    overlay.style.display = 'block'
  } else {
    overlay.textContent = ''
    overlay.style.display = 'none'
  }
}
