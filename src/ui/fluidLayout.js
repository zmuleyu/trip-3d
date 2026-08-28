const STORAGE_VERSION = 1
const DEFAULT_STORAGE_KEY = 'trip3d.fluidLayout.v1'
const DRAG_THRESHOLD = 9
const EDGE_MARGIN = 12

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null

export function rubberband(overshoot, dimension, constant = 0.55) {
  if (!Number.isFinite(overshoot) || !Number.isFinite(dimension) || dimension <= 0) return 0
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

export function clampFluidState(value, bounds, limits = {}) {
  const minWidth = Math.max(1, finite(limits.minWidth) ?? 220)
  const minHeight = Math.max(1, finite(limits.minHeight) ?? 96)
  const maxWidth = Math.max(minWidth, Math.min(finite(limits.maxWidth) ?? bounds.width, bounds.width))
  const maxHeight = Math.max(minHeight, Math.min(finite(limits.maxHeight) ?? bounds.height, bounds.height))
  const width = Math.max(minWidth, Math.min(maxWidth, finite(value?.width) ?? minWidth))
  const height = Math.max(minHeight, Math.min(maxHeight, finite(value?.height) ?? minHeight))
  return {
    x: Math.max(bounds.left, Math.min(bounds.right - width, finite(value?.x) ?? bounds.left)),
    y: Math.max(bounds.top, Math.min(bounds.bottom - height, finite(value?.y) ?? bounds.top)),
    width,
    height,
  }
}

export function normalizeStoredLayout(value, knownIds = []) {
  if (!value || value.version !== STORAGE_VERSION || !value.cards || typeof value.cards !== 'object') return {}
  const allowed = new Set(knownIds)
  const cards = {}
  for (const [id, card] of Object.entries(value.cards)) {
    if (!allowed.has(id)) continue
    const next = { x: finite(card?.x), y: finite(card?.y), width: finite(card?.width), height: finite(card?.height) }
    if (Object.values(next).every(Number.isFinite)) cards[id] = next
  }
  return cards
}

export function dragIntentExceeded(start, point, threshold = DRAG_THRESHOLD) {
  return Math.hypot(point.x - start.x, point.y - start.y) >= threshold
}

export function measureLayoutSafeArea({ viewport, cards = [], base = {}, margin = EDGE_MARGIN } = {}) {
  const width = finite(viewport?.width) ?? 0
  const height = finite(viewport?.height) ?? 0
  const safe = {
    top: finite(base.top) ?? 96,
    right: finite(base.right) ?? 88,
    bottom: finite(base.bottom) ?? 24,
    left: finite(base.left) ?? 88,
  }
  for (const card of cards) {
    const rect = card?.rect
    if (!rect || rect.width <= 0 || rect.height <= 0 || card.hidden) continue
    if (card.id === 'inspector') {
      const edge = (rect.left + rect.right) / 2 <= width / 2 ? 'left' : 'right'
      const occupied = edge === 'left' ? rect.right : width - rect.left
      safe[edge] = Math.max(safe[edge], occupied + margin)
    }
    else if (card.id === 'summary' || card.id === 'profile') {
      const edge = (rect.top + rect.bottom) / 2 <= height / 2 ? 'top' : 'bottom'
      const occupied = edge === 'top' ? rect.bottom : height - rect.top
      safe[edge] = Math.max(safe[edge], occupied + margin)
    }
    else {
      const distances = {
        left: rect.right,
        right: width - rect.left,
        top: rect.bottom,
        bottom: height - rect.top,
      }
      const edge = Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0]
      if (edge) safe[edge] = Math.max(safe[edge], distances[edge] + margin)
    }
  }
  const horizontalMax = Math.max(48, width / 2 - 24)
  const verticalMax = Math.max(48, height / 2 - 24)
  safe.left = Math.min(safe.left, horizontalMax)
  safe.right = Math.min(safe.right, horizontalMax)
  safe.top = Math.min(safe.top, verticalMax)
  safe.bottom = Math.min(safe.bottom, verticalMax)
  return safe
}

function isVisible(element) {
  if (!element?.isConnected || element.hidden || element.classList.contains('hidden')) return false
  const style = globalThis.getComputedStyle?.(element)
  return style?.display !== 'none' && style?.visibility !== 'hidden'
}

export function createFluidLayout({
  storage = globalThis.sessionStorage,
  storageKey = DEFAULT_STORAGE_KEY,
  mediaQuery = globalThis.matchMedia?.('(min-width: 1024px)'),
  viewport = () => ({ width: globalThis.innerWidth, height: globalThis.innerHeight }),
  documentObject = globalThis.document,
  windowObject = globalThis.window,
  onChange,
} = {}) {
  const records = new Map()
  const storedRaw = (() => {
    try { return JSON.parse(storage?.getItem?.(storageKey) ?? 'null') } catch { return null }
  })()
  let storedCards = {}
  let z = 40
  let interaction = null
  let frame = null

  const enabled = () => mediaQuery?.matches !== false
  const boundsFor = (record) => {
    const size = viewport()
    const reserved = record.options.reserved ?? { top: 96, right: 88, bottom: 24, left: 88 }
    return {
      left: reserved.left,
      top: reserved.top,
      right: Math.max(reserved.left + record.options.minWidth, size.width - reserved.right),
      bottom: Math.max(reserved.top + record.options.minHeight, size.height - reserved.bottom),
      width: Math.max(record.options.minWidth, size.width - reserved.left - reserved.right),
      height: Math.max(record.options.minHeight, size.height - reserved.top - reserved.bottom),
    }
  }
  const limitsFor = (record) => ({
    minWidth: record.options.minWidth,
    minHeight: record.options.minHeight,
    maxWidth: typeof record.options.maxWidth === 'function' ? record.options.maxWidth(viewport()) : record.options.maxWidth,
    maxHeight: typeof record.options.maxHeight === 'function' ? record.options.maxHeight(viewport()) : record.options.maxHeight,
  })
  const apply = (record) => {
    if (!record.state || !enabled()) {
      record.element.dataset.fluidEnabled = 'false'
      record.element.dataset.fluidAnchored = 'false'
      return
    }
    record.element.dataset.fluidEnabled = 'true'
    const size = viewport()
    const anchored = record.options.anchor === 'right' && Math.abs(record.state.x + record.state.width - size.width) <= 1
    record.element.dataset.fluidAnchored = String(anchored)
    record.element.style.setProperty('--fluid-x', `${record.state.x}px`)
    record.element.style.setProperty('--fluid-y', `${record.state.y}px`)
    record.element.style.setProperty('--fluid-width', `${record.state.width}px`)
    record.element.style.setProperty('--fluid-height', `${record.state.height}px`)
  }
  const write = () => {
    const cards = {}
    for (const [id, record] of records) if (record.state) cards[id] = record.state
    try { storage?.setItem?.(storageKey, JSON.stringify({ version: STORAGE_VERSION, cards })) } catch { /* optional session preference */ }
  }
  const cardRects = () => [...records].map(([id, record]) => ({ id, rect: record.element.getBoundingClientRect(), hidden: !isVisible(record.element) }))
  const safeArea = () => measureLayoutSafeArea({ viewport: viewport(), cards: cardRects() })
  const publish = () => {
    const safe = safeArea()
    const root = documentObject?.documentElement
    for (const edge of ['top', 'right', 'bottom', 'left']) root?.style?.setProperty(`--trip-safe-${edge}`, `${Math.round(safe[edge])}px`)
    documentObject?.dispatchEvent?.(new CustomEvent('trip3d:layoutchange', { detail: safe }))
    onChange?.(safe)
  }
  const defaultState = (record) => {
    const value = typeof record.options.defaultState === 'function'
      ? record.options.defaultState(viewport(), record.element)
      : record.options.defaultState
    return clampFluidState(value, boundsFor(record), limitsFor(record))
  }
  const activate = (record) => {
    if (!enabled()) {
      apply(record)
      publish()
      return
    }
    if (record.state || (!isVisible(record.element) && record.options.deferUntilVisible)) return
    const rect = record.element.getBoundingClientRect()
    const presented = rect.width > 0 && rect.height > 0
      ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      : null
    record.state = avoidCollisions(record, clampFluidState(record.saved ?? (record.options.deferUntilVisible ? presented : null) ?? defaultState(record), boundsFor(record), limitsFor(record)))
    apply(record)
    publish()
  }
  const bringToFront = (record) => { record.element.style.zIndex = String(++z) }
  const rubberState = (record, next) => {
    const bounds = boundsFor(record)
    const limits = limitsFor(record)
    const clamped = clampFluidState(next, bounds, limits)
    const width = next.width ?? clamped.width
    const height = next.height ?? clamped.height
    const applyAxis = (raw, min, max, dimension) => raw < min ? min + rubberband(raw - min, dimension) : raw > max ? max + rubberband(raw - max, dimension) : raw
    return {
      x: applyAxis(next.x, bounds.left, bounds.right - width, bounds.width),
      y: applyAxis(next.y, bounds.top, bounds.bottom - height, bounds.height),
      width: applyAxis(width, limits.minWidth, Math.min(limits.maxWidth, bounds.width), bounds.width),
      height: applyAxis(height, limits.minHeight, Math.min(limits.maxHeight, bounds.height), bounds.height),
    }
  }
  const avoidCollisions = (record, value) => {
    let next = clampFluidState(value, boundsFor(record), limitsFor(record))
    const gap = 12
    for (const other of records.values()) {
      if (other === record || !other.state || !isVisible(other.element)) continue
      const overlapX = Math.min(next.x + next.width, other.state.x + other.state.width) - Math.max(next.x, other.state.x)
      const overlapY = Math.min(next.y + next.height, other.state.y + other.state.height) - Math.max(next.y, other.state.y)
      if (overlapX <= 0 || overlapY <= 0) continue
      const candidates = [
        { ...next, x: other.state.x - next.width - gap },
        { ...next, x: other.state.x + other.state.width + gap },
        { ...next, y: other.state.y - next.height - gap },
        { ...next, y: other.state.y + other.state.height + gap },
      ].map((candidate) => clampFluidState(candidate, boundsFor(record), limitsFor(record)))
      next = candidates.sort((a, b) => Math.hypot(a.x - next.x, a.y - next.y) - Math.hypot(b.x - next.x, b.y - next.y))[0]
    }
    return next
  }
  const cancelAnimation = () => { if (frame != null) cancelAnimationFrame(frame); frame = null }
  const settle = (record, target, velocity = { x: 0, y: 0, width: 0, height: 0 }) => {
    cancelAnimation()
    target = avoidCollisions(record, target)
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      record.state = target; apply(record); write(); publish(); return
    }
    const current = { ...record.state }
    const v = { ...velocity }
    let last = performance.now()
    const stiffness = 240
    const damping = 2 * Math.sqrt(stiffness)
    const step = (now) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000)); last = now
      let moving = false
      for (const key of ['x', 'y', 'width', 'height']) {
        const delta = target[key] - current[key]
        const acceleration = stiffness * delta - damping * v[key]
        v[key] += acceleration * dt
        current[key] += v[key] * dt
        moving ||= Math.abs(delta) > 0.35 || Math.abs(v[key]) > 4
      }
      record.state = { ...current }; apply(record); publish()
      if (moving) frame = requestAnimationFrame(step)
      else { frame = null; record.state = target; apply(record); write(); publish() }
    }
    frame = requestAnimationFrame(step)
  }
  const pointerDown = (record, mode, event) => {
    if (!enabled() || event.button > 0) return
    if (mode === 'drag' && event.target?.closest?.('button, input, select, textarea, a, [contenteditable="true"]')) return
    activate(record)
    if (!record.state) return
    cancelAnimation()
    bringToFront(record)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const rect = record.element.getBoundingClientRect()
    interaction = {
      record, mode, pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      grab: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      state: { ...record.state }, active: mode === 'resize',
      resizeFromLeft: mode === 'resize' && record.options.anchor === 'right' && record.element.dataset.fluidAnchored === 'true',
      history: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }],
    }
    record.element.classList.add('fluid-interacting')
    if (mode === 'resize') event.preventDefault()
  }
  const pointerMove = (event) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return
    const point = { x: event.clientX, y: event.clientY }
    if (!interaction.active && dragIntentExceeded(interaction.start, point)) interaction.active = true
    if (!interaction.active) return
    const { record, mode, state, grab, resizeFromLeft } = interaction
    const next = mode === 'drag'
      ? { ...state, x: event.clientX - grab.x, y: event.clientY - grab.y }
      : resizeFromLeft
        ? { ...state, x: state.x + event.clientX - interaction.start.x, width: state.width - event.clientX + interaction.start.x, height: state.height + event.clientY - interaction.start.y }
        : { ...state, width: state.width + event.clientX - interaction.start.x, height: state.height + event.clientY - interaction.start.y }
    record.state = rubberState(record, next)
    apply(record)
    event.preventDefault()
    interaction.history.push({ x: event.clientX, y: event.clientY, t: event.timeStamp })
    interaction.history = interaction.history.filter((sample) => event.timeStamp - sample.t <= 120)
    publish()
  }
  const pointerEnd = (event) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return
    const { record, active, history, mode, resizeFromLeft } = interaction
    record.element.classList.remove('fluid-interacting')
    interaction = null
    if (!active) return
    const first = history[0]
    const last = history.at(-1) ?? first
    const seconds = Math.max(0.001, (last.t - first.t) / 1000)
    const velocity = mode === 'drag'
      ? { x: (last.x - first.x) / seconds, y: (last.y - first.y) / seconds, width: 0, height: 0 }
      : resizeFromLeft
        ? { x: (last.x - first.x) / seconds, y: 0, width: -((last.x - first.x) / seconds), height: (last.y - first.y) / seconds }
        : { x: 0, y: 0, width: (last.x - first.x) / seconds, height: (last.y - first.y) / seconds }
    settle(record, record.state, velocity)
  }
  const clampAll = ({ reset = false } = {}) => {
    cancelAnimation()
    if (!enabled()) {
      for (const record of records.values()) {
        if (reset) record.state = null
        apply(record)
      }
      write(); publish(); return
    }
    for (const record of records.values()) {
      if (reset) record.state = defaultState(record)
      else if (!record.state) {
        record.state = avoidCollisions(record, record.saved
          ? clampFluidState(record.saved, boundsFor(record), limitsFor(record))
          : defaultState(record))
      }
      else if (record.state) record.state = avoidCollisions(record, record.state)
      apply(record)
    }
    write(); publish()
  }
  const resetRecord = (record) => {
    cancelAnimation()
    record.saved = null
    record.state = defaultState(record)
    apply(record)
    write()
    publish()
  }

  const onMediaChange = () => { clampAll(); for (const record of records.values()) apply(record) }
  mediaQuery?.addEventListener?.('change', onMediaChange)
  windowObject?.addEventListener?.('resize', () => clampAll())
  documentObject?.addEventListener?.('pointermove', pointerMove)
  documentObject?.addEventListener?.('pointerup', pointerEnd)
  documentObject?.addEventListener?.('pointercancel', pointerEnd)

  return {
    register(element, options = {}) {
      const id = options.id
      if (!element || !id || records.has(id)) return records.get(id)?.api
      storedCards = normalizeStoredLayout(storedRaw, [...records.keys(), id])
      const record = {
        element,
        saved: storedCards[id],
        state: null,
        options: {
          minWidth: options.minWidth ?? 220,
          minHeight: options.minHeight ?? 96,
          maxWidth: options.maxWidth ?? 720,
          maxHeight: options.maxHeight ?? 640,
          reserved: options.reserved,
          defaultState: options.defaultState,
          deferUntilVisible: !!options.deferUntilVisible,
          anchor: options.anchor,
        },
      }
      records.set(id, record)
      element.classList.add('ui-fluid-surface')
      element.dataset.fluidId = id
      const grip = options.dragHandle ?? documentObject.createElement('span')
      if (!options.dragHandle) {
        grip.className = 'ui-fluid-grip'
        grip.setAttribute('aria-hidden', 'true')
        element.appendChild(grip)
      }
      grip.dataset.fluidDragHandle = ''
      grip.addEventListener('pointerdown', (event) => pointerDown(record, 'drag', event))
      grip.addEventListener('dblclick', (event) => {
        if (!enabled() || event.target?.closest?.('button, input, select, textarea, a, [contenteditable="true"]')) return
        event.preventDefault()
        resetRecord(record)
      })
      const resize = documentObject.createElement('span')
      resize.className = 'ui-fluid-resize'
      resize.dataset.fluidResizeHandle = ''
      resize.setAttribute('aria-hidden', 'true')
      resize.addEventListener('pointerdown', (event) => pointerDown(record, 'resize', event))
      element.appendChild(resize)
      const observer = globalThis.MutationObserver ? new MutationObserver(() => {
        if (!enabled()) { apply(record); publish(); return }
        activate(record)
        if (record.state) { record.state = clampFluidState(record.state, boundsFor(record), limitsFor(record)); apply(record); publish() }
      }) : null
      observer?.observe(element, { attributes: true, attributeFilter: ['class', 'hidden'], childList: true, subtree: true })
      record.api = { refresh: () => { activate(record); clampAll() }, reset: () => resetRecord(record), destroy: () => observer?.disconnect() }
      activate(record)
      return record.api
    },
    reset() { try { storage?.removeItem?.(storageKey) } catch { /* optional session preference */ }; clampAll({ reset: true }) },
    refresh(id) { const record = records.get(id); if (record) { activate(record); clampAll() } },
    bringToFront(id) { const record = records.get(id); if (record) bringToFront(record) },
    getSafeArea: safeArea,
    getState(id) { return records.get(id)?.state ? { ...records.get(id).state } : null },
    isEnabled: enabled,
  }
}
