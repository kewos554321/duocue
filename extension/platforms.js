const PLATFORMS = [
  {
    id: 'hbomax',
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    textSelector: '[class*="TextCue-Fuse-Web-Play"]',
    textJoin: '\n',
    playerSelector: '[data-testid="playerContainer"]',
    hideNativeSelector: '[class*="CaptionWindow-Fuse-Web-Play"]',
    getTitle: () => document.title.replace(/[⁨⁩]/g, '').replace(/\s*[•·]\s*HBO Max$/i, '').trim(),
  },
  {
    id: 'netflix',
    name: 'Netflix',
    hostname: 'www.netflix.com',
    watchMatcher: () => location.pathname.startsWith('/watch/'),
    textSelector: '.player-timedtext-text-container',
    textJoin: '\n',
    playerSelector: '.watch-video--player-view',
    hideNativeSelector: '.player-timedtext',
    getTitle: (() => {
      let cached = ''
      return () => {
        const live = document.querySelector('[data-uia="video-title"]')?.textContent.trim()
          || document.title.replace(/\s*\|\s*Netflix$/i, '').trim()
        if (live) cached = live
        return cached
      }
    })(),
  },
  {
    id: 'youtube',
    name: 'YouTube',
    hostname: 'www.youtube.com',
    watchMatcher: () => location.pathname === '/watch',
    textSelector: '.caption-window .ytp-caption-segment',
    textJoin: ' ',
    playerSelector: '#movie_player',
    hideNativeSelector: '.ytp-caption-window-container, .caption-window',
    getTitle: () => document.title.replace(/\s*-\s*YouTube$/i, '').trim(),
  },
]
