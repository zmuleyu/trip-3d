// Route × admin-region crossing stats. Pure module.
// entries: outside→inside transitions (starting inside counts as one visit).
// distanceMeters: spherical (haversine) length of the sub-segments inside the ring.
import { haversineMeters } from './geo.js'
import { pointInRing } from './adminBoundaries.js' // same ray-cast as findDeepestAdminRegion

const toLonLat = (p) => (Array.isArray(p) ? p : [p.lon, p.lat])

// Arc-length densify of a sparse lon/lat polyline (same resample strategy as
// route.js samplePolyline): split any segment longer than maxSegmentMeters.
function densify(pts, maxSegmentMeters) {
  if (!Number.isFinite(maxSegmentMeters) || maxSegmentMeters <= 0) return pts
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const d = haversineMeters(a[1], a[0], b[1], b[0])
    const n = Math.max(1, Math.ceil(d / maxSegmentMeters))
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}

// Parametric t in (0,1) where segment a→b crosses ring edge c→d, else null.
function segmentEdgeT(a, b, c, d) {
  const rx = b[0] - a[0]
  const ry = b[1] - a[1]
  const sx = d[0] - c[0]
  const sy = d[1] - c[1]
  const denom = rx * sy - ry * sx
  if (Math.abs(denom) < 1e-18) return null
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / denom
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / denom
  if (t <= 1e-9 || t >= 1 - 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null
  return t
}

// routePoints: [[lon, lat], ...] or [{lon, lat}, ...]; region: { ring: [[lon, lat], ...] }.
// Returns { entries, distanceMeters } or null for degenerate input.
export function computeRegionRouteStats(routePoints, region, { maxSegmentMeters = 500 } = {}) {
  const ring = region?.ring
  if (!Array.isArray(ring) || ring.length < 3) return null
  if (!Array.isArray(routePoints) || routePoints.length < 2) return null
  const pts = densify(routePoints.map(toLonLat), maxSegmentMeters)
  let entries = 0
  let distanceMeters = 0
  let inside = false
  let started = false
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const ts = []
    for (let j = 0, k = ring.length - 1; j < ring.length; k = j++) {
      const t = segmentEdgeT(a, b, ring[k], ring[j])
      if (t != null) ts.push(t)
    }
    ts.sort((x, y) => x - y)
    const cuts = []
    for (const t of ts) if (!cuts.length || t - cuts[cuts.length - 1] > 1e-7) cuts.push(t)
    const stops = [0, ...cuts, 1]
    for (let s = 1; s < stops.length; s++) {
      const t0 = stops[s - 1]
      const t1 = stops[s]
      const midInside = pointInRing(a[0] + ((b[0] - a[0]) * (t0 + t1)) / 2, a[1] + ((b[1] - a[1]) * (t0 + t1)) / 2, ring)
      if (!started) {
        started = true
        if (midInside) entries = 1
      } else if (midInside && !inside) entries++
      inside = midInside
      if (midInside) {
        distanceMeters += haversineMeters(a[1] + (b[1] - a[1]) * t0, a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t1, a[0] + (b[0] - a[0]) * t1)
      }
    }
  }
  return { entries, distanceMeters }
}

export function formatRouteStats(stat) {
  if (!stat) return ''
  const km = stat.distanceMeters / 1000
  const text = km <= 0 ? '0' : km >= 10 ? String(Math.round(km)) : (Math.round(km * 10) / 10).toFixed(1)
  return `进入 ${stat.entries} 次 · 预计途经 ${text} km`
}
