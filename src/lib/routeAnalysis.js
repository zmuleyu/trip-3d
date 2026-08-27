import { routeStats, samplePolyline, sampleRoutePath } from './route.js'

const unavailable = (status) => ({ status, points: [], profile: null, stats: null })

export function consumeReadyRouteAnalysis(analysis, consume) {
  const points = analysis?.points
  const ready = analysis?.status === 'ready' && Array.isArray(points) && points.length >= 2 && points.every((point) =>
    [point.lon, point.lat, point.ele, point.cumDistM].every(Number.isFinite)
  )
  if (!ready || typeof consume !== 'function') return false
  consume(points)
  return true
}

export function syncRouteAnalysisConsumer(analysis, { render, clear } = {}) {
  if (consumeReadyRouteAnalysis(analysis, render)) return 'ready'
  clear?.()
  return 'unavailable'
}

export function analyzeRouteElevation({
  route,
  snappedGeometry = null,
  geo,
  sampleElevation,
  coverage = { covered: true },
} = {}) {
  if ((route?.waypoints?.length ?? 0) < 2) return unavailable('incomplete')
  if (!geo || typeof sampleElevation !== 'function') return unavailable('dem-unavailable')
  if (coverage?.covered === false) return unavailable('outside-coverage')

  const points = Array.isArray(snappedGeometry) && snappedGeometry.length >= 2
    ? samplePolyline(geo, snappedGeometry, sampleElevation)
    : sampleRoutePath(geo, route.waypoints, sampleElevation)
  const valid = points.length >= 2 && points.every((point) =>
    [point.lon, point.lat, point.ele, point.cumDistM].every(Number.isFinite)
  )
  if (!valid) return unavailable('dem-unavailable')

  const stats = routeStats(points)
  const elevations = points.map((point) => point.ele)
  return {
    status: 'ready',
    points,
    profile: {
      distanceM: stats.distanceM,
      minElevationM: Math.min(...elevations),
      maxElevationM: Math.max(...elevations),
    },
    stats,
  }
}
