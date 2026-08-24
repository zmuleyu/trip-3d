const NEUTRAL_BEARING = -28

function finiteCoordinate(coordinate) {
  const lon = Number(coordinate?.[0])
  const lat = Number(coordinate?.[1])
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90
    ? [lon, lat]
    : null
}

function shortestLongitudeDelta(from, to) {
  const delta = ((to - from + 540) % 360) - 180
  // Keep an exact 180-degree segment deterministic instead of inheriting the
  // input's wrap direction.
  return delta === -180 ? 180 : delta
}

function normalizeBearing(bearing) {
  return ((bearing + 540) % 360) - 180
}

/**
 * Returns the MapLibre bearing that places the first usable route segment from
 * the near foreground toward the horizon. The source coordinates stay intact;
 * only the longitude delta used for the local bearing calculation is wrapped.
 */
export function routeCameraBearing(coordinates, neutralBearing = NEUTRAL_BEARING) {
  const usable = (coordinates ?? []).map(finiteCoordinate).filter(Boolean)
  for (let index = 1; index < usable.length; index++) {
    const [fromLon, fromLat] = usable[index - 1]
    const [toLon, toLat] = usable[index]
    const longitudeDelta = shortestLongitudeDelta(fromLon, toLon)
    const latitudeDelta = toLat - fromLat
    const east = longitudeDelta * Math.cos(((fromLat + toLat) / 2) * Math.PI / 180)
    if (Math.hypot(east, latitudeDelta) < 1e-9) continue
    const forwardBearing = Math.atan2(east, latitudeDelta) * 180 / Math.PI
    return normalizeBearing(-forwardBearing)
  }
  return normalizeBearing(neutralBearing)
}

export const ROUTE_VIEW_NEUTRAL_BEARING = NEUTRAL_BEARING
