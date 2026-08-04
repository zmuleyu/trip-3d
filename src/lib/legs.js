// Per-leg stats — pure module.
// computeLegs: straight-line segmentation between consecutive waypoints
// (haversine distance + waypoint ele diffs + drive-time heuristic).
// normalizeOsrmLegs: attach waypoint names to OSRM legs (real routed segments).
import { haversineMeters } from './geo.js'

export function computeLegs(waypoints) {
  if (!waypoints || waypoints.length < 2) return []
  const legs = []
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1]
    const b = waypoints[i]
    const distanceM = Math.round(haversineMeters(a.lat, a.lon, b.lat, b.lon))
    const dEle = b.ele - a.ele
    const ascentM = Math.max(0, Math.round(dEle))
    const descentM = Math.max(0, Math.round(-dEle))
    // same heuristic as routeStats: 40km/h + 10min per 300m ascent
    const driveMinutes = Math.round((distanceM / 1000 / 40) * 60 + (ascentM / 300) * 10)
    legs.push({ from: a.name, to: b.name, distanceM, ascentM, descentM, driveMinutes, real: false })
  }
  return legs
}

// OSRM returns n-1 legs for n waypoints; mismatch (e.g. segment fallback paths) → null.
export function normalizeOsrmLegs(osrmLegs, waypoints) {
  if (!osrmLegs?.length || !waypoints || osrmLegs.length !== waypoints.length - 1) return null
  return osrmLegs.map((l, i) => ({
    from: waypoints[i].name,
    to: waypoints[i + 1].name,
    distanceM: Math.round(l.distanceM),
    durationS: Math.round(l.durationS),
    ascentM: null, // OSRM legs carry no elevation
    descentM: null,
    real: true,
  }))
}
