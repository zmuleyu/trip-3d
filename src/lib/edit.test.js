import { describe, it, expect } from 'vitest'
import { createRoute, addWaypoint, removeWaypoint, moveWaypoint, reverseWaypoints, closeLoop, toggleDayEnd, normalizeDayEnds, dayNumberAt } from './route.js'

describe('reverseWaypoints / closeLoop', () => {
  const mk = () => {
    const r = createRoute('t')
    addWaypoint(r, 116.0, 39.0, 100, 'A')
    addWaypoint(r, 116.1, 39.1, 200, 'B')
    addWaypoint(r, 116.2, 39.2, 300, 'C')
    return r
  }
  it('reverse swaps order, bumps both revisions, names stay', () => {
    const r = mk()
    reverseWaypoints(r)
    expect(r.waypoints.map((w) => w.name)).toEqual(['C', 'B', 'A'])
    expect(r.revision).toBe(4)
    expect(r.geometryRevision).toBe(4)
  })
  it('closeLoop appends start copy when open; no-op when already closed or <2 pts', () => {
    const r = mk()
    closeLoop(r)
    expect(r.waypoints.length).toBe(4)
    const first = r.waypoints[0]
    const last = r.waypoints.at(-1)
    expect(last.lon).toBeCloseTo(first.lon, 6)
    expect(last.lat).toBeCloseTo(first.lat, 6)
    expect(last.id).not.toBe(first.id) // copy, not alias
    closeLoop(r) // already closed → no-op
    expect(r.waypoints.length).toBe(4)
    const s = createRoute('x')
    addWaypoint(s, 116, 39, 100)
    closeLoop(s)
    expect(s.waypoints.length).toBe(1)
  })
})

describe('dayEnds (id-based multi-day segmentation)', () => {
  const mk = () => {
    const r = createRoute('t')
    for (let i = 0; i < 5; i++) addWaypoint(r, 116 + i * 0.1, 39, 100 + i * 10, `P${i + 1}`)
    return r
  }
  it('toggle add/remove; bumps revision only (not geometryRevision)', () => {
    const r = mk()
    const g = r.geometryRevision
    toggleDayEnd(r, 2)
    expect(r.dayEnds).toEqual([r.waypoints[2].id])
    expect(r.geometryRevision).toBe(g)
    expect(r.revision).toBe(6)
    toggleDayEnd(r, 2)
    expect(r.dayEnds).toEqual([])
  })
  it('dayNumberAt: days increment after each marked end', () => {
    const r = mk()
    toggleDayEnd(r, 1) // day 1 ends at P2
    toggleDayEnd(r, 3) // day 2 ends at P4
    expect(dayNumberAt(r, 0)).toBe(1)
    expect(dayNumberAt(r, 1)).toBe(1)
    expect(dayNumberAt(r, 2)).toBe(2)
    expect(dayNumberAt(r, 3)).toBe(2)
    expect(dayNumberAt(r, 4)).toBe(3)
  })
  it('markers follow the waypoint through removal and reorder (no index drift)', () => {
    const r = mk()
    toggleDayEnd(r, 1) // marks P2's id
    toggleDayEnd(r, 4) // marks P5's id
    removeWaypoint(r, 0) // P1 gone; P2 now at index 0
    normalizeDayEnds(r)
    expect(r.dayEnds).toHaveLength(2)
    expect(dayNumberAt(r, 0)).toBe(1) // P2 still ends day 1
    expect(dayNumberAt(r, 1)).toBe(2)
    moveWaypoint(r, 3, 0) // move P5 to front
    expect(dayNumberAt(r, 0)).toBe(1)
    expect(dayNumberAt(r, 1)).toBe(2) // day boundary followed P2's position
  })
  it('normalizeDayEnds drops markers for deleted waypoints', () => {
    const r = mk()
    toggleDayEnd(r, 1)
    removeWaypoint(r, 1)
    normalizeDayEnds(r)
    expect(r.dayEnds).toEqual([])
  })
})
