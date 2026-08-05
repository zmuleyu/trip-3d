// Overview inset math — pure slippy-map helpers (no DOM).
// Tiles: standard OSM slippy (z/x/y), Web-Mercator.

export function lonLatToTileXY(lon, lat, z) {
  const n = 2 ** z
  const latRad = (lat * Math.PI) / 180
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

// bbox → { z, x0, y0, x1, y1 } such that tile count ≤ maxTiles. Padding keeps
// route endpoints off the inset edge. minSpan guards degenerate boxes.
export function pickOverviewView(bbox, maxTiles = 16) {
  const minSpan = 0.002 // ~200m
  const minLon = bbox.minLon
  const maxLon = Math.max(bbox.maxLon, bbox.minLon + minSpan)
  const minLat = bbox.minLat
  const maxLat = Math.max(bbox.maxLat, bbox.minLat + minSpan)
  for (let z = 14; z >= 3; z--) {
    const a = lonLatToTileXY(minLon, maxLat, z) // top-left (north-west)
    const b = lonLatToTileXY(maxLon, minLat, z) // bottom-right (south-east)
    const x0 = Math.floor(a.x)
    const y0 = Math.floor(a.y)
    const x1 = Math.floor(b.x)
    const y1 = Math.floor(b.y)
    const count = (x1 - x0 + 1) * (y1 - y0 + 1)
    if (count <= maxTiles) {
      const latSpan = maxLat - minLat
      const lonSpan = maxLon - minLon
      return { z, x0, y0, x1, y1, minLon: minLon - lonSpan * 0.08, maxLon: maxLon + lonSpan * 0.08, minLat: minLat - latSpan * 0.08, maxLat: maxLat + latSpan * 0.08 }
    }
  }
  const a = lonLatToTileXY(minLon, maxLat, 3)
  const b = lonLatToTileXY(maxLon, minLat, 3)
  return { z: 3, x0: Math.floor(a.x), y0: Math.floor(a.y), x1: Math.floor(b.x), y1: Math.floor(b.y), minLon, maxLon, minLat, maxLat }
}

// route points → complete view (tile range + padded bbox + canvas size)
export function viewFromPoints(points, width, height, maxTiles = 16) {
  const lons = points.map((p) => p.lon)
  const lats = points.map((p) => p.lat)
  const v = pickOverviewView({
    minLon: Math.min(...lons), maxLon: Math.max(...lons),
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
  }, maxTiles)
  return { ...v, width, height }
}

// lon/lat → inset canvas pixels (linear in padded-bbox space; y flipped north-up)
export function projectToView(lon, lat, view) {
  const x = ((lon - view.minLon) / (view.maxLon - view.minLon)) * view.width
  const y = ((view.maxLat - lat) / (view.maxLat - view.minLat)) * view.height
  return { x, y }
}

// inset pixels → lon/lat (click-to-fly)
export function unprojectFromView(x, y, view) {
  return {
    lon: view.minLon + (x / view.width) * (view.maxLon - view.minLon),
    lat: view.maxLat - (y / view.height) * (view.maxLat - view.minLat),
  }
}
