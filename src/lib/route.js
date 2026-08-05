// Route model: waypoints + Catmull-Rom path sampling + stats. Pure module.
import { lonLatToWorld, worldToLonLat, haversineMeters } from './geo.js'

export const MAX_WAYPOINTS = 32
export const DEFAULT_SAMPLES = 240

export function createRoute(name = '未命名线路') {
  return { id: crypto.randomUUID(), name, waypoints: [], revision: 0, geometryRevision: 0, createdAt: Date.now() }
}

// revision: bumps on ANY user-visible change (incl. rename) — weather/labels bind here.
// geometryRevision: bumps only when waypoint coordinates/count/order change —
// snap geometry/legs bind here, so a rename never invalidates snapped state.
export function addWaypoint(route, lon, lat, ele, name) {
  if (route.waypoints.length >= MAX_WAYPOINTS) return null
  const wp = { id: crypto.randomUUID(), lon, lat, ele, name: name ?? `P${route.waypoints.length + 1}` }
  route.waypoints.push(wp)
  route.revision++
  route.geometryRevision++
  return wp
}

export function insertWaypoint(route, index, lon, lat, ele, name) {
  if (route.waypoints.length >= MAX_WAYPOINTS) return null
  const at = Math.max(0, Math.min(index, route.waypoints.length)) // clamp: end = append
  const wp = { id: crypto.randomUUID(), lon, lat, ele, name: name ?? `P${route.waypoints.length + 1}` }
  route.waypoints.splice(at, 0, wp)
  route.revision++
  route.geometryRevision++
  return wp
}

export function removeWaypoint(route, index) {
  if (!Number.isInteger(index) || index < 0 || index >= route.waypoints.length) return false
  route.waypoints.splice(index, 1)
  route.revision++
  route.geometryRevision++
  return true
}

export function moveWaypoint(route, from, to) {
  const n = route.waypoints.length
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= n || to >= n || from === to) return false
  const [wp] = route.waypoints.splice(from, 1)
  route.waypoints.splice(to, 0, wp)
  route.revision++
  route.geometryRevision++
  return true
}

// Arc-length resample of an arbitrary polyline (e.g. OSRM snapped geometry).
// coords: [[lon, lat], ...] → same pt shape as sampleRoutePath ({x,z,lon,lat,ele,cumDistM}).
export function samplePolyline(geo, coords, elevOf, nSamples = DEFAULT_SAMPLES) {
  if (!coords || coords.length < 2) return []
  if (nSamples < 2) throw new Error(`nSamples must be >= 2, got ${nSamples}`)
  const cps = coords.map(([lon, lat]) => lonLatToWorld(geo, lon, lat))
  const segLens = []
  let total = 0
  for (let i = 1; i < cps.length; i++) {
    const a = worldToLonLat(geo, cps[i - 1].x, cps[i - 1].z)
    const b = worldToLonLat(geo, cps[i].x, cps[i].z)
    const d = haversineMeters(a.lat, a.lon, b.lat, b.lon)
    segLens.push(d)
    total += d
  }
  const n = Math.max(2, nSamples)
  const pts = []
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1)
    let acc = 0
    let seg = 0
    while (seg < segLens.length - 1 && acc + segLens[seg] < target) { acc += segLens[seg]; seg++ }
    const span = segLens[seg] || 1
    const f = Math.min(1, Math.max(0, (target - acc) / span))
    const a = cps[seg], b = cps[seg + 1] ?? cps[seg]
    const x = a.x + (b.x - a.x) * f
    const z = a.z + (b.z - a.z) * f
    const ll = worldToLonLat(geo, x, z)
    pts.push({ x, z, lon: ll.lon, lat: ll.lat, ele: elevOf(x, z), cumDistM: target })
  }
  return pts
}

// Stable fingerprint of the route's waypoints — used to bind async weather
// results to the route version they were queried for (stale-response guard).
export function routeFingerprint(route) {
  const wps = route.waypoints
  if (!wps.length) return `${route.id}:empty`
  const f = wps[0], l = wps[wps.length - 1]
  const mid = wps.reduce((s, w) => s + w.lon * 1e-6 + w.lat * 1e-3, 0).toFixed(6)
  return `${route.id}:${wps.length}:${f.lon.toFixed(4)},${f.lat.toFixed(4)}:${l.lon.toFixed(4)},${l.lat.toFixed(4)}:${mid}`
}

// Catmull-Rom (uniform) over world-space control points; sampled by arc length.
// elevOf: (x, z) => meters — injected so tests can use fakes; production passes
// a closure over sampleDem() with exaggeration handled by the render layer.
export function sampleRoutePath(geo, waypoints, elevOf, nSamples = DEFAULT_SAMPLES) {
  if (waypoints.length < 2) return []
  if (nSamples < 2) throw new Error(`nSamples must be >= 2, got ${nSamples}`)
  const cps = waypoints.map((w) => {
    const { x, z } = lonLatToWorld(geo, w.lon, w.lat)
    return { x, z }
  })
  // dense polyline through Catmull-Rom segments (32 sub-steps per span)
  const dense = []
  const SUB = 32
  const cr = (p0, p1, p2, p3, t) =>
    0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)
  const pad = [cps[0], ...cps, cps[cps.length - 1]]
  for (let i = 0; i < pad.length - 3; i++) {
    for (let j = 0; j < SUB; j++) {
      const t = j / SUB
      dense.push({
        x: cr(pad[i].x, pad[i + 1].x, pad[i + 2].x, pad[i + 3].x, t),
        z: cr(pad[i].z, pad[i + 1].z, pad[i + 2].z, pad[i + 3].z, t),
      })
    }
  }
  dense.push(pad[pad.length - 2])

  // arc-length resample to nSamples, attaching lonLat + elevation + cumDistM
  const cum = [0]
  for (let i = 1; i < dense.length; i++) {
    const a = worldToLonLat(geo, dense[i - 1].x, dense[i - 1].z)
    const b = worldToLonLat(geo, dense[i].x, dense[i].z)
    cum.push(cum[i - 1] + haversineMeters(a.lat, a.lon, b.lat, b.lon))
  }
  const total = cum[cum.length - 1]
  const out = []
  let k = 0
  for (let i = 0; i < nSamples; i++) {
    const target = (i / (nSamples - 1)) * total
    while (k < cum.length - 2 && cum[k + 1] < target) k++
    const span = cum[k + 1] - cum[k] || 1
    const f = (target - cum[k]) / span
    const x = dense[k].x + (dense[k + 1].x - dense[k].x) * f
    const z = dense[k].z + (dense[k + 1].z - dense[k].z) * f
    const { lon, lat } = worldToLonLat(geo, x, z)
    out.push({ x, z, lon, lat, ele: elevOf(x, z), cumDistM: target })
  }
  return out
}

// Heuristic drive time (示意): 40 km/h flat baseline + 10 min per 300 m ascent.
export function routeStats(pts) {
  if (!pts.length) return { distanceM: 0, ascentM: 0, descentM: 0, maxEle: 0, minEle: 0, driveMinutes: 0 }
  let ascent = 0, descent = 0, maxEle = -Infinity, minEle = Infinity
  for (let i = 0; i < pts.length; i++) {
    maxEle = Math.max(maxEle, pts[i].ele)
    minEle = Math.min(minEle, pts[i].ele)
    if (i > 0) {
      const d = pts[i].ele - pts[i - 1].ele
      if (d > 0) ascent += d
      else descent -= d
    }
  }
  const distanceM = pts[pts.length - 1].cumDistM
  const driveMinutes = Math.round(distanceM / 1000 / 40 * 60 + (ascent / 300) * 10)
  return { distanceM, ascentM: Math.round(ascent), descentM: Math.round(descent), maxEle: Math.round(maxEle), minEle: Math.round(minEle), driveMinutes }
}
