import { reconcileRouteSelection, routeSelectionIndex, segmentRouteSelection } from './routeSelection.js'

function routeDistanceBounds(points) {
  if (!Array.isArray(points) || points.length < 2) return null
  const startM = points[0]?.cumDistM
  const endM = points.at(-1)?.cumDistM
  return Number.isFinite(startM) && Number.isFinite(endM) && endM >= startM ? { startM, endM } : null
}

function nearestPointDistance(points, waypoint) {
  if (!waypoint || !Array.isArray(points)) return null
  let closest = null
  for (const point of points) {
    if (![point?.lon, point?.lat, point?.cumDistM].every(Number.isFinite)) continue
    const distance = (point.lon - waypoint.lon) ** 2 + (point.lat - waypoint.lat) ** 2
    if (!closest || distance < closest.distance) closest = { distance, distanceM: point.cumDistM }
  }
  return closest?.distanceM ?? null
}

export function analysisSegmentRanges(route, points, legs = []) {
  const waypoints = route?.waypoints ?? []
  const bounds = routeDistanceBounds(points)
  if (waypoints.length < 2 || !bounds) return []
  const totalM = bounds.endM - bounds.startM
  const legDistances = legs.length === waypoints.length - 1 ? legs.map((leg) => Number(leg?.distanceM)) : []
  const canUseLegDistances = legDistances.length && legDistances.every((distance) => Number.isFinite(distance) && distance >= 0)
  const legTotalM = canUseLegDistances ? legDistances.reduce((sum, distance) => sum + distance, 0) : 0
  const waypointDistances = waypoints.map((waypoint) => nearestPointDistance(points, waypoint))
  const canUseWaypointDistances = waypointDistances.every(Number.isFinite)
  let previousEndM = bounds.startM
  return waypoints.slice(1).map((to, index) => {
    const selection = segmentRouteSelection(route, index)
    let startM
    let endM
    if (legTotalM > 0) {
      const before = legDistances.slice(0, index).reduce((sum, distance) => sum + distance, 0)
      startM = bounds.startM + totalM * (before / legTotalM)
      endM = bounds.startM + totalM * ((before + legDistances[index]) / legTotalM)
    } else if (canUseWaypointDistances) {
      startM = Math.max(previousEndM, waypointDistances[index])
      endM = Math.max(startM, waypointDistances[index + 1])
    } else {
      startM = bounds.startM + totalM * (index / (waypoints.length - 1))
      endM = bounds.startM + totalM * ((index + 1) / (waypoints.length - 1))
    }
    previousEndM = endM
    return { selection, index, from: waypoints[index], to, startM, endM, leg: legs[index] ?? null }
  }).filter((segment) => segment.selection)
}

export function analysisSegmentForSelection(selection, route, points, legs) {
  const reconciled = reconcileRouteSelection(selection, route)
  if (reconciled?.kind !== 'segment') return null
  return analysisSegmentRanges(route, points, legs).find((segment) => routeSelectionIndex(segment.selection, route) === routeSelectionIndex(reconciled, route)) ?? null
}

export function analysisSegmentAtDistance(route, points, legs, distanceM) {
  if (!Number.isFinite(distanceM)) return null
  return analysisSegmentRanges(route, points, legs).find((segment, index, segments) => (
    distanceM >= segment.startM && (distanceM < segment.endM || index === segments.length - 1)
  )) ?? null
}

export function adjacentAnalysisSegment(selection, route, points, legs, direction) {
  const segments = analysisSegmentRanges(route, points, legs)
  if (!segments.length) return null
  const current = analysisSegmentForSelection(selection, route, points, legs)
  const index = current ? current.index : (direction < 0 ? segments.length : -1)
  return segments[Math.max(0, Math.min(segments.length - 1, index + (direction < 0 ? -1 : 1)))] ?? null
}
