// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLayerButtons, createPanelHost, createRail } from './chrome.js'

beforeEach(() => { document.body.replaceChildren() })
afterEach(() => { vi.unstubAllGlobals() })

describe('layer button accessibility state', () => {
  it('reports layer state separately from its panel expansion state', () => {
    const onToggle = vi.fn()
    const onPanelToggle = vi.fn()
    const layers = createLayerButtons({ buttons: [{ id: 'admin', icon: '🏛', tip: '行政区划', initial: false, repeatOpensPanel: true, onToggle, onPanelToggle }] })
    const button = layers.get('admin').btn
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    button.click()
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    button.click()
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('can apply a controlled layer value and notify the shared state seam', () => {
    const onToggle = vi.fn()
    const onStateChange = vi.fn()
    const layers = createLayerButtons({ buttons: [{ id: 'contour', icon: 'contour', tip: '等高线', initial: true, onToggle }], onStateChange })
    layers.get('contour').set(false, { notify: true })
    expect(onToggle).toHaveBeenCalledWith('contour', false)
    expect(onStateChange).toHaveBeenCalledWith('contour', false)
    expect(layers.get('contour').btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('groups the layer controls beneath map display, base map, and overlay headings', () => {
    const layers = createLayerButtons({ buttons: [
      { id: 'roads', group: 'base', icon: 'roads', tip: '路网', initial: false, onToggle: vi.fn() },
      { id: 'contour', group: 'overlay', icon: 'contour', tip: '等高线', initial: true, onToggle: vi.fn() },
    ] })
    expect(layers.el.getAttribute('aria-label')).toBe('地图显示')
    expect(layers.el.textContent).toContain('底图')
    expect(layers.el.textContent).toContain('叠加信息')
    expect(layers.get('roads').btn.textContent).toContain('路网')
  })
})

describe('rail accessibility', () => {
  it('gives every icon-first destination a stable accessible name', () => {
    const rail = createRail({
      items: [
        { id: 'planning', icon: 'planning', label: '规划', onSelect: vi.fn() },
        { id: 'library', icon: 'library', label: '线路库', onSelect: vi.fn() },
      ],
      settingsItem: { id: 'settings', icon: 'settings', label: '设置', onSelect: vi.fn() },
    })
    expect(rail.el.getAttribute('aria-label')).toBe('主要工具')
    expect([...rail.el.querySelectorAll('button')].map((button) => button.getAttribute('aria-label')))
      .toEqual(['规划', '线路库', '设置'])
  })
})

describe('panel collapse accessibility state', () => {
  const pointer = (target, type, { y, id = 1, time = 0 }) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    for (const [key, value] of Object.entries({ clientY: y, pointerId: id, timeStamp: time })) Object.defineProperty(event, key, { configurable: true, value })
    target.dispatchEvent(event)
  }
  it('keeps each inspector single-purpose without nested category tabs', () => {
    const panel = createPanelHost()
    panel.show('weather', '沿途天气', null, document.createElement('div'))
    expect(panel.el.querySelector('.ui-panel-tabs')).toBeNull()
    expect(panel.el.querySelector('h2').textContent).toContain('沿途天气')
    expect(panel.dragHandle).toBe(panel.el.querySelector('.ui-panel-titlebar'))
    expect(panel.dragHandle.title).toContain('双击')
  })

  it('keeps aria-expanded synchronized with the panel body', () => {
    const panel = createPanelHost()
    panel.show('planning', '线路规划', null, document.createElement('div'))
    const button = panel.el.querySelector('.ui-panel-chev')
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('aria-label')).toBe('收起面板')
    expect(button.getAttribute('aria-controls')).toBe('ui-panel-body')
    button.click()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-label')).toBe('展开面板')
    panel.setCollapsed(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('cycles the mobile planning sheet through half, full, and summary states', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const panel = createPanelHost()
    panel.show('planning', '线路规划', null, document.createElement('div'))
    const button = panel.el.querySelector('.ui-panel-chev')
    expect(panel.sheetState).toBe('half')
    button.click()
    expect(panel.sheetState).toBe('full')
    expect(panel.el.classList.contains('collapsed')).toBe(false)
    button.click()
    expect(panel.sheetState).toBe('peek')
    expect(panel.el.classList.contains('collapsed')).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    panel.setSheetState('half')
    expect(panel.el.classList.contains('collapsed')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('announces the visible mobile summary state when planning starts collapsed', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const panel = createPanelHost()
    panel.show('planning', '线路规划', null, document.createElement('div'))
    panel.setCollapsed(true)
    expect(panel.sheetState).toBe('peek')
    expect(panel.el.dataset.sheetState).toBe('peek')
    expect(panel.el.querySelector('.ui-panel-chev').getAttribute('aria-label')).toBe('展开规划面板')
    expect(panel.el.querySelector('.ui-sheet-grabber').getAttribute('aria-label')).toContain('当前摘要')
  })

  it('keeps the mobile sheet gesture alive after the pointer leaves the grabber', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    vi.stubGlobal('innerHeight', 800)
    const panel = createPanelHost()
    panel.show('planning', '线路规划', null, document.createElement('div'))
    panel.el.getBoundingClientRect = () => ({ height: Number.parseFloat(panel.el.style.getPropertyValue('--sheet-drag-height')) || 380 })
    const grabber = panel.el.querySelector('.ui-sheet-grabber')
    pointer(grabber, 'pointerdown', { y: 500, time: 0 })
    pointer(document, 'pointermove', { y: 160, time: 40 })
    pointer(document, 'pointerup', { y: 160, time: 80 })
    expect(panel.sheetState).toBe('full')
  })

  it('returns a mounted mobile sheet to an open desktop inspector', () => {
    let onChange
    const media = { matches: true, addEventListener: vi.fn((_event, listener) => { onChange = listener }) }
    vi.stubGlobal('matchMedia', vi.fn(() => media))
    const panel = createPanelHost()
    panel.show('planning', '线路规划', null, document.createElement('div'))
    panel.setSheetState('peek')
    expect(panel.collapsed).toBe(true)
    media.matches = false
    onChange({ matches: false })
    expect(panel.collapsed).toBe(false)
    expect(panel.sheetState).toBe('half')
  })
})
