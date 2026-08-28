// Per-leg stats — pure module.
// computeLegs: straight-line segmentation between consecutive waypoints
// (haversine distance + waypoint ele diffs + drive-time heuristic).
// normalizeOsrmLegs: attach waypoint names to OSRM legs (real routed segments).
import { haversineMeters } from './geo.js'

export function computeHorizontalLegs(waypoints) {
  if (!waypoints || waypoints.length < 2) return []
  return waypoints.slice(1).map((to, index) => {
    const from = waypoints[index]
    return {
      from: from.name,
      to: to.name,
      distanceM: Math.round(haversineMeters(from.lat, from.lon, to.lat, to.lon)),
      real: false,
      elevationStatus: 'unavailable',
    }
  })
}

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

// Legs along the ACTUAL rendered geometry (spline/polyline sample pts) — the
// distances match what the user sees and what routeStats totals. Each waypoint
// maps to its nearest sampled point; segment stats come from sampled subranges.
export function computeLegsFromPts(pts, waypoints) {
  if (!pts?.length || !waypoints || waypoints.length < 2) return null
  const idx = waypoints.map((w) => {
    let best = 0
    let bd = Infinity
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i].lon - w.lon) ** 2 + (pts[i].lat - w.lat) ** 2
      if (d < bd) { bd = d; best = i }
    }
    return best
  })
  const legs = []
  for (let i = 1; i < waypoints.length; i++) {
    const i0 = idx[i - 1]
    const i1 = idx[i]
    const distanceM = Math.round(Math.max(0, pts[i1].cumDistM - pts[i0].cumDistM))
    let ascentM = 0
    let descentM = 0
    for (let j = i0 + 1; j <= i1; j++) {
      const d = pts[j].ele - pts[j - 1].ele
      if (d > 0) ascentM += d
      else descentM -= d
    }
    ascentM = Math.round(ascentM)
    descentM = Math.round(descentM)
    const driveMinutes = Math.round((distanceM / 1000 / 40) * 60 + (ascentM / 300) * 10)
    legs.push({ from: waypoints[i - 1].name, to: waypoints[i].name, distanceM, ascentM, descentM, driveMinutes, real: false })
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
