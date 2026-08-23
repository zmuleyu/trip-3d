// Overview map math — standard slippy-map/Web Mercator projection.
// A view keeps OSM tiles at their native aspect ratio instead of stretching a
// geographic bbox to the canvas dimensions.

export const TILE_SIZE = 256
const MAX_LAT = 85.05112878

export function lonLatToTileXY(lon, lat, z) {
  const n = 2 ** z
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
  const latRad = (clampedLat * Math.PI) / 180
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  }
}

export function tileXYToLonLat(x, y, z) {
  const n = 2 ** z
  const lon = (x / n) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
  return { lon, lat: (latRad * 180) / Math.PI }
}

function finalizeView({ z, originX, originY, width, height }) {
  const worldSize = TILE_SIZE * 2 ** z
  const maxOriginX = Math.max(0, worldSize - width)
  const maxOriginY = Math.max(0, worldSize - height)
  const nextOriginX = Math.max(0, Math.min(maxOriginX, originX))
  const nextOriginY = Math.max(0, Math.min(maxOriginY, originY))
  return {
    z,
    width,
    height,
    originX: nextOriginX,
    originY: nextOriginY,
    centerX: nextOriginX + width / 2,
    centerY: nextOriginY + height / 2,
    x0: Math.floor(nextOriginX / TILE_SIZE),
    y0: Math.floor(nextOriginY / TILE_SIZE),
    x1: Math.floor((nextOriginX + width - 1) / TILE_SIZE),
    y1: Math.floor((nextOriginY + height - 1) / TILE_SIZE),
  }
}

export function viewFromPoints(points, width, height, { padding = 56, minZoom = 3, maxZoom = 14 } = {}) {
  if (!points?.length || width <= 0 || height <= 0) return null
  const projected = points.map((point) => lonLatToTileXY(point.lon, point.lat, 0))
  const xs = projected.map((point) => point.x)
  const ys = projected.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const minSpan = 1 / (TILE_SIZE * 2 ** maxZoom)
  const spanX = Math.max(minSpan, maxX - minX)
  const spanY = Math.max(minSpan, maxY - minY)
  const availableWidth = Math.max(64, width - padding * 2)
  const availableHeight = Math.max(64, height - padding * 2)
  const zoomX = Math.log2(availableWidth / (spanX * TILE_SIZE))
  const zoomY = Math.log2(availableHeight / (spanY * TILE_SIZE))
  const z = Math.max(minZoom, Math.min(maxZoom, Math.floor(Math.min(zoomX, zoomY))))
  const scale = TILE_SIZE * 2 ** z
  const centerX = ((minX + maxX) / 2) * scale
  const centerY = ((minY + maxY) / 2) * scale
  return finalizeView({ z, originX: centerX - width / 2, originY: centerY - height / 2, width, height })
}

// Kept for the compact inset and tests: bbox → fitted Mercator view.
export function pickOverviewView(bbox, maxTiles = 16) {
  const points = [
    { lon: bbox.minLon, lat: bbox.minLat },
    { lon: bbox.maxLon, lat: bbox.maxLat },
  ]
  let view = viewFromPoints(points, 512, 512, { padding: 32 })
  while (view && (view.x1 - view.x0 + 1) * (view.y1 - view.y0 + 1) > maxTiles && view.z > 3) {
    view = zoomView(view, view.z - 1)
  }
  return view
}

export function projectToView(lon, lat, view) {
  const tile = lonLatToTileXY(lon, lat, view.z)
  return {
    x: tile.x * TILE_SIZE - view.originX,
    y: tile.y * TILE_SIZE - view.originY,
  }
}

export function unprojectFromView(x, y, view) {
  return tileXYToLonLat((view.originX + x) / TILE_SIZE, (view.originY + y) / TILE_SIZE, view.z)
}

export function panView(view, deltaX, deltaY) {
  return finalizeView({ ...view, originX: view.originX - deltaX, originY: view.originY - deltaY })
}

export function zoomView(view, nextZoom, anchorX = view.width / 2, anchorY = view.height / 2) {
  const z = Math.max(3, Math.min(14, nextZoom))
  if (z === view.z) return view
  const anchor = unprojectFromView(anchorX, anchorY, view)
  const tile = lonLatToTileXY(anchor.lon, anchor.lat, z)
  return finalizeView({
    z,
    width: view.width,
    height: view.height,
    originX: tile.x * TILE_SIZE - anchorX,
    originY: tile.y * TILE_SIZE - anchorY,
  })
}

export function resizeView(view, width, height) {
  return finalizeView({
    ...view,
    width,
    height,
    originX: view.centerX - width / 2,
    originY: view.centerY - height / 2,
  })
}

export function resizeViewFromTop(view, width, height) {
  return finalizeView({
    ...view,
    width,
    height,
    originX: view.centerX - width / 2,
    originY: view.originY,
  })
}

export function metersPerPixel(view) {
  const center = tileXYToLonLat(view.centerX / TILE_SIZE, view.centerY / TILE_SIZE, view.z)
  return Math.cos((center.lat * Math.PI) / 180) * 2 * Math.PI * 6378137 / (TILE_SIZE * 2 ** view.z)
}
