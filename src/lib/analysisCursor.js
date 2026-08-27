const validPoint = (point) => [point?.lon, point?.lat, point?.ele, point?.cumDistM].every(Number.isFinite)

export function analysisPointsReady(points) {
  return Array.isArray(points) && points.length >= 2 && points.every(validPoint)
}

export function initialAnalysisCursorDistance(points, currentDistanceM) {
  if (!analysisPointsReady(points)) return null
  return Number.isFinite(currentDistanceM) ? currentDistanceM : points[0].cumDistM
}

export function sampleAnalysisAtDistance(points, distanceM) {
  if (!analysisPointsReady(points) || !Number.isFinite(distanceM)) return null
  const first = points[0]
  const last = points.at(-1)
  const distance = Math.max(first.cumDistM, Math.min(last.cumDistM, distanceM))
  for (let index = 1; index < points.length; index++) {
    const next = points[index]
    if (distance > next.cumDistM) continue
    const previous = points[index - 1]
    const span = next.cumDistM - previous.cumDistM
    const fraction = span > 0 ? (distance - previous.cumDistM) / span : 0
    return {
      distanceM: distance,
      lon: previous.lon + (next.lon - previous.lon) * fraction,
      lat: previous.lat + (next.lat - previous.lat) * fraction,
      ele: previous.ele + (next.ele - previous.ele) * fraction,
    }
  }
  return { distanceM: last.cumDistM, lon: last.lon, lat: last.lat, ele: last.ele }
}

export function nearestAnalysisDistance(points, lon, lat) {
  if (!analysisPointsReady(points) || !Number.isFinite(lon) || !Number.isFinite(lat)) return null
  const scaleX = Math.cos(lat * Math.PI / 180)
  let best = null
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1]
    const end = points[index]
    const dx = (end.lon - start.lon) * scaleX
    const dy = end.lat - start.lat
    const lengthSquared = dx * dx + dy * dy
    const rawFraction = lengthSquared > 0
      ? (((lon - start.lon) * scaleX * dx) + ((lat - start.lat) * dy)) / lengthSquared
      : 0
    const fraction = Math.max(0, Math.min(1, rawFraction))
    const projectedLon = start.lon + (end.lon - start.lon) * fraction
    const projectedLat = start.lat + (end.lat - start.lat) * fraction
    const offsetX = (lon - projectedLon) * scaleX
    const offsetY = lat - projectedLat
    const distanceSquared = offsetX * offsetX + offsetY * offsetY
    if (!best || distanceSquared < best.distanceSquared) {
      best = {
        distanceSquared,
        distanceM: start.cumDistM + (end.cumDistM - start.cumDistM) * fraction,
      }
    }
  }
  return best?.distanceM ?? null
}

export function nearestAnalysisIndex(points, distanceM) {
  if (!analysisPointsReady(points) || !Number.isFinite(distanceM)) return null
  return points.reduce((nearest, point, index) => (
    Math.abs(point.cumDistM - distanceM) < Math.abs(points[nearest].cumDistM - distanceM) ? index : nearest
  ), 0)
}
