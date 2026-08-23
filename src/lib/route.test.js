import { describe, it, expect } from 'vitest'
import { makeGeoContext } from './geo.js'
import {
  createRoute, addWaypoint, insertWaypoint, removeWaypoint, moveWaypoint,
  sampleRoutePath, samplePolyline, routeStats, routeFingerprint, MAX_WAYPOINTS,
} from './route.js'

const dem = { lat: 36.998, lon: -110.0984, zoom: 12, size: 768 }
const geo = makeGeoContext(dem)
// flat fake elevation sampler: world (x,z) → meters
const flatElev = () => 1000

describe('route model', () => {
  it('stores a normalized first-class route mode', () => {
    expect(createRoute('walk', 'foot').mode).toBe('foot')
    expect(createRoute('legacy').mode).toBe('straight')
    expect(createRoute('bad', 'drive').mode).toBe('straight')
  })

  it('addWaypoint appends with elevation and auto name; enforces cap', () => {
    const r = createRoute('t')
    for (let i = 0; i < MAX_WAYPOINTS; i++) addWaypoint(r, -110 + i * 0.001, 37, 900 + i)
    expect(r.waypoints).toHaveLength(MAX_WAYPOINTS)
    expect(r.waypoints[0].name).toBe('P1')
    expect(addWaypoint(r, -109, 37, 900)).toBeNull() // over cap
  })

  it('removeWaypoint / moveWaypoint', () => {
    const r = createRoute('t')
    addWaypoint(r, -110.1, 37, 900)
    addWaypoint(r, -110.0, 37, 950)
    addWaypoint(r, -109.9, 37, 920)
    moveWaypoint(r, 0, 2)
    expect(r.waypoints[2].ele).toBe(900)
    removeWaypoint(r, 1)
    expect(r.waypoints.map((w) => w.ele)).toEqual([950, 900])
  })

  it('sampleRoutePath returns arc-length-parameterized points with elevation', () => {
    const r = createRoute('t')
    addWaypoint(r, -110.1, 37.0, 900)
    addWaypoint(r, -110.0, 37.0, 950)
    addWaypoint(r, -109.9, 37.01, 920)
    const pts = sampleRoutePath(geo, r.waypoints, flatElev, 120)
    expect(pts.length).toBe(120)
    // each point carries world + lonLat + elevation
    expect(pts[0].lon).toBeCloseTo(-110.1, 5)
    expect(pts.at(-1).lon).toBeCloseTo(-109.9, 5)
    expect(pts[0].ele).toBe(1000)
    // cumulative distance non-decreasing; strictly increasing for spread-out waypoints
    for (let i = 1; i < pts.length; i++) expect(pts[i].cumDistM).toBeGreaterThanOrEqual(pts[i - 1].cumDistM)
    expect(pts.at(-1).cumDistM).toBeGreaterThan(pts[0].cumDistM)
  })

  it('degenerate inputs: duplicate waypoints collapse to zero length; nSamples < 2 throws', () => {
    const dup = [
      { lon: -110, lat: 37 },
      { lon: -110, lat: 37 },
    ]
    const pts = sampleRoutePath(geo, dup, flatElev, 60)
    expect(pts).toHaveLength(60)
    expect(pts.every((p) => p.cumDistM === 0)).toBe(true)
    expect(() => sampleRoutePath(geo, dup, flatElev, 1)).toThrow(/nSamples/)
  })

  it('routeStats: distance / ascent / descent / heuristic drive time', () => {
    const pts = [
      { lon: -110.1, lat: 37, ele: 1000, cumDistM: 0 },
      { lon: -110.0, lat: 37, ele: 1200, cumDistM: 8900 },
      { lon: -109.9, lat: 37, ele: 1100, cumDistM: 17800 },
    ]
    const s = routeStats(pts)
    expect(s.distanceM).toBeCloseTo(17800, 0)
    expect(s.ascentM).toBe(200)
    expect(s.descentM).toBe(100)
    expect(s.maxEle).toBe(1200)
    expect(s.driveMinutes).toBeGreaterThan(0)
  })

  it('sampleRoutePath with <2 waypoints returns []', () => {
    expect(sampleRoutePath(geo, [], flatElev, 120)).toEqual([])
    expect(sampleRoutePath(geo, [{ lon: 0, lat: 0 }], flatElev, 120)).toEqual([])
  })

  it('routeFingerprint changes on waypoint edit, stable on identical input', () => {
    const r = createRoute('t')
    addWaypoint(r, -110.1, 37, 900)
    const a = routeFingerprint(r)
    expect(routeFingerprint(r)).toBe(a)
    addWaypoint(r, -110.0, 37.01, 950)
    expect(routeFingerprint(r)).not.toBe(a)
    const b = routeFingerprint(r)
    r.waypoints[1].lon += 0.001
    expect(routeFingerprint(r)).not.toBe(b)
  })

  it('samplePolyline: arc-length resample of arbitrary [[lon,lat]] geometry', () => {
    const coords = [
      [-110.1, 37.0],
      [-110.05, 37.0],
      [-110.0, 37.0],
    ]
    const pts = samplePolyline(geo, coords, flatElev, 100)
    expect(pts).toHaveLength(100)
    expect(pts[0].lon).toBeCloseTo(-110.1, 5)
    expect(pts.at(-1).lon).toBeCloseTo(-110.0, 5)
    expect(pts[0].ele).toBe(1000)
    // cumulative distance non-decreasing and reaches the polyline length
    for (let i = 1; i < pts.length; i++) expect(pts[i].cumDistM).toBeGreaterThanOrEqual(pts[i - 1].cumDistM)
    expect(pts.at(-1).cumDistM).toBeGreaterThan(pts[0].cumDistM)
    // straight east-west line → lat stays ~37
    expect(Math.abs(pts[50].lat - 37.0)).toBeLessThan(1e-4)
  })

  it('samplePolyline: degenerate input', () => {
    expect(samplePolyline(geo, [], flatElev, 60)).toEqual([])
    expect(samplePolyline(geo, [[-110, 37]], flatElev, 60)).toEqual([])
    const dup = samplePolyline(geo, [[-110, 37], [-110, 37]], flatElev, 30)
    expect(dup).toHaveLength(30)
    expect(dup.every((p) => p.cumDistM === 0)).toBe(true)
    expect(() => samplePolyline(geo, [[-110, 37], [-110.01, 37]], flatElev, 1)).toThrow(/nSamples/)
  })

  it('route revision increments on every mutation (collision-free version binding)', () => {
    const r = createRoute('t')
    expect(r.revision).toBe(0)
    addWaypoint(r, -110.1, 37, 900)
    expect(r.revision).toBe(1)
    addWaypoint(r, -110.0, 37.01, 950)
    expect(r.revision).toBe(2)
    moveWaypoint(r, 0, 1)
    expect(r.revision).toBe(3)
    removeWaypoint(r, 0)
    expect(r.revision).toBe(4)
  })

  it('insertWaypoint: mid-insert shifts others, clamps out-of-range, bumps both revisions', () => {
    const r = createRoute('t')
    addWaypoint(r, -110.1, 37, 900, 'A')
    addWaypoint(r, -110.0, 37.01, 950, 'C')
    const wp = insertWaypoint(r, 1, -110.05, 37.005, 920, 'B')
    expect(wp.name).toBe('B')
    expect(r.waypoints.map((w) => w.name)).toEqual(['A', 'B', 'C'])
    expect(r.geometryRevision).toBe(3)
    // clamp: index > length → append
    insertWaypoint(r, 99, -109.9, 37.02, 960, 'D')
    expect(r.waypoints.at(-1).name).toBe('D')
    expect(r.waypoints).toHaveLength(4)
  })

  it('geometryRevision: bumps on geometry mutations; rename does NOT bump', () => {
    const r = createRoute('t')
    expect(r.geometryRevision).toBe(0)
    addWaypoint(r, -110.1, 37, 900)
    addWaypoint(r, -110.0, 37.01, 950)
    expect(r.geometryRevision).toBe(2)
    r.waypoints[0].name = '改名'
    r.revision++ // rename path bumps revision only
    expect(r.geometryRevision).toBe(2)
    expect(r.revision).toBe(3)
    moveWaypoint(r, 0, 1)
    expect(r.geometryRevision).toBe(3)
  })

  it('mutation helpers guard bounds: invalid ops are no-ops without revision bump', () => {
    const r = createRoute('t')
    addWaypoint(r, -110.1, 37, 900)
    addWaypoint(r, -110.0, 37.01, 950)
    const rev = r.revision
    expect(removeWaypoint(r, -1)).toBe(false)
    expect(removeWaypoint(r, 5)).toBe(false)
    expect(removeWaypoint(r, 1.5)).toBe(false)
    expect(moveWaypoint(r, 0, 0)).toBe(false)
    expect(moveWaypoint(r, 0, 9)).toBe(false)
    expect(moveWaypoint(r, -1, 1)).toBe(false)
    expect(r.waypoints).toHaveLength(2)
    expect(r.revision).toBe(rev)
    expect(removeWaypoint(r, 0)).toBe(true)
    expect(r.waypoints).toHaveLength(1)
  })
})
