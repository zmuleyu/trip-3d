import { describe, expect, it, vi } from 'vitest'
import { makeGeoContext, worldToLonLat } from './geo.js'
import { analyzeRouteElevation, consumeReadyRouteAnalysis, deriveRouteGrade, sampleRouteAnalysisPath, sampleRouteGradeAtDistance, syncRouteAnalysisConsumer } from './routeAnalysis.js'

const dem = { lat: 31.108, lon: 102.884, zoom: 12, size: 768, metersPerPixel: 30 }
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
    expect(base.grade).toEqual(exaggeratedVisualRequest.grade)
    expect(base.grade.status).toBe('ready')
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
      expect(Object.keys(result).sort()).toEqual(['grade', 'points', 'profile', 'stats', 'status'])
      expect(result.status).toBe('ready')
      expect(result.points).toHaveLength(240)
      expect(result.profile.distanceM).toBe(result.stats.distanceM)
    }
    expect(snapped.profile.maxElevationM).toBeGreaterThan(direct.profile.maxElevationM)
  })

  it('enumerates the same 240 raw or snapped analysis points before corridor loading', () => {
    const snappedGeometry = [lonLat(-10, 0), lonLat(0, 6), lonLat(10, 0)].map(({ lon, lat }) => [lon, lat])

    expect(sampleRouteAnalysisPath({ route, geo })).toHaveLength(240)
    expect(sampleRouteAnalysisPath({ route, snappedGeometry, geo })).toHaveLength(240)
  })

  it('uses route-wide lon/lat Terrarium samples and resolution outside the visual DEM window', () => {
    const corridorRoute = {
      id: 'route-corridor',
      waypoints: [waypoint('A', -40, 0), waypoint('B', 40, 0)],
    }
    const sampleElevation = vi.fn((_x, _z, point) => 1200 + point.lon * 2 + point.lat)
    const analysis = analyzeRouteElevation({
      route: corridorRoute,
      geo,
      sampleElevation,
      coverage: { covered: true, source: 'route-corridor', metersPerPixel: 24 },
    })

    expect(analysis.status).toBe('ready')
    expect(analysis.points).toHaveLength(240)
    expect(analysis.grade).toMatchObject({ status: 'ready', metersPerPixel: 24 })
    expect(sampleElevation).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.objectContaining({ lon: expect.any(Number), lat: expect.any(Number) }))
  })

  it('fails closed for incomplete routes, missing DEM access, and coverage gaps', () => {
    const expected = (status) => ({ status, points: [], profile: null, stats: null, grade: null })
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

    expect(analysis).toEqual({ status: 'dem-unavailable', points: [], profile: null, stats: null, grade: null })
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

describe('trusted route grade', () => {
  const gradeGeo = (metersPerPixel = 20, point = { px: 5, py: 5 }) => ({
    dem: { metersPerPixel, size: 10 },
    worldToPx: () => point,
  })
  const points = [
    { x: 0, z: 0, ele: 100, cumDistM: 0 },
    { x: 1, z: 0, ele: 120, cumDistM: 200 },
    { x: 2, z: 0, ele: 140, cumDistM: 400 },
  ]

  it('uses a signed percent secant over a resolution-aware window and distance-weighted average', () => {
    const grade = deriveRouteGrade(points, gradeGeo())

    expect(grade).toMatchObject({
      status: 'ready',
      minimumRunM: 100,
      sampleSpacingM: 200,
      windowM: 800,
      averageAbsPct: 10,
      maxUphillPct: 10,
      maxDownhillPct: null,
    })
    expect(sampleRouteGradeAtDistance(grade, 100)).toBeCloseTo(10, 8)
  })

  it('keeps downhill negative and does not substitute degrees for percent', () => {
    const descending = points.map((point) => ({ ...point, ele: 140 - point.cumDistM / 10 }))
    const grade = deriveRouteGrade(descending, gradeGeo())

    expect(grade.averageAbsPct).toBeCloseTo(10, 8)
    expect(grade.maxUphillPct).toBeNull()
    expect(grade.maxDownhillPct).toBeCloseTo(-10, 8)
  })

  it.each([
    ['short route', points.map((point) => ({ ...point, cumDistM: point.cumDistM / 10 })), gradeGeo()],
    ['zero distance', points.map((point) => ({ ...point, cumDistM: 0 })), gradeGeo()],
    ['outside DEM canvas', points, gradeGeo(20, { px: 12, py: 5 })],
  ])('fails closed for %s', (_label, candidatePoints, candidateGeo) => {
    const grade = deriveRouteGrade(candidatePoints, candidateGeo)

    expect(grade.status).not.toBe('ready')
    expect(grade.samples).toEqual([])
    expect(grade.averageAbsPct).toBeNull()
    expect(grade.maxUphillPct).toBeNull()
    expect(grade.maxDownhillPct).toBeNull()
  })
})
