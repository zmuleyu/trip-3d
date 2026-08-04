// WGS-84 lon/lat ↔ DEM canvas px ↔ three.js world coordinates.
// Pure module (no three.js). Math MUST mirror src/dem.js (tile canvas)
// and src/terrain.js (world→px mapping: px = (x/TERRAIN_SIZE + 0.5) * (size-1)).

export const TERRAIN_SIZE = 56 // keep in sync with src/terrain.js
const TILE_PX = 256
const EARTH_R = 6371008.8 // IUGG mean radius, meters

export function makeGeoContext(dem) {
  // dem: { lat, lon, zoom, size } — same shape loadDem() returns
  const n = 2 ** dem.zoom
  const latRad = (dem.lat * Math.PI) / 180
  const cx = Math.floor(((dem.lon + 180) / 360) * n)
  const cy = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  const tilesAcross = dem.size / TILE_PX
  const half = Math.floor(tilesAcross / 2)
  const originX = cx - half // global tile coords of canvas NW corner
  const originY = cy - half
  const span = dem.size - 1

  function worldToPx(x, z) {
    return { px: (x / TERRAIN_SIZE + 0.5) * span, py: (z / TERRAIN_SIZE + 0.5) * span }
  }
  function pxToWorld(px, py) {
    return { x: (px / span - 0.5) * TERRAIN_SIZE, z: (py / span - 0.5) * TERRAIN_SIZE }
  }
  // px/py are ARRAY-INDEX coords: center of data[0] is px=0, so the continuous
  // web-mercator coordinate of a sample is origin + (px + 0.5)/TILE_PX. This matches
  // terrain.js mapping world edges to the first/last pixel CENTERS.
  function pxToLonLat(px, py) {
    const gx = originX + (px + 0.5) / TILE_PX // global tile coords (fractional)
    const gy = originY + (py + 0.5) / TILE_PX
    const lon = (gx / n) * 360 - 180
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * gy) / n))) * 180) / Math.PI
    return { lon, lat }
  }
  function lonLatToPx(lon, lat) {
    const latRad = (lat * Math.PI) / 180
    const gx = ((lon + 180) / 360) * n
    const gy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    return { px: (gx - originX) * TILE_PX - 0.5, py: (gy - originY) * TILE_PX - 0.5 }
  }
  return { dem, worldToPx, pxToWorld, pxToLonLat, lonLatToPx }
}

export function lonLatToWorld(geo, lon, lat) {
  const { px, py } = geo.lonLatToPx(lon, lat)
  return geo.pxToWorld(px, py)
}

export function worldToLonLat(geo, x, z) {
  const { px, py } = geo.worldToPx(x, z)
  return geo.pxToLonLat(px, py)
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180
  const dLat = (lat2 - lat1) * r
  const dLon = (lon2 - lon1) * r
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(a))
}
