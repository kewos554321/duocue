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
