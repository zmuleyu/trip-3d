// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLayerButtons, createPanelHost } from './chrome.js'

beforeEach(() => { document.body.replaceChildren() })

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
})

describe('panel collapse accessibility state', () => {
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
})
