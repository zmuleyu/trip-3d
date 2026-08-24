// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createWeatherPanel } from './weatherPanel.js'

beforeEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
})

describe('hourly weather detail', () => {
  it('opens a real in-panel hourly state for the selected weather point', () => {
    const panel = createWeatherPanel({})
    document.body.appendChild(panel.el)

    panel.showHourlyDetails({
      point: { role: '木骡子' },
      date: '2026-08-24',
      hours: [
        { time: '2026-08-24T09:00', temperature: 12, precipMm: 0.2, windKmh: 8, weatherCode: 2 },
        { time: '2026-08-24T10:00', temperature: 13, precipMm: 0, windKmh: 9, weatherCode: 1 },
      ],
    })

    const detail = panel.el.querySelector('.wx-hourly')
    expect(detail.classList.contains('hidden')).toBe(false)
    expect(detail.textContent).toContain('木骡子 · 逐小时预报')
    expect(detail.textContent).toContain('09:00')
    expect(detail.textContent).toContain('12°C')
  })
})
