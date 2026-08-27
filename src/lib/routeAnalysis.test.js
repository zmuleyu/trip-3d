import { describe, expect, it, vi } from 'vitest'
import { makeGeoContext, worldToLonLat } from './geo.js'
import { analyzeRouteElevation, consumeReadyRouteAnalysis, syncRouteAnalysisConsumer } from './routeAnalysis.js'

const dem = { lat: 31.108, lon: 102.884, zoom: 12, size: 768 }
const geo = makeGeoContext(dem)
const lonLat = (x, z) => worldToLonLat(geo, x, z)
const waypoint = (id, x, z) => ({ id, name: id, ...lonLat(x, z), ele: 0 })
const route = {
  id: 'route-a',
  waypoints: [waypoint('A', -10, 0), waypoint('B', 10, 0)],
}
const rawElevation = (x, z) => 1200 + x * 3 + z * 10

describe('raw DEM route analysis', () => {
  it('returns raw meter points, profile bounds, and stats without accepting visual exaggeration', () => {
    const base = analyzeRouteElevation({ route, geo, sampleElevation: rawElevation, coverage: { covered: true } })
    const exaggeratedVisualRequest = analyzeRouteElevation({
      route,
      geo,
      sampleElevation: rawElevation,
      coverage: { covered: true },
      demExaggeration: 5,
    })

    expect(base.status).toBe('ready')
    expect(base.points).toHaveLength(240)
    expect(base.points.map((point) => point.ele)).toEqual(exaggeratedVisualRequest.points.map((point) => point.ele))
    expect(base.profile).toEqual({
      distanceM: base.stats.distanceM,
      minElevationM: Math.min(...base.points.map((point) => point.ele)),
      maxElevationM: Math.max(...base.points.map((point) => point.ele)),
    })
    expect(base.stats.minEle).toBe(Math.round(base.profile.minElevationM))
    expect(base.stats.maxEle).toBe(Math.round(base.profile.maxElevationM))
  })

  it('uses snapped and non-snapped geometry through the same result contract', () => {
    const direct = analyzeRouteElevation({ route, geo, sampleElevation: rawElevation, coverage: { covered: true } })
    const snappedGeometry = [lonLat(-10, 0), lonLat(0, 6), lonLat(10, 0)].map(({ lon, lat }) => [lon, lat])
    const snapped = analyzeRouteElevation({
      route,
      snappedGeometry,
      geo,
      sampleElevation: rawElevation,
      coverage: { covered: true },
    })

    for (const result of [direct, snapped]) {
      expect(Object.keys(result).sort()).toEqual(['points', 'profile', 'stats', 'status'])
      expect(result.status).toBe('ready')
      expect(result.points).toHaveLength(240)
      expect(result.profile.distanceM).toBe(result.stats.distanceM)
    }
    expect(snapped.profile.maxElevationM).toBeGreaterThan(direct.profile.maxElevationM)
  })

  it('fails closed for incomplete routes, missing DEM access, and coverage gaps', () => {
    const expected = (status) => ({ status, points: [], profile: null, stats: null })
    expect(analyzeRouteElevation({ route: { waypoints: [route.waypoints[0]] }, geo, sampleElevation: rawElevation }))
      .toEqual(expected('incomplete'))
    expect(analyzeRouteElevation({ route, geo: null, sampleElevation: rawElevation }))
      .toEqual(expected('dem-unavailable'))
    expect(analyzeRouteElevation({ route, geo, sampleElevation: null }))
      .toEqual(expected('dem-unavailable'))
    expect(analyzeRouteElevation({ route, geo, sampleElevation: rawElevation, coverage: { covered: false } }))
      .toEqual(expected('outside-coverage'))
  })

  it('withholds results when the elevation sampler returns non-finite data', () => {
    const analysis = analyzeRouteElevation({ route, geo, sampleElevation: () => Number.NaN, coverage: { covered: true } })
    const legacyUpdate = vi.fn()

    expect(analysis).toEqual({ status: 'dem-unavailable', points: [], profile: null, stats: null })
    expect(consumeReadyRouteAnalysis(analysis, legacyUpdate)).toBe(false)
    expect(legacyUpdate).not.toHaveBeenCalled()
  })

  it('calls a legacy consumer only for a ready analysis and forwards the shared points', () => {
    const analysis = analyzeRouteElevation({ route, geo, sampleElevation: rawElevation, coverage: { covered: true } })
    const legacyUpdate = vi.fn()

    expect(consumeReadyRouteAnalysis(analysis, legacyUpdate)).toBe(true)
    expect(legacyUpdate).toHaveBeenCalledExactlyOnceWith(analysis.points)
  })

  it('clears an existing legacy visual on unavailable analysis and renders again when raw data recovers', () => {
    const ready = analyzeRouteElevation({ route, geo, sampleElevation: rawElevation, coverage: { covered: true } })
    const unavailable = analyzeRouteElevation({ route, geo, sampleElevation: () => Number.NaN, coverage: { covered: true } })
    const routeIdentity = route
    const render = vi.fn()
    const clear = vi.fn()

    expect(syncRouteAnalysisConsumer(ready, { render, clear })).toBe('ready')
    expect(syncRouteAnalysisConsumer(unavailable, { render, clear })).toBe('unavailable')
    expect(syncRouteAnalysisConsumer(ready, { render, clear })).toBe('ready')

    expect(render).toHaveBeenNthCalledWith(1, ready.points)
    expect(render).toHaveBeenNthCalledWith(2, ready.points)
    expect(clear).toHaveBeenCalledExactlyOnceWith()
    expect(route).toBe(routeIdentity)
    expect(route.waypoints.map((point) => point.id)).toEqual(['A', 'B'])
  })
})
