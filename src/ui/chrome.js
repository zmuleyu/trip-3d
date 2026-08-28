// UI chrome: left icon rail, flyout panel, layer buttons, toast.
import { nextLayerButtonAction } from './chromeState.js'
import { iconSvg } from './icons.js'
// Framework-free DOM components matching the mockup (dist/ui-mockup.html).
// Style lives in src/style.css (.ui-*).

// ---------------------------------------------------------------- rail
// items: [{ id, icon, label, badge?, disabled?, onSelect(id) }]
// settingsItem: { id, icon, label, onSelect(id) } pinned to bottom
export function createRail({ items, settingsItem }) {
  const el = document.createElement('nav')
  el.className = 'ui-rail'
  el.setAttribute('aria-label', '主要工具')
  const logo = document.createElement('div')
  logo.className = 'ui-rail-logo'
  logo.textContent = 'T3'
  el.appendChild(logo)

  const btns = new Map()
  const mkBtn = (item, extraClass = '') => {
    const b = document.createElement('button')
    b.className = `ui-rail-btn ${extraClass}`.trim()
    b.dataset.tab = item.id
    b.setAttribute('aria-label', item.label)
    b.innerHTML = `<span class="ico">${iconSvg(item.icon)}</span><span class="lbl">${item.label}</span>`
    if (item.badge) {
      const badge = document.createElement('span')
      badge.className = 'ui-rail-badge'
      badge.textContent = item.badge
      b.appendChild(badge)
    }
    if (item.disabled) b.classList.add('disabled')
    b.onclick = () => { if (!item.disabled) item.onSelect(item.id) }
    btns.set(item.id, b)
    return b
  }
  for (const it of items) el.appendChild(mkBtn(it))
  const spacer = document.createElement('div')
  spacer.className = 'ui-rail-spacer'
  el.appendChild(spacer)
  if (settingsItem) el.appendChild(mkBtn(settingsItem, 'ui-rail-gear'))

  document.body.appendChild(el)
  return {
    el,
    setActive(id) {
      for (const [k, b] of btns) b.classList.toggle('active', k === id)
    },
    clearActive() {
      for (const b of btns.values()) b.classList.remove('active')
    },
  }
}

// ---------------------------------------------------------------- flyout panel
// One panel host; content swapped per tab. Returns host + mount API.
export function createPanelHost({ onSummaryCustomize } = {}) {
  const el = document.createElement('section')
  el.className = 'ui-panel hidden'
  document.body.appendChild(el)
  let currentId = null
  let collapsed = false
  let sheetState = 'half'
  let drag = null
  let dragged = false
  const h = document.createElement('h2')
  h.className = 'ui-panel-titlebar'
  h.title = '拖动面板；双击恢复右侧停靠'
  const summary = document.createElement('span')
  summary.className = 'ui-panel-summary'
  const customize = document.createElement('button')
  customize.type = 'button'
  customize.className = 'ui-panel-customize'
  customize.innerHTML = `${iconSvg('settings')}<span>自定义</span>`
  customize.setAttribute('aria-label', '自定义行程摘要字段')
  customize.onclick = () => onSummaryCustomize?.()
  const chev = document.createElement('button')
  chev.className = 'ui-panel-chev'
  chev.innerHTML = iconSvg('close')
  chev.title = '收起/展开面板'
  const body = document.createElement('div')
  body.className = 'ui-panel-body'
  body.id = 'ui-panel-body'
  const grabber = document.createElement('button')
  grabber.type = 'button'
  grabber.className = 'ui-sheet-grabber'
  grabber.setAttribute('aria-label', '调整规划面板高度')
  grabber.innerHTML = '<span></span>'
  chev.setAttribute('aria-controls', body.id)
  const mobileQuery = globalThis.matchMedia?.('(max-width: 1023px)')
  const isMobileSheet = () => !!currentId && mobileQuery?.matches
  const sheetHeights = () => {
    const full = Math.max(220, window.innerHeight - 114)
    const half = Math.max(160, Math.min(full - 24, 470, window.innerHeight * 0.47))
    return { peek: Math.min(96, half - 24), half, full }
  }
  const sheetLabel = () => sheetState === 'peek' ? '展开规划面板' : sheetState === 'half' ? '展开到全屏' : '收起为摘要'
  const sheetStateLabel = () => ({ peek: '摘要', half: '半屏', full: '全屏' })[sheetState]
  const apply = () => {
    el.classList.toggle('collapsed', collapsed)
    el.dataset.sheetState = sheetState
    const mobile = isMobileSheet()
    chev.setAttribute('aria-expanded', String(mobile ? sheetState !== 'peek' : !collapsed))
    chev.setAttribute('aria-label', mobile ? sheetLabel() : (collapsed ? '展开面板' : '收起面板'))
    grabber.setAttribute('aria-label', `调整面板高度；当前${sheetStateLabel()}`)
  }
  const nextSheetState = () => ({ peek: 'half', half: 'full', full: 'peek' })[sheetState]
  const setSheetState = (next) => {
    if (!['peek', 'half', 'full'].includes(next)) return
    sheetState = next
    if (isMobileSheet()) collapsed = next === 'peek'
    el.style.removeProperty('--sheet-drag-height')
    el.classList.remove('dragging')
    apply()
  }
  chev.onclick = () => {
    if (isMobileSheet()) setSheetState(nextSheetState())
    else { collapsed = !collapsed; apply() }
  }
  const project = (velocity) => (velocity / 1000) * 0.99 / (1 - 0.99)
  const nearestSheetState = (height, velocity = 0) => {
    const heights = sheetHeights()
    const projected = height + project(velocity)
    return Object.entries(heights).reduce((best, entry) => Math.abs(entry[1] - projected) < Math.abs(best[1] - projected) ? entry : best)[0]
  }
  grabber.addEventListener('pointerdown', (event) => {
    if (!isMobileSheet()) return
    grabber.setPointerCapture?.(event.pointerId)
    const height = el.getBoundingClientRect().height
    drag = { pointerId: event.pointerId, startY: event.clientY, startHeight: height, history: [{ y: event.clientY, t: event.timeStamp }] }
    dragged = false
    el.classList.add('dragging')
    el.style.setProperty('--sheet-drag-height', `${height}px`)
  })
  const moveDrag = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    const heights = sheetHeights()
    const raw = drag.startHeight - (event.clientY - drag.startY)
    const clamped = Math.max(heights.peek - 24, Math.min(heights.full + 24, raw))
    dragged ||= Math.abs(event.clientY - drag.startY) > 8
    drag.history.push({ y: event.clientY, t: event.timeStamp })
    drag.history = drag.history.filter((sample) => event.timeStamp - sample.t <= 120)
    el.style.setProperty('--sheet-drag-height', `${clamped}px`)
  }
  const finishDrag = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    const samples = drag.history
    const first = samples[0]
    const last = samples[samples.length - 1] ?? first
    const dt = Math.max(1, last.t - first.t)
    const velocity = -((last.y - first.y) / dt) * 1000
    const height = el.getBoundingClientRect().height
    drag = null
    setSheetState(nearestSheetState(height, velocity))
  }
  document.addEventListener('pointermove', moveDrag)
  document.addEventListener('pointerup', finishDrag)
  document.addEventListener('pointercancel', finishDrag)
  grabber.onclick = () => {
    if (dragged) { dragged = false; return }
    if (isMobileSheet()) setSheetState(nextSheetState())
  }
  mobileQuery?.addEventListener?.('change', (event) => {
    if (event.matches && currentId && collapsed) sheetState = 'peek'
    if (!event.matches && currentId) {
      collapsed = false
      sheetState = 'half'
    }
    apply()
  })
  return {
    el,
    dragHandle: h,
    get currentId() { return currentId },
    get collapsed() { return collapsed },
    show(id, title, hint, contentEl) {
      currentId = id
      h.replaceChildren()
      h.append(document.createTextNode(title), summary, customize, chev)
      if (hint) {
        const s = document.createElement('span')
        s.className = 'ui-panel-hint'
        s.textContent = hint
        h.insertBefore(s, summary)
      }
      body.replaceChildren(contentEl)
      const fluidAffordances = [...el.querySelectorAll('[data-fluid-drag-handle], [data-fluid-resize-handle]')]
      el.replaceChildren(grabber, h, body, ...fluidAffordances)
      el.classList.remove('hidden')
      sheetState = 'half'
      apply()
    },
    setCollapsed(v) {
      collapsed = v
      if (isMobileSheet()) sheetState = v ? 'peek' : 'half'
      apply()
    },
    get sheetState() { return sheetState },
    setSheetState,
    // one-line state shown in the header even when collapsed
    setSummary(value) {
      summary.replaceChildren()
      const items = Array.isArray(value) ? value : value == null ? [] : [{ text: String(value) }]
      for (const item of items) {
        if (!item?.text) continue
        const span = document.createElement('span')
        span.dataset.field = item.id ?? ''
        span.textContent = item.text
        summary.appendChild(span)
      }
    },
    hide() {
      currentId = null
      el.classList.add('hidden')
    },
  }
}

// ---------------------------------------------------------------- layer buttons
// buttons: [{ id, icon, tip, initial, onToggle(id, on) }] → circular toggles, top-right
export function createLayerButtons({ buttons, onStateChange } = {}) {
  const el = document.createElement('div')
  el.className = 'ui-layers'
  el.id = 'ui-layer-tools'
  const map = new Map()
  for (const b of buttons) {
    const btn = document.createElement('button')
    btn.className = 'ui-layer-btn'
    btn.innerHTML = iconSvg(b.icon)
    btn.dataset.id = b.id
    const tip = document.createElement('span')
    tip.className = 'ui-layer-tip'
    tip.textContent = b.tip
    btn.appendChild(tip)
    let on = !!b.initial
    btn.classList.toggle('on', on)
    let panelOpen = false
    btn.setAttribute('aria-label', b.tip)
    btn.setAttribute('aria-pressed', String(on))
    if (b.repeatOpensPanel) btn.setAttribute('aria-expanded', 'false')
    btn.onclick = () => {
      const next = nextLayerButtonAction({ on, panelOpen, repeatOpensPanel: !!b.repeatOpensPanel })
      on = next.on
      panelOpen = next.panelOpen
      btn.classList.toggle('on', on)
      btn.classList.toggle('panel-open', panelOpen)
      btn.setAttribute('aria-pressed', String(on))
      if (b.repeatOpensPanel) btn.setAttribute('aria-expanded', String(panelOpen))
      if (next.toggled) b.onToggle(b.id, on)
      else b.onPanelToggle?.(b.id, panelOpen)
      onStateChange?.(b.id, on)
    }
    map.set(b.id, {
      btn,
      isOn: () => on,
      isPanelOpen: () => panelOpen,
      set(v, { notify = false } = {}) {
        const changed = on !== !!v
        on = !!v
        if (!on) panelOpen = false
        btn.classList.toggle('on', on)
        btn.classList.toggle('panel-open', panelOpen)
        btn.setAttribute('aria-pressed', String(on))
        if (b.repeatOpensPanel) btn.setAttribute('aria-expanded', String(panelOpen))
        if (notify && changed) b.onToggle(b.id, on)
        onStateChange?.(b.id, on)
      },
      setPanelOpen(v) { panelOpen = !!v; btn.classList.toggle('panel-open', panelOpen); if (b.repeatOpensPanel) btn.setAttribute('aria-expanded', String(panelOpen)) },
    })
    el.appendChild(btn)
  }
  document.body.appendChild(el)
  return { el, get: (id) => map.get(id) }
}

// ---------------------------------------------------------------- toast
export function createToast() {
  const el = document.createElement('div')
  el.className = 'ui-toast hidden'
  document.body.appendChild(el)
  let timer = null
  return {
    show(text, ms = 2200) {
      el.textContent = text
      el.classList.remove('hidden')
      clearTimeout(timer)
      timer = setTimeout(() => el.classList.add('hidden'), ms)
    },
  }
}
