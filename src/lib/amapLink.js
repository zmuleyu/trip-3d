// Amap (高德) share-link interop — parse & build /ssr/dir URLs.
// No API key involved: pure URL parsing + GCJ-02↔WGS-84 conversion.
import { gcj02ToWgs84, wgs84ToGcj02 } from './gcj02.js'

function mkPoint(name, lonStr, latStr) {
  const lon = parseFloat(lonStr)
  const lat = parseFloat(latStr)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  const w = gcj02ToWgs84(lon, lat)
  return { name: name || '', lon: w.lon, lat: w.lat }
}

// parseAmapLink(url) → { from, to, vias: [] } in WGS-84, or null.
export function parseAmapLink(urlStr) {
  let u
  try {
    u = new URL(urlStr)
  } catch {
    return null
  }
  if (!u.hostname.endsWith('amap.com')) return null
  const p = u.searchParams
  const from = mkPoint(p.get('fname'), p.get('flon'), p.get('flat'))
  const to = mkPoint(p.get('dname'), p.get('dlon'), p.get('dlat'))
  const names = (p.get('vname') ?? '').split('|')
  const lats = (p.get('vlat') ?? '').split('|')
  const lons = (p.get('vlon') ?? '').split('|')
  const vias = []
  for (let i = 0; i < names.length; i++) {
    const v = mkPoint(names[i] || '', lons[i], lats[i])
    if (v) vias.push(v)
  }
  if (!from && !vias.length) return null
  return { from, to, vias }
}

const enc = encodeURIComponent
const num = (v) => String(Math.round(v * 1e7) / 1e7)

// buildAmapLink(route) → amap /ssr/dir URL (GCJ-02 coords), or null if <2 points.
export function buildAmapLink(route) {
  const wps = route.waypoints ?? []
  if (wps.length < 2) return null
  const g = wps.map((w) => {
    const c = wgs84ToGcj02(w.lon, w.lat)
    return { name: w.name ?? '', lon: c.lon, lat: c.lat }
  })
  const [from, to] = [g[0], g[g.length - 1]]
  const vias = g.slice(1, -1)
  const q = new URLSearchParams()
  q.set('fname', from.name)
  q.set('flat', num(from.lat))
  q.set('flon', num(from.lon))
  q.set('dname', to.name)
  q.set('dlat', num(to.lat))
  q.set('dlon', num(to.lon))
  q.set('policy', '10')
  q.set('type', '0')
  if (vias.length) {
    q.set('vname', vias.map((v) => v.name).join('|'))
    q.set('vlat', vias.map((v) => num(v.lat)).join('|'))
    q.set('vlon', vias.map((v) => num(v.lon)).join('|'))
  }
  // URLSearchParams encodes automatically; amap accepts %7C for pipes
  return `https://www.amap.com/ssr/dir?${q.toString()}`
}
