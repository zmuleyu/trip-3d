import { describe, it, expect } from 'vitest'
import { pickRepresentativePoints, isRainDay, tripDates, wmoIcon, aggregateTripDays, MAX_TRIP_DAYS } from './weather.js'

describe('pickRepresentativePoints', () => {
  const wps = [
    { lon: 102.8, lat: 31.0, ele: 3200, name: 'P1' },
    { lon: 102.9, lat: 31.1, ele: 4800, name: 'P2' },
    { lon: 103.0, lat: 31.2, ele: 5000, name: 'P3' },
    { lon: 103.1, lat: 31.3, ele: 3300, name: 'P4' },
  ]

  it('returns first, highest and last with role labels', () => {
    const pts = pickRepresentativePoints(wps)
    expect(pts.map((p) => p.role)).toEqual(['起点', '最高点', '终点'])
    expect(pts[0].name).toBe('P1')
    expect(pts[1].name).toBe('P3')
    expect(pts[2].name).toBe('P4')
  })

  it('dedupes when first/last is also the highest', () => {
    const pts = pickRepresentativePoints([wps[0], wps[1], wps[2]]) // last IS highest
    expect(pts.map((p) => p.role)).toEqual(['起点', '终点·最高'])
    expect(pts).toHaveLength(2)
  })

  it('single waypoint → one point', () => {
    const pts = pickRepresentativePoints([wps[0]])
    expect(pts).toHaveLength(1)
    expect(pts[0].role).toBe('起点·终点')
  })

  it('empty → []', () => {
    expect(pickRepresentativePoints([])).toEqual([])
  })
})

describe('isRainDay', () => {
  it('precip >= 1mm is rain regardless of code', () => {
    expect(isRainDay({ precipMm: 1, weatherCode: 0 })).toBe(true)
    expect(isRainDay({ precipMm: 0.9, weatherCode: 0 })).toBe(false)
  })
  it('rain-family weathercodes count even below 1mm', () => {
    for (const c of [51, 61, 67, 71, 80, 82, 95, 99]) expect(isRainDay({ precipMm: 0.2, weatherCode: c })).toBe(true)
    for (const c of [0, 1, 2, 3, 45, 48]) expect(isRainDay({ precipMm: 0.2, weatherCode: c })).toBe(false)
  })

  it('non-finite / negative precip normalizes to 0 (code still applies)', () => {
    expect(isRainDay({ precipMm: null, weatherCode: 0 })).toBe(false)
    expect(isRainDay({ precipMm: NaN, weatherCode: 0 })).toBe(false)
    expect(isRainDay({ precipMm: -2, weatherCode: 0 })).toBe(false)
    expect(isRainDay({ precipMm: NaN, weatherCode: 61 })).toBe(true)
  })
})

describe('aggregateTripDays', () => {
  const mk = (date, name, over) => ({ date, point: { name }, tempMax: 10, tempMin: 5, precipMm: 0, weatherCode: 0, windMax: 5, ...over })

  it('worst-point rule per date: max precip/wind, min temp, max code', () => {
    const days = [
      mk('2026-09-14', 'P1', { precipMm: 0.5, windMax: 10, tempMin: 8, weatherCode: 1 }),
      mk('2026-09-14', 'P2', { precipMm: 3.2, windMax: 40, tempMin: -2, weatherCode: 61 }),
      mk('2026-09-15', 'P1', { precipMm: 0, weatherCode: 0 }),
    ]
    const agg = aggregateTripDays(days)
    expect(agg).toHaveLength(2)
    expect(agg[0]).toMatchObject({ date: '2026-09-14', precipMm: 3.2, windMax: 40, tempMin: -2, weatherCode: 61, isRain: true })
    expect(agg[0].points).toHaveLength(2)
    expect(agg[1]).toMatchObject({ date: '2026-09-15', isRain: false })
  })

  it('keeps dates sorted and handles single-point days', () => {
    const agg = aggregateTripDays([mk('2026-09-16', 'P1'), mk('2026-09-14', 'P1')])
    expect(agg.map((d) => d.date)).toEqual(['2026-09-14', '2026-09-16'])
  })
})

describe('tripDates', () => {
  it('builds inclusive date list from start', () => {
    expect(tripDates('2026-09-14', 3)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16'])
  })
  it('clamps days to [1, MAX_TRIP_DAYS] and handles month rollover', () => {
    expect(tripDates('2026-09-30', 2)).toEqual(['2026-09-30', '2026-10-01'])
    expect(tripDates('2026-09-14', 0)).toHaveLength(1)
    expect(tripDates('2026-09-14', 99)).toHaveLength(MAX_TRIP_DAYS)
  })
  it('throws on invalid start date', () => {
    expect(() => tripDates('not-a-date', 3)).toThrow(/invalid/i)
  })
})

describe('wmoIcon', () => {
  it('maps code groups to glyphs', () => {
    expect(wmoIcon(0)).toBe('☀')
    expect(wmoIcon(2)).toBe('⛅')
    expect(wmoIcon(45)).toBe('🌫')
    expect(wmoIcon(61)).toBe('🌧')
    expect(wmoIcon(71)).toBe('🌨')
    expect(wmoIcon(95)).toBe('⛈')
  })
})
