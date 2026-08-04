import { describe, it, expect } from 'vitest'
import { computeLegs, normalizeOsrmLegs } from './legs.js'

const WPS = [
  { name: 'A', lon: 116.0, lat: 39.0, ele: 100 },
  { name: 'B', lon: 116.1, lat: 39.0, ele: 400 },
  { name: 'C', lon: 116.1, lat: 39.1, ele: 250 },
]

describe('computeLegs', () => {
  it('one leg per waypoint pair with names, haversine distance, ele diffs', () => {
    const legs = computeLegs(WPS)
    expect(legs).toHaveLength(2)
    expect(legs[0].from).toBe('A')
    expect(legs[0].to).toBe('B')
    expect(legs[0].distanceM).toBeGreaterThan(8000) // 0.1° lon at 39°N ≈ 8.6km
    expect(legs[0].distanceM).toBeLessThan(9500)
    expect(legs[0].ascentM).toBe(300)
    expect(legs[0].descentM).toBe(0)
    expect(legs[1].ascentM).toBe(0)
    expect(legs[1].descentM).toBe(150)
  })
  it('driveMinutes heuristic matches routeStats formula', () => {
    const legs = computeLegs(WPS)
    // leg0: ~8.6km/40kmh*60 + 300/300*10 ≈ 12.9+10 = ~23min
    expect(legs[0].driveMinutes).toBeGreaterThan(15)
    expect(legs[0].driveMinutes).toBeLessThan(35)
  })
  it('edge cases: <2 waypoints → []; identical points → zero leg, no NaN', () => {
    expect(computeLegs([])).toEqual([])
    expect(computeLegs([WPS[0]])).toEqual([])
    const legs = computeLegs([WPS[0], { ...WPS[0] }])
    expect(legs).toHaveLength(1)
    expect(legs[0].distanceM).toBe(0)
    expect(legs[0].driveMinutes).toBe(0)
  })
})

describe('normalizeOsrmLegs', () => {
  it('attaches waypoint names to osrm legs; count mismatch → null', () => {
    const legs = normalizeOsrmLegs([{ distanceM: 1000, durationS: 600 }], WPS.slice(0, 2))
    expect(legs).toHaveLength(1)
    expect(legs[0].from).toBe('A')
    expect(legs[0].to).toBe('B')
    expect(legs[0].distanceM).toBe(1000)
    expect(legs[0].durationS).toBe(600)
    expect(legs[0].real).toBe(true)
    expect(normalizeOsrmLegs([{ distanceM: 1, durationS: 1 }], WPS)).toBeNull()
    expect(normalizeOsrmLegs([], WPS)).toBeNull()
  })
})
