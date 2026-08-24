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
    const layers = createLayerButtons({ buttons: [{ id: 'hud', icon: 'hud', tip: 'HUD', initial: true, onToggle }], onStateChange })
    layers.get('hud').set(false, { notify: true })
    expect(onToggle).toHaveBeenCalledWith('hud', false)
    expect(onStateChange).toHaveBeenCalledWith('hud', false)
    expect(layers.get('hud').btn.getAttribute('aria-pressed')).toBe('false')
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
  it('uses one inspector tab model for overview, weather, and retention', () => {
    const onTab = vi.fn()
    const panel = createPanelHost({ onTab })
    panel.show('weather', '行程检视', null, document.createElement('div'))
    const weather = panel.el.querySelector('[data-panel-tab="weather"]')
    expect(weather.getAttribute('aria-pressed')).toBe('true')
    panel.el.querySelector('[data-panel-tab="share"]').click()
    expect(onTab).toHaveBeenCalledWith('share')
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
})
