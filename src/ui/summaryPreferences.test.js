import { describe, expect, it } from 'vitest'
import {
  automaticSummaryFields,
  formatSummary,
  loadSummaryPreferences,
  normalizeSummaryPreferences,
  saveSummaryPreferences,
} from './summaryPreferences.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

describe('summary preferences', () => {
  it('normalizes and persists only supported ordered fields', () => {
    const storage = memoryStorage()
    const saved = saveSummaryPreferences({ mode: 'custom', fields: ['wind', 'wind', 'distance', 'nope'] }, storage)
    expect(saved).toEqual({ mode: 'custom', fields: ['wind', 'distance'] })
    expect(loadSummaryPreferences(storage)).toEqual(saved)
  })

  it('uses route fallbacks when weather is unavailable', () => {
    expect(automaticSummaryFields({ distanceM: 12000, ascentM: 840, maxElevationM: 4200, waypointCount: 4 }))
      .toEqual(['distance', 'ascent', 'maxElevation', 'waypoints'])
  })

  it('formats a bounded custom summary', () => {
    const items = formatSummary(
      normalizeSummaryPreferences({ mode: 'custom', fields: ['distance', 'temperature', 'weatherRisk'] }),
      { distanceM: 18600, temperatureMin: 2, temperatureMax: 18, weatherRiskCount: 2 },
    )
    expect(items.map((item) => item.text)).toEqual(['18.6 km', '2–18°C', '2处天气风险'])
  })
})
