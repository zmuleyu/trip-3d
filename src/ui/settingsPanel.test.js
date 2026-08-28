// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSettingsPanel } from './settingsPanel.js'

beforeEach(() => { document.body.replaceChildren() })

describe('native settings panel', () => {
  it('emits controlled setting and layer changes', () => {
    const onSetting = vi.fn()
    const onLayer = vi.fn()
    const panel = createSettingsPanel({ presets: ['Monument Valley', 'Custom'], onSetting, onLayer })
    document.body.appendChild(panel.el)
    const location = panel.el.querySelector('[aria-label="预设地点"]')
    location.value = 'Monument Valley'
    location.dispatchEvent(new Event('change'))
    expect(onSetting).toHaveBeenCalledWith('demLocation', 'Monument Valley', { commit: true })
    const contour = panel.el.querySelector('[aria-label="等高线"]')
    contour.click()
    expect(onLayer).toHaveBeenCalledWith('contour', true)
  })

  it('syncs route, numeric, and layer state without creating a second state source', () => {
    const panel = createSettingsPanel({ presets: ['Custom'] })
    document.body.appendChild(panel.el)
    panel.sync({
      params: { source: 'real', demLocation: 'Custom', demLat: 31.2, demLon: 121.4, demZoom: 11, demExaggeration: 1.8, routeArrows: true, exposure: .92 },
      layers: { contour: true },
    })
    expect(panel.el.querySelector('[aria-label="纬度"]').value).toBe('31.2')
    expect(panel.el.querySelector('[aria-label="地图精度"]').value).toBe('11')
    expect(panel.el.querySelector('[aria-label="方向箭头"]').checked).toBe(true)
    expect(panel.el.querySelector('[aria-label="等高线"]').checked).toBe(true)
    expect(panel.el.querySelector('[aria-label="HUD 信息"]')).toBeNull()
  })

  it('owns close and truthful loading state without a legacy advanced surface', () => {
    const onClose = vi.fn()
    const panel = createSettingsPanel({ presets: ['Custom'], onClose })
    document.body.appendChild(panel.el)
    expect(panel.el.querySelector('.settings-advanced')).toBeNull()
    panel.setTerrainStatus('loading', '正在获取高程数据')
    expect(panel.el.querySelector('.settings-primary').disabled).toBe(true)
    expect(panel.el.querySelector('[role="status"]').textContent).toContain('正在获取')
    panel.closeButton.click()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('edits summary and weather preferences without touching route settings', () => {
    const onSummaryPreferences = vi.fn()
    const onWeatherPreferences = vi.fn()
    const panel = createSettingsPanel({
      presets: ['Custom'],
      summaryPreferences: { mode: 'auto', fields: ['distance', 'duration', 'ascent', 'weatherRisk'] },
      weatherPreferences: { hoverCards: true, pinCards: true, temperatureLabels: 'auto', transparency: 'system' },
      onSummaryPreferences,
      onWeatherPreferences,
    })
    document.body.appendChild(panel.el)

    const mode = panel.el.querySelector('[aria-label="摘要字段模式"]')
    mode.value = 'custom'
    mode.dispatchEvent(new Event('change'))
    expect(onSummaryPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'custom' }))

    panel.el.querySelector('[aria-label="悬停显示天气卡"]').click()
    expect(onWeatherPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ hoverCards: false }))
  })
})
