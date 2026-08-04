// Route model: waypoints + Catmull-Rom path sampling + stats. Pure module.
import { lonLatToWorld, worldToLonLat, haversineMeters } from './geo.js'

export const MAX_WAYPOINTS = 32
export const DEFAULT_SAMPLES = 240

export function createRoute(name = '未命名线路') {
  return { id: crypto.randomUUID(), name, createdAt: Date.now(), waypoints: [] }
}

export function addWaypoint(route, lon, lat, ele, name) {
  if (route.waypoints.length >= MAX_WAYPOINTS) return null
  const wp = { id: crypto.randomUUID(), lon, lat, ele, name: name ?? `P${route.waypoints.length + 1}` }
  route.waypoints.push(wp)
  return wp
}

export function removeWaypoint(route, index) {
  route.waypoints.splice(index, 1)
}

export function moveWaypoint(route, from, to) {
  const [wp] = route.waypoints.splice(from, 1)
  route.waypoints.splice(to, 0, wp)
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
