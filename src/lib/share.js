// URL-hash share codec: { v, dem:{lat,lon,zoom}, name, waypoints } ↔ base64url.
import { MAX_WAYPOINTS } from './route.js'

const VERSION = 1

const b64urlEncode = (obj) => {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const b64urlDecode = (s) => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('invalid base64url charset')
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  b64 += '='.repeat((4 - (b64.length % 4)) % 4) // restore stripped padding
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function encodeShare(route, ctx) {
  return b64urlEncode({
    v: VERSION,
    dem: { lat: ctx.dem.lat, lon: ctx.dem.lon, zoom: ctx.dem.zoom },
    name: route.name,
    waypoints: route.waypoints.map(({ lon, lat, ele, name }) => [lon, lat, ele, name]),
  })
}

const finiteNum = (x) => typeof x === 'number' && Number.isFinite(x)

export function decodeShare(hash) {
  const obj = b64urlDecode(hash)
  if (obj.v !== VERSION) throw new Error(`unsupported share version: ${obj.v}`)
  const { dem, waypoints } = obj
  const demOk = dem && finiteNum(dem.lat) && Math.abs(dem.lat) <= 90 && finiteNum(dem.lon) &&
    Math.abs(dem.lon) <= 180 && Number.isInteger(dem.zoom) && dem.zoom >= 10 && dem.zoom <= 14
  // cap must equal the restore path's addWaypoint cap — a larger accepted payload
  // would be silently lossy on restore
  const wpsOk = Array.isArray(waypoints) && waypoints.length <= MAX_WAYPOINTS &&
    waypoints.every((w) => Array.isArray(w) && finiteNum(w[0]) && finiteNum(w[1]) && finiteNum(w[2]))
  if (!demOk || !wpsOk) throw new Error('malformed share payload')
  return {
    dem,
    name: obj.name ?? '分享线路',
    waypoints: waypoints.map(([lon, lat, ele, name]) => ({ lon, lat, ele, name })),
  }
}
