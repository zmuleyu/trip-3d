import { describe, it, expect } from 'vitest'
import { makeGeoContext } from './geo.js'
import {
  createRoute, addWaypoint, removeWaypoint, moveWaypoint,
  sampleRoutePath, routeStats, routeFingerprint, MAX_WAYPOINTS,
} from './route.js'

const dem = { lat: 36.998, lon: -110.0984, zoom: 12, size: 768 }
const geo = makeGeoContext(dem)
// flat fake elevation sampler: world (x,z) → meters
const flatElev = () => 1000

describe('route model', () => {
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
})
