const PLATFORMS = [
  {
    id: 'hbomax',
    name: 'HBO Max',
    hostname: 'play.hbomax.com',
    textSelector: '[class*="TextCue-Fuse-Web-Play"]',
    textJoin: '\n',
    playerSelector: '[data-testid="playerContainer"]',
    hideNativeSelector: '[class*="CaptionWindow-Fuse-Web-Play"]',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    hostname: 'www.netflix.com',
    textSelector: '.player-timedtext-text-container',
    textJoin: '\n',
    playerSelector: '.watch-video--player-view',
    hideNativeSelector: '.player-timedtext',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    hostname: 'www.youtube.com',
    textSelector: '.ytp-caption-segment',
    textJoin: ' ',
    playerSelector: '#movie_player',
    hideNativeSelector: '.ytp-caption-window-container',
  },
]
