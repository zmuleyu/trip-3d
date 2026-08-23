import { describe, it, expect } from 'vitest'
import { computeRegionRouteStats, formatRouteStats } from './adminRouteStats.js'
import { haversineMeters } from './geo.js'

// 0.1° × 0.1° square ring (unclosed — DataV rings arrive closed, both must work)
const SQUARE = { name: '测试县', adcode: '999999', level: 'district', ring: [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]] }
const SQUARE_CLOSED = { ...SQUARE, ring: [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1], [0, 0]] }

// haversineMeters(lat1, lon1, lat2, lon2)
const across = (lat, lonA, lonB) => haversineMeters(lat, lonA, lat, lonB)

describe('computeRegionRouteStats', () => {
  it('crossing once: entries=1, distance = ring width at that latitude', () => {
    const stat = computeRegionRouteStats([[-0.05, 0.05], [0.15, 0.05]], SQUARE)
    expect(stat.entries).toBe(1)
    expect(stat.distanceMeters).toBeCloseTo(across(0.05, 0, 0.1), 0)
  })

  it('route fully inside: entries=1, distance = full route length', () => {
    const stat = computeRegionRouteStats([[0.02, 0.05], [0.08, 0.05]], SQUARE)
    expect(stat.entries).toBe(1)
    expect(stat.distanceMeters).toBeCloseTo(across(0.05, 0.02, 0.08), 0)
  })

  it('route fully outside: entries=0, distance=0', () => {
    const stat = computeRegionRouteStats([[-0.05, -0.05], [-0.02, -0.02]], SQUARE)
    expect(stat.entries).toBe(0)
    expect(stat.distanceMeters).toBe(0)
  })

  it('zigzag in-out-in: entries=2, distance sums both inside spans', () => {
    const stat = computeRegionRouteStats(
      [[-0.05, 0.05], [0.05, 0.05], [-0.05, 0.02], [0.05, 0.02]],
      SQUARE,
    )
    expect(stat.entries).toBe(2)
    const expected =
      across(0.05, 0, 0.05) + // first inside span (enters at lon 0, exits at lon 0.05)
      haversineMeters(0.05, 0.05, 0.035, 0) + // exit leg, inside until lon 0 at lat 0.035
      across(0.02, 0, 0.05) // re-entry span
    expect(stat.distanceMeters).toBeCloseTo(expected, 0)
  })

  it('route ending inside counts the entry and partial distance', () => {
    const stat = computeRegionRouteStats([[-0.05, 0.05], [0.05, 0.05]], SQUARE)
    expect(stat.entries).toBe(1)
    expect(stat.distanceMeters).toBeCloseTo(across(0.05, 0, 0.05), 0)
  })

  it('route starting inside counts as one visit', () => {
    const stat = computeRegionRouteStats([[0.05, 0.05], [0.15, 0.05]], SQUARE)
    expect(stat.entries).toBe(1)
    expect(stat.distanceMeters).toBeCloseTo(across(0.05, 0.05, 0.1), 0)
  })

  it('closed rings (first == last vertex) give identical results', () => {
    const a = computeRegionRouteStats([[-0.05, 0.05], [0.15, 0.05]], SQUARE)
    const b = computeRegionRouteStats([[-0.05, 0.05], [0.15, 0.05]], SQUARE_CLOSED)
    expect(b.entries).toBe(a.entries)
    expect(b.distanceMeters).toBeCloseTo(a.distanceMeters, 6)
  })

  it('sparse route (two far-apart points) is densified and still measured exactly', () => {
    const stat = computeRegionRouteStats([[-1, 0.05], [1, 0.05]], SQUARE, { maxSegmentMeters: 1000 })
    expect(stat.entries).toBe(1)
    expect(stat.distanceMeters).toBeCloseTo(across(0.05, 0, 0.1), 0)
  })

  it('accepts {lon, lat} point objects', () => {
    const stat = computeRegionRouteStats([{ lon: -0.05, lat: 0.05 }, { lon: 0.15, lat: 0.05 }], SQUARE)
    expect(stat.entries).toBe(1)
    expect(stat.distanceMeters).toBeCloseTo(across(0.05, 0, 0.1), 0)
  })

  it('returns null for degenerate input', () => {
    expect(computeRegionRouteStats([], SQUARE)).toBeNull()
    expect(computeRegionRouteStats([[0.05, 0.05]], SQUARE)).toBeNull()
    expect(computeRegionRouteStats(null, SQUARE)).toBeNull()
    expect(computeRegionRouteStats([[-0.05, 0.05], [0.15, 0.05]], null)).toBeNull()
    expect(computeRegionRouteStats([[-0.05, 0.05], [0.15, 0.05]], { ring: [[0, 0], [1, 1]] })).toBeNull()
  })
})

describe('formatRouteStats', () => {
  it('formats the §3.5 target shape', () => {
    expect(formatRouteStats({ entries: 2, distanceMeters: 38000 })).toBe('进入 2 次 · 预计途经 38 km')
  })
  it('keeps one decimal below 10 km', () => {
    expect(formatRouteStats({ entries: 1, distanceMeters: 8300 })).toBe('进入 1 次 · 预计途经 8.3 km')
  })
  it('zero visit still formats deterministically', () => {
    expect(formatRouteStats({ entries: 0, distanceMeters: 0 })).toBe('进入 0 次 · 预计途经 0 km')
  })
})
