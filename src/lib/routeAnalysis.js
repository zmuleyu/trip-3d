import { routeStats, samplePolyline, sampleRoutePath } from './route.js'

const unavailable = (status) => ({ status, points: [], profile: null, stats: null, grade: null })

const gradeUnavailable = (status, details = {}) => ({
  status,
  samples: [],
  averageAbsPct: null,
  maxUphillPct: null,
  maxDownhillPct: null,
  ...details,
})

function elevationAtDistance(points, distanceM) {
  const first = points[0]
  const last = points.at(-1)
  const distance = Math.max(first.cumDistM, Math.min(last.cumDistM, distanceM))
  for (let index = 1; index < points.length; index++) {
    const next = points[index]
    if (distance > next.cumDistM) continue
    const previous = points[index - 1]
    const span = next.cumDistM - previous.cumDistM
    const fraction = span > 0 ? (distance - previous.cumDistM) / span : 0
    return previous.ele + (next.ele - previous.ele) * fraction
  }
  return last.ele
}

function pointsStayWithinDem(points, geo) {
  const size = geo?.dem?.size
  if (!Number.isFinite(size) || size <= 1 || typeof geo?.worldToPx !== 'function') return false
  return points.every((point) => {
    const { px, py } = geo.worldToPx(point.x, point.z)
    return Number.isFinite(px) && Number.isFinite(py) && px >= 0 && px <= size - 1 && py >= 0 && py <= size - 1
  })
}

export function deriveRouteGrade(points, geo) {
  const metersPerPixel = Number(geo?.dem?.metersPerPixel)
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return gradeUnavailable('resolution-unavailable')
  const validPoints = Array.isArray(points) && points.length >= 2 && points.every((point) =>
    [point?.x, point?.z, point?.ele, point?.cumDistM].every(Number.isFinite)
  )
  if (!validPoints) return gradeUnavailable('elevation-unavailable')
  if (!pointsStayWithinDem(points, geo)) return gradeUnavailable('outside-coverage')

  const totalDistanceM = points.at(-1).cumDistM - points[0].cumDistM
  const sampleSpacingM = totalDistanceM / (points.length - 1)
  const minimumRunM = Math.max(100, metersPerPixel * 3)
  if (!Number.isFinite(totalDistanceM) || !Number.isFinite(sampleSpacingM) || totalDistanceM < minimumRunM || sampleSpacingM <= 0) {
    return gradeUnavailable('insufficient-distance', { metersPerPixel, sampleSpacingM, minimumRunM, windowM: null })
  }
  const windowM = Math.max(minimumRunM * 2, sampleSpacingM * 4)
  const startDistanceM = points[0].cumDistM
  const endDistanceM = points.at(-1).cumDistM
  const samples = points.map((point) => {
    const fromDistanceM = Math.max(startDistanceM, point.cumDistM - windowM / 2)
    const toDistanceM = Math.min(endDistanceM, point.cumDistM + windowM / 2)
    const runM = toDistanceM - fromDistanceM
    if (runM < minimumRunM) return null
    const fromElevationM = elevationAtDistance(points, fromDistanceM)
    const toElevationM = elevationAtDistance(points, toDistanceM)
    const gradePct = ((toElevationM - fromElevationM) / runM) * 100
    return Number.isFinite(gradePct) ? { distanceM: point.cumDistM, gradePct } : null
  })
  if (samples.some((sample) => !sample)) {
    return gradeUnavailable('insufficient-distance', { metersPerPixel, sampleSpacingM, minimumRunM, windowM })
  }

  let weightedAbsoluteGrade = 0
  let weightedDistanceM = 0
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1]
    const next = samples[index]
    const runM = next.distanceM - previous.distanceM
    if (runM <= 0) return gradeUnavailable('insufficient-distance', { metersPerPixel, sampleSpacingM, minimumRunM, windowM })
    weightedAbsoluteGrade += ((Math.abs(previous.gradePct) + Math.abs(next.gradePct)) / 2) * runM
    weightedDistanceM += runM
  }
  if (weightedDistanceM <= 0) return gradeUnavailable('insufficient-distance', { metersPerPixel, sampleSpacingM, minimumRunM, windowM })

  const positive = samples.map((sample) => sample.gradePct).filter((gradePct) => gradePct > 0)
  const negative = samples.map((sample) => sample.gradePct).filter((gradePct) => gradePct < 0)
  return {
    status: 'ready',
    metersPerPixel,
    sampleSpacingM,
    minimumRunM,
    windowM,
    samples,
    averageAbsPct: weightedAbsoluteGrade / weightedDistanceM,
    maxUphillPct: positive.length ? Math.max(...positive) : null,
    maxDownhillPct: negative.length ? Math.min(...negative) : null,
  }
}

export function sampleRouteGradeAtDistance(grade, distanceM) {
  const samples = grade?.status === 'ready' ? grade.samples : null
  if (!Array.isArray(samples) || samples.length < 2 || !Number.isFinite(distanceM)) return null
  const first = samples[0]
  const last = samples.at(-1)
  const distance = Math.max(first.distanceM, Math.min(last.distanceM, distanceM))
  for (let index = 1; index < samples.length; index++) {
    const next = samples[index]
    if (distance > next.distanceM) continue
    const previous = samples[index - 1]
    const span = next.distanceM - previous.distanceM
    const fraction = span > 0 ? (distance - previous.distanceM) / span : 0
    const gradePct = previous.gradePct + (next.gradePct - previous.gradePct) * fraction
    return Number.isFinite(gradePct) ? gradePct : null
  }
  return last.gradePct
}

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
    grade: deriveRouteGrade(points, geo),
  }
}
