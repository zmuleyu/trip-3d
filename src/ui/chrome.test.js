// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLayerButtons } from './chrome.js'

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
