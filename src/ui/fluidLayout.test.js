// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clampFluidState, createFluidLayout, dragIntentExceeded, measureLayoutSafeArea, normalizeStoredLayout, rubberband } from './fluidLayout.js'

beforeEach(() => {
  document.body.replaceChildren()
  sessionStorage.clear()
  vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(() => callback(performance.now()), 1))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})

describe('fluid layout math', () => {
  it('keeps grab hysteresis at nine pixels', () => {
    expect(dragIntentExceeded({ x: 10, y: 10 }, { x: 17, y: 14 })).toBe(false)
    expect(dragIntentExceeded({ x: 10, y: 10 }, { x: 19, y: 10 })).toBe(true)
  })

  it('clamps size and position to the safe viewport', () => {
    expect(clampFluidState({ x: -20, y: 800, width: 900, height: 30 }, { left: 80, top: 90, right: 920, bottom: 700, width: 840, height: 610 }, { minWidth: 316, maxWidth: 520, minHeight: 180, maxHeight: 560 }))
      .toEqual({ x: 80, y: 520, width: 520, height: 180 })
  })

  it('uses progressive resistance outside an edge', () => {
    expect(rubberband(60, 800)).toBeGreaterThan(0)
    expect(rubberband(60, 800)).toBeLessThan(60)
  })

  it('falls back from bad or wrong-version session state', () => {
    expect(normalizeStoredLayout({ version: 99, cards: { inspector: { x: 1, y: 2, width: 3, height: 4 } } }, ['inspector'])).toEqual({})
    expect(normalizeStoredLayout({ version: 1, cards: { inspector: { x: 'bad', y: 2, width: 3, height: 4 } } }, ['inspector'])).toEqual({})
  })

  it('derives route-fit padding from visible occupied surfaces', () => {
    const safe = measureLayoutSafeArea({ viewport: { width: 1440, height: 900 }, cards: [
      { id: 'inspector', rect: { left: 1000, right: 1328, top: 112, bottom: 620, width: 328, height: 508 } },
      { id: 'summary', rect: { left: 116, right: 616, top: 782, bottom: 876, width: 500, height: 94 } },
    ] })
    expect(safe.right).toBe(452)
    expect(safe.bottom).toBe(130)
  })

  it('moves inspector padding to the left edge when the inspector is dragged left', () => {
    const safe = measureLayoutSafeArea({ viewport: { width: 1440, height: 900 }, cards: [
      { id: 'inspector', rect: { left: 88, right: 416, top: 112, bottom: 620, width: 328, height: 508 } },
    ] })
    expect(safe.left).toBe(428)
    expect(safe.right).toBe(88)
  })

  it.each([
    ['summary', { left: 116, right: 616, top: 112, bottom: 206, width: 500, height: 94 }, 218],
    ['profile', { left: 116, right: 876, top: 150, bottom: 340, width: 760, height: 190 }, 352],
  ])('moves %s padding to the top edge when the instrument is dragged up', (id, rect, expectedTop) => {
    const safe = measureLayoutSafeArea({ viewport: { width: 1440, height: 900 }, cards: [{ id, rect }] })
    expect(safe.top).toBe(expectedTop)
    expect(safe.bottom).toBe(24)
  })
})

describe('fluid layout controller', () => {
  const pointer = (target, type, { x, y, id = 1, time = 0 } = {}) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    for (const [key, value] of Object.entries({ clientX: x, clientY: y, pointerId: id, button: 0, timeStamp: time })) {
      Object.defineProperty(event, key, { configurable: true, value })
    }
    target.dispatchEvent(event)
  }

  function create({ mobile = false, stored } = {}) {
    if (stored) sessionStorage.setItem('trip3d.fluidLayout.v1', JSON.stringify(stored))
    const media = { matches: !mobile, addEventListener: vi.fn() }
    const layout = createFluidLayout({ mediaQuery: media, viewport: () => ({ width: 1200, height: 800 }) })
    const element = document.createElement('section')
    document.body.appendChild(element)
    element.getBoundingClientRect = () => ({ left: 0, top: 0, right: 328, bottom: 400, width: 328, height: 400 })
    layout.register(element, { id: 'inspector', minWidth: 316, maxWidth: 520, minHeight: 220, maxHeight: 560, defaultState: { x: 760, y: 100, width: 328, height: 400 } })
    return { layout, element }
  }

  it('disables free drag and resize below 1024px', () => {
    const { layout, element } = create({ mobile: true })
    expect(layout.isEnabled()).toBe(false)
    expect(element.dataset.fluidEnabled).toBe('false')
  })

  it('does not clamp saved desktop placement through a mobile viewport', () => {
    sessionStorage.setItem('trip3d.fluidLayout.v1', JSON.stringify({ version: 1, cards: { inspector: { x: 760, y: 100, width: 328, height: 400 } } }))
    let onMediaChange
    const media = { matches: false, addEventListener: vi.fn((_event, listener) => { onMediaChange = listener }) }
    const layout = createFluidLayout({ mediaQuery: media, viewport: () => ({ width: media.matches ? 1200 : 390, height: media.matches ? 800 : 844 }) })
    const element = document.createElement('section')
    document.body.appendChild(element)
    element.getBoundingClientRect = () => ({ left: 0, top: 0, right: 328, bottom: 400, width: 328, height: 400 })
    layout.register(element, { id: 'inspector', minWidth: 316, maxWidth: 520, minHeight: 220, maxHeight: 560, defaultState: { x: 760, y: 100, width: 328, height: 400 } })
    expect(layout.getState('inspector')).toBeNull()
    media.matches = true
    onMediaChange()
    expect(layout.getState('inspector')).toEqual({ x: 760, y: 100, width: 328, height: 400 })
  })

  it('preserves desktop placement when mobile DOM mutations request a refresh', async () => {
    let onMediaChange
    const media = { matches: true, addEventListener: vi.fn((_event, listener) => { onMediaChange = listener }) }
    const layout = createFluidLayout({
      mediaQuery: media,
      viewport: () => ({ width: media.matches ? 1200 : 390, height: media.matches ? 800 : 844 }),
    })
    const element = document.createElement('section')
    document.body.appendChild(element)
    element.getBoundingClientRect = () => ({ left: 760, top: 100, right: 1088, bottom: 500, width: 328, height: 400 })
    layout.register(element, {
      id: 'inspector', minWidth: 316, maxWidth: 520, minHeight: 220, maxHeight: 560,
      defaultState: { x: 760, y: 100, width: 328, height: 400 },
    })

    media.matches = false
    onMediaChange()
    element.appendChild(document.createElement('div'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    media.matches = true
    onMediaChange()

    expect(layout.getState('inspector')).toEqual({ x: 760, y: 100, width: 328, height: 400 })
  })

  it('resets the session layout to its safe default', () => {
    const { layout } = create({ stored: { version: 1, cards: { inspector: { x: 200, y: 200, width: 500, height: 500 } } } })
    expect(layout.getState('inspector').width).toBe(500)
    layout.reset()
    expect(layout.getState('inspector')).toEqual({ x: 760, y: 100, width: 328, height: 400 })
    expect(JSON.parse(sessionStorage.getItem('trip3d.fluidLayout.v1')).version).toBe(1)
  })

  it('preserves the grab offset after the drag threshold and ignores ordinary controls', () => {
    const { layout, element } = create()
    element.getBoundingClientRect = () => {
      const state = layout.getState('inspector')
      return { left: state.x, top: state.y, right: state.x + state.width, bottom: state.y + state.height, width: state.width, height: state.height }
    }
    const button = document.createElement('button')
    element.appendChild(button)
    pointer(button, 'pointerdown', { x: 780, y: 120, time: 0 })
    pointer(document, 'pointermove', { x: 900, y: 220, time: 16 })
    expect(layout.getState('inspector').x).toBe(760)

    const grip = element.querySelector('[data-fluid-drag-handle]')
    pointer(grip, 'pointerdown', { x: 780, y: 120, time: 20 })
    pointer(document, 'pointermove', { x: 786, y: 124, time: 30 })
    expect(layout.getState('inspector').x).toBe(760)
    pointer(document, 'pointermove', { x: 800, y: 220, time: 40 })
    expect(layout.getState('inspector').x).toBe(780)
    expect(layout.getState('inspector').y).toBe(200)
  })

  it('clamps a bad stored card to the safe viewport', () => {
    const { layout } = create({ stored: { version: 1, cards: { inspector: { x: -900, y: 9000, width: 9000, height: 3 } } } })
    expect(layout.getState('inspector')).toEqual({ x: 88, y: 556, width: 520, height: 220 })
  })

  it('settles resize gestures within configured minimum and maximum sizes', () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }))
    const { layout, element } = create()
    const resize = element.querySelector('[data-fluid-resize-handle]')
    pointer(resize, 'pointerdown', { x: 1088, y: 500, time: 0 })
    pointer(document, 'pointermove', { x: 1900, y: 1400, time: 16 })
    pointer(document, 'pointerup', { x: 1900, y: 1400, time: 24 })
    expect(layout.getState('inspector').width).toBe(520)
    expect(layout.getState('inspector').height).toBe(560)
  })

  it('uses the inspector titlebar as a 1:1 drag region and restores right anchoring on double click', () => {
    const media = { matches: true, addEventListener: vi.fn() }
    const layout = createFluidLayout({ mediaQuery: media, viewport: () => ({ width: 1200, height: 800 }) })
    const element = document.createElement('section')
    const titlebar = document.createElement('h2')
    const close = document.createElement('button')
    titlebar.append('线路规划', close)
    element.appendChild(titlebar)
    document.body.appendChild(element)
    element.getBoundingClientRect = () => {
      const state = layout.getState('inspector') ?? { x: 840, y: 88, width: 360, height: 480 }
      return { left: state.x, top: state.y, right: state.x + state.width, bottom: state.y + state.height, width: state.width, height: state.height }
    }
    layout.register(element, {
      id: 'inspector', dragHandle: titlebar, anchor: 'right', reserved: { top: 88, right: 0, bottom: 24, left: 88 },
      minWidth: 316, maxWidth: 520, minHeight: 240, maxHeight: 560,
      defaultState: { x: 840, y: 88, width: 360, height: 480 },
    })
    expect(element.dataset.fluidAnchored).toBe('true')

    pointer(close, 'pointerdown', { x: 1170, y: 110, time: 0 })
    pointer(document, 'pointermove', { x: 900, y: 200, time: 16 })
    expect(layout.getState('inspector').x).toBe(840)

    pointer(titlebar, 'pointerdown', { x: 900, y: 110, time: 20 })
    pointer(document, 'pointermove', { x: 700, y: 210, time: 40 })
    expect(layout.getState('inspector')).toMatchObject({ x: 640, y: 188 })
    expect(element.dataset.fluidAnchored).toBe('false')

    titlebar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    expect(layout.getState('inspector')).toEqual({ x: 840, y: 88, width: 360, height: 480 })
    expect(element.dataset.fluidAnchored).toBe('true')

    const resize = element.querySelector('[data-fluid-resize-handle]')
    pointer(resize, 'pointerdown', { x: 840, y: 568, time: 60 })
    pointer(document, 'pointermove', { x: 800, y: 608, time: 80 })
    expect(layout.getState('inspector')).toMatchObject({ x: 800, width: 400, height: 520 })
    expect(element.dataset.fluidAnchored).toBe('true')
  })
})
