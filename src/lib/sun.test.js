import { describe, it, expect } from 'vitest'
import { sunPosition, shadeFraction } from './sun.js'

describe('sunPosition (NOAA approximation)', () => {
  it('equinox equator 15:00 UTC → elevation ≈45°, azimuth west (±2° model tolerance)', () => {
    const s = sunPosition(0, 0, new Date(Date.UTC(2026, 2, 20, 15, 0)))
    expect(s.elevation).toBeCloseTo(45, 0)
    expect(Math.abs(s.azimuth - 270)).toBeLessThan(2) // δ≈-0.9° on Mar 20 shifts az slightly off due-west
  })
  it('Beijing summer solstice solar noon → elevation ≈73.6°, azimuth south', () => {
    // 116.4°E solar noon = 12:00 − 116.4/15 h = 04:14 UTC
    const s = sunPosition(39.9, 116.4, new Date(Date.UTC(2026, 5, 21, 4, 14)))
    expect(s.elevation).toBeCloseTo(73.6, 0)
    expect(s.azimuth).toBeCloseTo(180, 0)
  })
  it('Beijing winter solstice noon → elevation ≈26.6°', () => {
    const s = sunPosition(39.9, 116.4, new Date(Date.UTC(2026, 11, 21, 4, 14)))
    expect(s.elevation).toBeCloseTo(26.6, 0)
  })
  it('midnight → below horizon', () => {
    const s = sunPosition(39.9, 116.4, new Date(Date.UTC(2026, 5, 21, 16, 14))) // 00:14 local
    expect(s.elevation).toBeLessThan(0)
  })
  it('azimuth is 0-360 (never negative)', () => {
    for (const h of [0, 3, 6, 9, 12, 18, 21]) {
      const s = sunPosition(31.2, 121.5, new Date(Date.UTC(2026, 5, 21, h)))
      expect(s.azimuth).toBeGreaterThanOrEqual(0)
      expect(s.azimuth).toBeLessThan(360)
    }
  })
})

describe('shadeFraction (pure geometric sun vs slope)', () => {
  // raycastFn(hitTest) is injected: returns true when the sun ray is blocked
  it('all blocked → 1; none blocked → 0; sun below horizon → 1', () => {
    const pts = [{ x: 0, z: 0 }, { x: 1, z: 1 }, { x: 2, z: 2 }]
    expect(shadeFraction(pts, { elevation: 30, azimuth: 180 }, () => true)).toBe(1)
    expect(shadeFraction(pts, { elevation: 30, azimuth: 180 }, () => false)).toBe(0)
    expect(shadeFraction(pts, { elevation: -5, azimuth: 0 }, () => false)).toBe(1)
    expect(shadeFraction([], { elevation: 30, azimuth: 0 }, () => false)).toBe(0)
  })
})
