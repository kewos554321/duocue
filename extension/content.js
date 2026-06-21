async function detectPlatform() {
  const { selectedPlatform } = await chrome.storage.local.get('selectedPlatform')
  if (selectedPlatform && selectedPlatform !== 'auto') {
    return PLATFORMS.find(p => p.id === selectedPlatform) ?? null
  }
  const platform = PLATFORMS.find(p => location.hostname === p.hostname)
  if (!platform) return null
  if (platform.watchMatcher && !platform.watchMatcher()) return null
  return platform
}

function createOverlay() {
  if (document.getElementById('duocue-overlay')) return
  const div = document.createElement('div')
  div.id = 'duocue-overlay'
  div.style.fontSize   = `${fontSize}px`
  div.style.fontFamily = fontFamily
  div.style.fontWeight = bold ? 'bold' : 'normal'
  div.style.background = `rgba(0, 0, 0, ${bgOpacity / 100})`
  div.style.bottom     = `${subtitleBottom}%`
  div.style.left       = `${subtitleLeft}%`
  document.body.appendChild(div)
  createTooltip()
  setupWordInteraction(div)
}

let subtitleColor = '#FFD700'
let fontSize   = 18
let fontFamily = 'Arial, sans-serif'
let bold       = false
let bgOpacity  = 75
let translationEngine = 'free'
let subtitleBottom = 10
let subtitleLeft   = 50
let sourceLanguage = 'en'

function sanitizeColor(c) {
  return /^#[0-9A-Fa-f]{3,8}$|^[a-zA-Z]+$/.test(c) ? c : '#FFD700'
}

chrome.storage.local.get('subtitleColor', ({ subtitleColor: c }) => {
  if (c) subtitleColor = sanitizeColor(c)
})

chrome.storage.local.get(['fontSize', 'fontFamily', 'bold'], ({ fontSize: fs, fontFamily: ff, bold: b }) => {
  if (fs != null) fontSize   = fs
  if (ff != null) fontFamily = ff
  if (b  != null) bold       = b
})

chrome.storage.local.get('bgOpacity', ({ bgOpacity: op }) => {
  if (op != null) bgOpacity = op
})

chrome.storage.local.get(['subtitleBottom', 'subtitleLeft'], ({ subtitleBottom: b, subtitleLeft: l }) => {
  if (b != null) subtitleBottom = b
  if (l != null) subtitleLeft   = l
  const el = document.getElementById('duocue-overlay')
  if (el) {
    el.style.bottom = `${subtitleBottom}%`
    el.style.left   = `${subtitleLeft}%`
  }
})

chrome.storage.local.get('translationEngine', ({ translationEngine: e }) => {
  if (e) translationEngine = e
})

chrome.storage.local.get('sourceLanguage', ({ sourceLanguage: l }) => {
  if (l) sourceLanguage = l
})

let _wordStatus = {}
chrome.storage.local.get('wordStatus', ({ wordStatus: ws }) => {
  if (ws) _wordStatus = ws
})

// ── Experimental mode ──────────────────────────────────────────────────────
let experimentalEnabled = false
let _expApiEndpoint = ''
let _expApiKey = ''

chrome.storage.local.get(['experimentalMode', 'apiEndpoint', 'apiKey'], ({ experimentalMode, apiEndpoint, apiKey }) => {
  experimentalEnabled = !!experimentalMode
  _expApiEndpoint = apiEndpoint || ''
  _expApiKey = apiKey || ''
  if (experimentalEnabled && _expApiEndpoint && _expApiKey) {
    fetchWordCache()
    setInterval(fetchWordCache, 60000)
  }
})

async function fetchWordCache() {
  try {
    const res = await fetch(`${_expApiEndpoint}/words`, {
      headers: { Authorization: `Bearer ${_expApiKey}` }
    })
    if (!res.ok) return
    const { words } = await res.json()
    _wordStatus = {}
    words.forEach(({ word, status }) => { _wordStatus[word] = status })
    chrome.storage.local.set({ wordStatus: _wordStatus })
    console.log('[DuoCue] word cache loaded:', words.length, 'words')
  } catch (e) {
    console.warn('[DuoCue] failed to fetch word cache', e)
  }
}

let displayMode = 'both'
chrome.storage.local.get('displayMode', ({ displayMode: m }) => {
  if (m) displayMode = m
})

let lastEnglish = null
let lastChinese = null

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  if (changes.subtitleColor) {
    subtitleColor = sanitizeColor(changes.subtitleColor.newValue)
    document.querySelectorAll('.duocue-zh').forEach(el => {
      el.style.color = subtitleColor
    })
  }
  if (changes.displayMode) {
    displayMode = changes.displayMode.newValue
    if (lastEnglish) updateOverlay(lastEnglish, lastChinese)
  }
  if (changes.fontSize) {
    fontSize = changes.fontSize.newValue
    const el = document.getElementById('duocue-overlay')
    if (el) el.style.fontSize = `${fontSize}px`
  }
  if (changes.fontFamily) {
    fontFamily = changes.fontFamily.newValue
    const el = document.getElementById('duocue-overlay')
    if (el) el.style.fontFamily = fontFamily
  }
  if (changes.bold) {
    bold = changes.bold.newValue
    const el = document.getElementById('duocue-overlay')
    if (el) el.style.fontWeight = bold ? 'bold' : 'normal'
  }
  if (changes.bgOpacity) {
    bgOpacity = changes.bgOpacity.newValue
    const el = document.getElementById('duocue-overlay')
    if (el) el.style.background = `rgba(0, 0, 0, ${bgOpacity / 100})`
  }
  if (changes.subtitleBottom) {
    subtitleBottom = changes.subtitleBottom.newValue
    const el = document.getElementById('duocue-overlay')
    if (el) el.style.bottom = `${subtitleBottom}%`
  }
  if (changes.subtitleLeft) {
    subtitleLeft = changes.subtitleLeft.newValue
    const el = document.getElementById('duocue-overlay')
    if (el) el.style.left = `${subtitleLeft}%`
  }
  if (changes.translationEngine) {
    translationEngine = changes.translationEngine.newValue
  }
  if (changes.sourceLanguage) {
    sourceLanguage = changes.sourceLanguage.newValue
  }
  if (changes.wordStatus) {
    _wordStatus = changes.wordStatus.newValue ?? {}
  }
  if (changes.experimentalMode) {
    experimentalEnabled = !!changes.experimentalMode.newValue
  }
})

// ── HTML escaping ─────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Word segmentation ─────────────────────────────────────────────────────
function buildWordSpans(text) {
  try {
    const seg = new Intl.Segmenter(sourceLanguage, { granularity: 'word' })
    return [...seg.segment(text)].map(({ segment, isWordLike, index }) => {
      if (!isWordLike) return escapeHtml(segment)
      const esc = escapeHtml(segment)
      const statusClass = _wordStatus[segment.toLowerCase()] === 'learning' ? ' duocue-word--learning'
                        : _wordStatus[segment.toLowerCase()] === 'learned'  ? ' duocue-word--learned'
                        : ''
      return `<span class="duocue-word${statusClass}" data-word="${esc}" data-s="${index}" data-e="${index + segment.length}">${esc}</span>`
    }).join('')
  } catch {
    let offset = 0
    return text.split(/(\s+)/).map(part => {
      const s = offset
      offset += part.length
      if (!part || /^\s+$/.test(part)) return part
      const esc = escapeHtml(part)
      const statusClass = _wordStatus[part.toLowerCase()] === 'learning' ? ' duocue-word--learning'
                        : _wordStatus[part.toLowerCase()] === 'learned'  ? ' duocue-word--learned'
                        : ''
      return `<span class="duocue-word${statusClass}" data-word="${esc}" data-s="${s}" data-e="${offset}">${esc}</span>`
    }).join('')
  }
}

// ── Overlay ───────────────────────────────────────────────────────────────
function updateOverlay(english, chinese) {
  const overlay = document.getElementById('duocue-overlay')
  if (!overlay) return

  if (!english) {
    overlay.innerHTML = ''
    overlay.style.display = 'none'
    hideTooltip()
    return
  }

  const showEn = displayMode === 'both' || displayMode === 'original'
  const showZh = (displayMode === 'both' || displayMode === 'translation') && chinese

  if (!showEn && !showZh) {
    overlay.innerHTML = ''
    overlay.style.display = 'none'
    hideTooltip()
    return
  }

  // Rebuild English word spans only when the text actually changed — preserves span classes
  let enEl = overlay.querySelector('.duocue-en')
  if (showEn) {
    if (!enEl || enEl.dataset.src !== english) {
      const next = document.createElement('div')
      next.className = 'duocue-en'
      next.dataset.src = english
      next.innerHTML = buildWordSpans(english)
      if (enEl) overlay.replaceChild(next, enEl)
      else overlay.insertBefore(next, overlay.firstChild)
    }
  } else if (enEl) {
    enEl.remove()
  }

  // Update Chinese line without touching the English node
  let zhEl = overlay.querySelector('.duocue-zh')
  if (showZh) {
    if (!zhEl) {
      zhEl = document.createElement('div')
      zhEl.className = 'duocue-zh'
      overlay.appendChild(zhEl)
    }
    zhEl.style.color = subtitleColor
    zhEl.textContent = chinese
  } else if (zhEl) {
    zhEl.remove()
  }

  overlay.style.display = 'block'
}

// ── Tooltip ───────────────────────────────────────────────────────────────
const _lookupCache = new Map()
let _hoverTimer = null
let _currentHoveredWord = null

function createTooltip() {
  if (document.getElementById('duocue-tooltip')) return
  const tip = document.createElement('div')
  tip.id = 'duocue-tooltip'
  document.body.appendChild(tip)
  tip.addEventListener('click', e => {
    const btn = e.target.closest('.duocue-tt-btn')
    if (!btn) return
    const word = btn.dataset.word
    if (!word) return
    const status = btn.classList.contains('duocue-tt-btn--learn') ? 'learning' : 'learned'
    setWordStatus(word, status)
  })
  tip.addEventListener('mouseenter', () => clearTimeout(_hoverTimer))
  tip.addEventListener('mouseleave', () => {
    _hoverTimer = setTimeout(hideTooltip, 200)
  })
}

function hideTooltip() {
  clearTimeout(_hoverTimer)
  _currentHoveredWord = null
  const tip = document.getElementById('duocue-tooltip')
  if (tip) tip.classList.remove('visible')
}

function showTooltip(wordEl, translation, pos) {
  const tip = document.getElementById('duocue-tooltip')
  if (!tip) return
  if (!translation && !pos) return

  const word = wordEl.dataset.word || ''
  const status = _wordStatus[word.toLowerCase()]
  const posHtml = pos ? `<span class="duocue-tt-pos">${escapeHtml(pos)}</span>` : ''
  const statusBadge = status === 'learning'
    ? `<span class="duocue-tt-badge duocue-tt-badge--learning">學習中</span>`
    : status === 'learned'
    ? `<span class="duocue-tt-badge duocue-tt-badge--learned">已懂</span>`
    : ''

  tip.innerHTML = `
    <div class="duocue-tt-header">
      <span class="duocue-tt-word">${escapeHtml(word)}</span>
      ${posHtml}${statusBadge}
    </div>
    <div class="duocue-tt-divider"></div>
    <div class="duocue-tt-trans">${escapeHtml(translation || '—')}</div>
    <div class="duocue-tt-actions">
      <button class="duocue-tt-btn duocue-tt-btn--learn" data-word="${escapeHtml(word)}">📙 學習中</button>
      <button class="duocue-tt-btn duocue-tt-btn--know"  data-word="${escapeHtml(word)}">✓ 已懂</button>
    </div>`

  tip.style.visibility = 'hidden'
  tip.classList.add('visible')

  requestAnimationFrame(() => {
    const wordRect = wordEl.getBoundingClientRect()
    const tipRect  = tip.getBoundingClientRect()
    let top  = wordRect.top - tipRect.height - 8
    let left = wordRect.left + wordRect.width / 2 - tipRect.width / 2
    if (top < 8) top = wordRect.bottom + 8
    left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, left))
    tip.style.top  = `${top}px`
    tip.style.left = `${left}px`
    tip.style.visibility = ''
  })
}

function setWordStatus(word, status) {
  const key = word.toLowerCase()
  _wordStatus[key] = status
  chrome.storage.local.set({ wordStatus: _wordStatus })
  if (experimentalEnabled && _expApiEndpoint && _expApiKey) {
    fetch(`${_expApiEndpoint}/words/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_expApiKey}` },
      body: JSON.stringify({ status })
    }).catch(e => console.warn('[DuoCue] failed to sync word status', e))
  }
  document.querySelectorAll(`#duocue-overlay .duocue-word`).forEach(span => {
    if ((span.dataset.word || '').toLowerCase() === key) {
      span.classList.toggle('duocue-word--learning', status === 'learning')
      span.classList.toggle('duocue-word--learned',  status === 'learned')
    }
  })
  // Update badge in open tooltip
  const tip = document.getElementById('duocue-tooltip')
  if (tip?.classList.contains('visible')) {
    const badge = tip.querySelector('.duocue-tt-badge')
    if (badge) {
      badge.className = status === 'learning'
        ? 'duocue-tt-badge duocue-tt-badge--learning'
        : 'duocue-tt-badge duocue-tt-badge--learned'
      badge.textContent = status === 'learning' ? '學習中' : '已懂'
    } else {
      const header = tip.querySelector('.duocue-tt-header')
      if (header) {
        const newBadge = document.createElement('span')
        newBadge.className = status === 'learning'
          ? 'duocue-tt-badge duocue-tt-badge--learning'
          : 'duocue-tt-badge duocue-tt-badge--learned'
        newBadge.textContent = status === 'learning' ? '學習中' : '已懂'
        header.appendChild(newBadge)
      }
    }
  }
}

// ── Word lookup ───────────────────────────────────────────────────────────
async function fetchPos(word) {
  if (sourceLanguage !== 'en') return null
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    )
    if (!res.ok) return null
    const data = await res.json()
    return data[0]?.meanings[0]?.partOfSpeech ?? null
  } catch {
    return null
  }
}

async function lookupWord(word) {
  const key = word.toLowerCase()
  if (_lookupCache.has(key)) return _lookupCache.get(key)
  const [translation, pos] = await Promise.all([
    translate(word).catch(() => null),
    fetchPos(word),
  ])
  const result = { translation, pos }
  _lookupCache.set(key, result)
  return result
}

// ── Selection helpers ─────────────────────────────────────────────────────
function getAllWordSpans() {
  return Array.from(document.querySelectorAll('#duocue-overlay .duocue-word'))
}

function clearHighlights() {
  document.querySelectorAll('#duocue-overlay .duocue-word--range').forEach(s => {
    s.classList.remove('duocue-word--range')
  })
}

function renderLineBoxes(spans) {
  clearLineBoxes()
  if (spans.length === 0) return

  // Group spans by text line (cluster by vertical centre)
  const groups = []
  spans.forEach(span => {
    const r  = span.getBoundingClientRect()
    const cy = r.top + r.height / 2
    const g  = groups.find(g => Math.abs(g.cy - cy) <= r.height * 0.6)
    if (g) {
      g.rects.push(r)
      g.cy = (g.cy * g.rects.length + cy) / (g.rects.length + 1)
    } else {
      groups.push({ cy, rects: [r] })
    }
  })

  groups.forEach(({ rects }) => {
    const left   = Math.min(...rects.map(r => r.left))
    const right  = Math.max(...rects.map(r => r.right))
    const top    = Math.min(...rects.map(r => r.top))
    const bottom = Math.max(...rects.map(r => r.bottom))
    const box = document.createElement('div')
    box.className = 'duocue-line-box'
    box.style.left   = `${left   - 2}px`
    box.style.top    = `${top    - 2}px`
    box.style.width  = `${right - left + 4}px`
    box.style.height = `${bottom - top + 4}px`
    document.body.appendChild(box)
  })
}

function clearLineBoxes() {
  document.querySelectorAll('.duocue-line-box').forEach(b => b.remove())
}

function nearestWordSpan(x, y) {
  const el = document.elementFromPoint(x, y)
  if (el?.closest?.('.duocue-word')) return el.closest('.duocue-word')
  // Cursor is between words — snap to the span whose rect is closest
  let nearest = null, minDist = Infinity
  getAllWordSpans().forEach(span => {
    const r  = span.getBoundingClientRect()
    const cx = Math.max(r.left, Math.min(x, r.right))
    const cy = Math.max(r.top,  Math.min(y, r.bottom))
    const d  = Math.hypot(x - cx, y - cy)
    if (d < minDist) { minDist = d; nearest = span }
  })
  return nearest
}

function getWordsBetween(startSpan, endSpan) {
  const spans = getAllWordSpans()
  const si = spans.indexOf(startSpan)
  const ei = spans.indexOf(endSpan)
  if (si === -1) return endSpan ? [endSpan] : []
  const lo = Math.min(si, ei >= 0 ? ei : si)
  const hi = Math.max(si, ei >= 0 ? ei : si)
  return spans.slice(lo, hi + 1)
}

function getPhraseFromSpans(spans) {
  if (spans.length === 0) return ''
  const sorted = [...spans].sort((a, b) => parseInt(a.dataset.s || 0) - parseInt(b.dataset.s || 0))
  const first = sorted[0]
  const last  = sorted[sorted.length - 1]
  if (lastEnglish && first.dataset.s !== undefined && last.dataset.e !== undefined) {
    return lastEnglish.slice(parseInt(first.dataset.s), parseInt(last.dataset.e))
  }
  return sorted.map(s => s.dataset.word).join(' ')
}

// ── Word interaction ──────────────────────────────────────────────────────
function setupWordInteraction(overlay) {
  let startSpan = null
  let startX = null, startY = null
  let isDragging = false

  // Hover tooltip (suppressed while selecting)
  overlay.addEventListener('mouseover', e => {
    if (startSpan) return
    const wordEl = e.target.closest('.duocue-word')
    if (!wordEl) return
    const word = wordEl.dataset.word
    if (!word || word === _currentHoveredWord) return
    clearTimeout(_hoverTimer)
    _currentHoveredWord = word
    _hoverTimer = setTimeout(async () => {
      const { translation, pos } = await lookupWord(word)
      if (_currentHoveredWord === word) showTooltip(wordEl, translation, pos)
    }, 300)
  })

  overlay.addEventListener('mouseout', e => {
    if (startSpan) return
    const fromWord = e.target.closest('.duocue-word')
    if (!fromWord) return
    const toEl = e.relatedTarget
    if (toEl?.closest?.('.duocue-word') || toEl?.closest?.('#duocue-tooltip')) return
    _hoverTimer = setTimeout(hideTooltip, 200)
  })

  overlay.addEventListener('mousedown', e => {
    if (!e.target.closest('.duocue-en')) return
    e.preventDefault()
    startSpan = nearestWordSpan(e.clientX, e.clientY)
    startX = e.clientX
    startY = e.clientY
    isDragging = false
    hideTooltip()
    clearTimeout(_hoverTimer)
    _currentHoveredWord = null
  })

  document.addEventListener('mousemove', e => {
    if (!startSpan) return
    if (!isDragging && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return
    isDragging = true
    const cur      = nearestWordSpan(e.clientX, e.clientY)
    const selected = getWordsBetween(startSpan, cur)
    getAllWordSpans().forEach(s => s.classList.toggle('duocue-word--range', selected.includes(s)))
    renderLineBoxes(selected)
  })

  document.addEventListener('mouseup', async e => {
    if (!startSpan) return
    const start = startSpan
    startSpan = null
    const wasDragging = isDragging
    isDragging = false
    clearLineBoxes()

    const end = nearestWordSpan(e.clientX, e.clientY)

    if (!wasDragging || !end || end === start) {
      // Single click — show tooltip immediately
      clearHighlights()
      const word = start.dataset.word
      if (!word) return
      const { translation, pos } = await lookupWord(word)
      showTooltip(start, translation, pos)
    } else {
      // Range drag — show phrase translation
      const selected = getWordsBetween(start, end)
      const phrase = getPhraseFromSpans(selected)
      if (!phrase.trim()) { clearHighlights(); return }
      selected.forEach(s => s.classList.remove('duocue-word--range'))
      const translation = await translate(phrase).catch(() => null)
      if (translation) {
        const sorted = [...selected].sort((a, b) => parseInt(a.dataset.s || 0) - parseInt(b.dataset.s || 0))
        const anchor = sorted[0]
        const tip = document.getElementById('duocue-tooltip')
        if (tip) {
          tip.innerHTML = `<div class="duocue-tt-trans" style="font-size:13px">${escapeHtml(phrase)}</div>
            <div class="duocue-tt-divider"></div>
            <div class="duocue-tt-trans">${escapeHtml(translation)}</div>`
          tip.style.visibility = 'hidden'
          tip.classList.add('visible')
          requestAnimationFrame(() => {
            const wordRect = anchor.getBoundingClientRect()
            const tipRect  = tip.getBoundingClientRect()
            let top  = wordRect.top - tipRect.height - 8
            let left = wordRect.left + wordRect.width / 2 - tipRect.width / 2
            if (top < 8) top = wordRect.bottom + 8
            left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, left))
            tip.style.top  = `${top}px`
            tip.style.left = `${left}px`
            tip.style.visibility = ''
          })
          setTimeout(hideTooltip, 3000)
        }
      }
    }
  })
}

let _pollInterval = null

function stopPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval)
    _pollInterval = null
  }
  hideTooltip()
  clearLineBoxes()
  clearHighlights()
  document.getElementById('duocue-overlay')?.remove()
  document.getElementById('duocue-hide-native')?.remove()
  lastEnglish = null
  lastChinese = null
}

function injectHideNativeCSS(platform) {
  const id = 'duocue-hide-native'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `${platform.hideNativeSelector} { display: none !important; }`
  document.head.appendChild(style)
}

function extractText(platform) {
  const nodes = document.querySelectorAll(platform.textSelector)
  return Array.from(nodes)
    .map(n => n.textContent.trim())
    .filter(Boolean)
    .join(platform.textJoin ?? '\n')
}

async function translateFree(text) {
  const { sourceLanguage, targetLanguage } = await chrome.storage.local.get(
    ['sourceLanguage', 'targetLanguage']
  )
  const src = sourceLanguage || 'en'
  const tgt = targetLanguage || 'zh-TW'
  if (src === tgt) return null
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`
    )
    const data = await res.json()
    if (data.responseStatus !== 200) return null
    return data.responseData?.translatedText ?? null
  } catch {
    return null
  }
}

async function translateGoogle(text) {
  const { translationApiKey, targetLanguage } = await chrome.storage.local.get(
    ['translationApiKey', 'targetLanguage']
  )
  if (!translationApiKey) return null
  const tgt = targetLanguage || 'zh-TW'
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${translationApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: tgt, format: 'text' }),
      }
    )
    const data = await res.json()
    return data?.data?.translations?.[0]?.translatedText ?? null
  } catch {
    return null
  }
}

async function translate(text) {
  return translationEngine === 'google'
    ? translateGoogle(text)
    : translateFree(text)
}

function startPolling(platform) {
  createOverlay()
  injectHideNativeCSS(platform)

  function syncOverlayParent() {
    const overlay = document.getElementById('duocue-overlay')
    if (!overlay) return
    const player = platform.playerSelector
      ? document.querySelector(platform.playerSelector)
      : null
    const target = player || document.body
    if (overlay.parentElement !== target) target.appendChild(overlay)
  }

  let transcriptEnabled = false
  let transcriptStartTime = null
  let transcriptBuffer = []
  let transcriptFull = false
  let flushInProgress = false

  chrome.storage.local.get(['transcriptEnabled', 'transcriptStorageFull'], (result) => {
    transcriptEnabled = result.transcriptEnabled === true
    transcriptFull = result.transcriptStorageFull === true
    if (transcriptEnabled) transcriptStartTime = Date.now()
  })

  function elapsed() {
    if (!transcriptStartTime) return '00:00:00'
    const s = Math.floor((Date.now() - transcriptStartTime) / 1000)
    const h = String(Math.floor(s / 3600)).padStart(2, '0')
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const sec = String(s % 60).padStart(2, '0')
    return `${h}:${m}:${sec}`
  }

  async function flushTranscriptBuffer() {
    if (transcriptBuffer.length === 0 || flushInProgress) return
    flushInProgress = true
    try {
      const toWrite = transcriptBuffer.splice(0)
      const { transcriptLines = [] } = await chrome.storage.local.get('transcriptLines')
      const updated = [...transcriptLines, ...toWrite]
      await chrome.storage.local.set({ transcriptLines: updated })
      const bytes = await chrome.storage.local.getBytesInUse('transcriptLines')
      if (bytes > 9 * 1024 * 1024) {
        transcriptFull = true
        await chrome.storage.local.set({ transcriptStorageFull: true })
      }
    } catch (e) {
      transcriptFull = true
      chrome.storage.local.set({ transcriptStorageFull: true })
    } finally {
      flushInProgress = false
    }
  }

  function recordSubtitle(text) {
    transcriptBuffer.push({ t: elapsed(), text: text.replace(/\n/g, ' ') })
    if (transcriptBuffer.length >= 3) flushTranscriptBuffer()
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return
    if (changes.transcriptEnabled) {
      transcriptEnabled = changes.transcriptEnabled.newValue === true
      if (transcriptEnabled) {
        transcriptStartTime = Date.now()
        transcriptFull = false
      } else {
        flushTranscriptBuffer()
      }
    }
    if (changes.transcriptClearedAt) {
      transcriptStartTime = Date.now()
      transcriptBuffer = []
      transcriptFull = false
    }
    if (changes.transcriptFlushAt) {
      flushTranscriptBuffer()
    }
  })

  window.addEventListener('beforeunload', () => {
    flushTranscriptBuffer()
  })

  let translateTimer = null

  _pollInterval = setInterval(async () => {
    syncOverlayParent()
    platform.getTitle?.()
    const { enabled } = await chrome.storage.local.get('enabled')
    if (enabled === false) {
      updateOverlay(null, null)
      document.getElementById('duocue-hide-native')?.remove()
      lastEnglish = null
      lastChinese = null
      return
    }
    injectHideNativeCSS(platform)

    const english = extractText(platform)

    if (english === lastEnglish) return
    lastEnglish = english

    if (!english) {
      updateOverlay(null, null)
      lastEnglish = null
      lastChinese = null
      return
    }

    updateOverlay(english, null)
    if (transcriptEnabled && !transcriptFull) recordSubtitle(english)

    clearTimeout(translateTimer)
    translateTimer = setTimeout(async () => {
      const chinese = await translate(english)
      if (english !== lastEnglish) return
      lastChinese = chinese
      updateOverlay(english, chinese)
    }, 150)
  }, 200)
}

let _currentUrl = ''

async function tryInit() {
  if (location.href === _currentUrl) return
  _currentUrl = location.href
  stopPolling()
  const platform = await detectPlatform()
  chrome.storage.local.set({ detectedPlatform: platform?.id ?? null })
  if (platform) startPolling(platform)
}

const _origPush = history.pushState.bind(history)
history.pushState = (...args) => { _origPush(...args); tryInit() }

const _origReplace = history.replaceState.bind(history)
history.replaceState = (...args) => { _origReplace(...args); tryInit() }

window.addEventListener('popstate', tryInit)

tryInit()

// ── Experimental: toast notification ──────────────────────────────────────
function showToast(message, action) {
  let toast = document.getElementById('duocue-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'duocue-toast'
    document.body.appendChild(toast)
  }

  toast.innerHTML = ''
  const span = document.createElement('span')
  span.textContent = message
  toast.appendChild(span)

  if (action) {
    const btn = document.createElement('button')
    btn.textContent = action.label
    btn.style.cssText = 'margin-left:10px;background:none;border:none;color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;padding:0;'
    btn.addEventListener('click', () => {
      action.onClick()
      clearTimeout(toast._timer)
      toast.classList.remove('duocue-toast-show')
      toast.classList.add('duocue-toast-hide')
    })
    toast.appendChild(btn)
  }

  toast.style.pointerEvents = action ? 'auto' : 'none'
  toast.classList.remove('duocue-toast-hide')
  toast.classList.add('duocue-toast-show')
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => {
    toast.classList.remove('duocue-toast-show')
    toast.classList.add('duocue-toast-hide')
  }, action ? 6000 : 1500)
}

// ── Experimental: S key — save current subtitle sentence ──────────────────
document.addEventListener('keydown', async (e) => {
  if (!experimentalEnabled) return
  if (e.key !== 's' && e.key !== 'S') return
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
  if (!lastEnglish) return
  if (!_expApiEndpoint || !_expApiKey) return

  const textToSave = lastEnglish
  const translation = lastChinese ?? await translate(textToSave).catch(() => null)

  const platform = await detectPlatform()
  const video = document.querySelector('video')
  const timestampS = video ? Math.floor(video.currentTime) : 0

  showToast('✓ 已儲存')
  try {
    const res = await fetch(`${_expApiEndpoint}/sentences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_expApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        platform: platform?.id ?? 'unknown',
        videoUrl: location.href,
        title: platform?.getTitle?.() || '',
        text: textToSave,
        translation,
        timestampS
      })
    })
    if (res.status === 401) {
      showToast('× Token 已過期', {
        label: '重新登入 →',
        onClick: () => window.open('https://duocue-web.pages.dev', '_blank'),
      })
    } else if (!res.ok) {
      showToast('× 儲存失敗')
    }
  } catch {
    showToast('× 儲存失敗')
  }
})
