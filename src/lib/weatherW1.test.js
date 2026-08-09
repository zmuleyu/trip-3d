import { describe, it, expect } from 'vitest'
import { archiveWindow, bandColumns } from './weather.js'

describe('archiveWindow (forecast horizon → ERA5 last-year shift)', () => {
  const today = '2026-08-05'
  it('within 14-day horizon → null (use forecast)', () => {
    expect(archiveWindow('2026-08-06', '2026-08-09', today)).toBeNull()
    expect(archiveWindow('2026-08-19', '2026-08-20', today)).toBeNull() // day 14 exactly
  })
  it('beyond horizon → shifted to last year', () => {
    const w = archiveWindow('2026-09-10', '2026-09-13', today)
    expect(w).toEqual({ from: '2025-09-10', to: '2025-09-13' })
  })
  it('past dates → shifted to last year as well (archive covers history)', () => {
    const w = archiveWindow('2026-07-01', '2026-07-03', today)
    expect(w).toEqual({ from: '2025-07-01', to: '2025-07-03' })
  })
})

describe('bandColumns (day-segmented weather band)', () => {
  it('no dayBounds → equal columns', () => {
    const cols = bandColumns(null, 3)
    expect(cols).toHaveLength(3)
    expect(cols[0]).toEqual({ x0: 0, x1: 1 / 3, dayIndex: 0 })
    expect(cols[2].x1).toBeCloseTo(1)
  })
  it('dayBounds → columns split at route fractions', () => {
    const cols = bandColumns([{ frac: 0.4, day: 1 }, { frac: 0.75, day: 2 }], 3)
    expect(cols.map((c) => [c.x0, c.x1])).toEqual([[0, 0.4], [0.4, 0.75], [0.75, 1]])
    expect(cols.map((c) => c.dayIndex)).toEqual([0, 1, 2])
  })
  it('queried fewer days than trip segments → extra segments still get a column (dayIndex may exceed weather array)', () => {
    const cols = bandColumns([{ frac: 0.5, day: 1 }], 2)
    expect(cols).toHaveLength(2)
    expect(cols[1].dayIndex).toBe(1)
  })
})
