// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyDensity, DEFAULT_DENSITY, loadDensity, saveDensity } from './densityPreferences.js'

beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.uiDensity })

describe('local UI density preference', () => {
  it('defaults invalid values to standard and persists only the normalized local preference', () => {
    expect(loadDensity()).toBe(DEFAULT_DENSITY)
    expect(saveDensity('compact')).toBe('compact')
    expect(loadDensity()).toBe('compact')
    expect(saveDensity('pixel-scale')).toBe(DEFAULT_DENSITY)
  })

  it('applies a density attribute for token reflow without inline scaling', () => {
    expect(applyDensity('large')).toBe('large')
    expect(document.documentElement.dataset.uiDensity).toBe('large')
    expect(document.documentElement.style.transform).toBe('')
  })
})
