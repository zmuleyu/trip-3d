import { haversineMeters, lonLatToWorld } from './geo.js'

export const ROUTE_MODES = Object.freeze(['straight', 'foot', 'car'])

export function normalizeRouteMode(mode) {
  return ROUTE_MODES.includes(mode) ? mode : 'straight'
}

export function durationContract({ mode, legs = [] }) {
  const normalized = normalizeRouteMode(mode)
  const totalLegs = legs.length
  const routedLegs = legs.filter((leg) => leg?.real).length
  if (normalized === 'straight') {
    return { minutes: null, reliable: false, label: '直线示意不估时', routedLegs, totalLegs }
  }
  if (!totalLegs || routedLegs !== totalLegs) {
    return {
      minutes: null,
      reliable: false,
      label: `路网覆盖 ${routedLegs}/${totalLegs} 段`,
      routedLegs,
      totalLegs,
    }
  }
  return {
    minutes: legs.reduce((sum, leg) => sum + leg.durationS, 0) / 60,
    reliable: true,
    label: normalized === 'car' ? '驾车路网时长' : '步行路网时长',
    routedLegs,
    totalLegs,
  }
}

const lonLatOf = (coord) => Array.isArray(coord)
  ? { lon: Number(coord[0]), lat: Number(coord[1]) }
  : { lon: Number(coord?.lon), lat: Number(coord?.lat) }

export function routeCoverage(geo, coordinates, terrainSize = 56) {
  const half = terrainSize / 2
  const world = (coordinates ?? []).map((coord) => {
    const { lon, lat } = lonLatOf(coord)
    return lonLatToWorld(geo, lon, lat)
  })
  const outsideCount = world.filter(({ x, z }) => x < -half || x > half || z < -half || z > half).length
  return {
    covered: outsideCount === 0,
    outsideCount,
    total: world.length,
    bounds: world.length
      ? {
          minX: Math.min(...world.map((p) => p.x)),
          maxX: Math.max(...world.map((p) => p.x)),
          minZ: Math.min(...world.map((p) => p.z)),
          maxZ: Math.max(...world.map((p) => p.z)),
        }
      : null,
  }
}

export function routeDistanceMeters(coordinates) {
  const points = (coordinates ?? []).map(lonLatOf)
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon)
  }
  return total
}

const tileFraction = (lon, lat, zoom) => {
  const n = 2 ** zoom
  const limitedLat = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const rad = (limitedLat * Math.PI) / 180
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  }
}

export function fitDemToCoordinates(coordinates, { currentZoom = 12, tilesAcross = 3, margin = 1.18 } = {}) {
  const points = (coordinates ?? []).map(lonLatOf).filter(({ lon, lat }) => Number.isFinite(lon) && Number.isFinite(lat))
  if (!points.length) return null
  let zoom = Math.max(8, Math.min(14, Math.round(currentZoom)))
  for (; zoom >= 8; zoom--) {
    const projected = points.map((p) => tileFraction(p.lon, p.lat, zoom))
    const minX = Math.min(...projected.map((p) => p.x)), maxX = Math.max(...projected.map((p) => p.x))
    const minY = Math.min(...projected.map((p) => p.y)), maxY = Math.max(...projected.map((p) => p.y))
    const padX = ((maxX - minX) * (margin - 1)) / 2
    const padY = ((maxY - minY) * (margin - 1)) / 2
    const half = Math.floor(tilesAcross / 2)
    const centerTile = (min, max, pad) => {
      const mid = (min + max) / 2
      for (const offset of [0, -1, 1, -2, 2]) {
        const tile = Math.floor(mid) + offset
        const origin = tile - half
        if (min - pad >= origin && max + pad <= origin + tilesAcross) return tile
      }
      return null
    }
    const cx = centerTile(minX, maxX, padX)
    const cy = centerTile(minY, maxY, padY)
    if (cx == null || cy == null) continue
    const n = 2 ** zoom
    const centerX = cx + 0.5
    const centerY = cy + 0.5
    return {
      lon: (centerX / n) * 360 - 180,
      lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * centerY) / n))) * 180) / Math.PI,
      zoom,
      tilesAcross,
    }
  }
  if (tilesAcross === 3) return fitDemToCoordinates(points, { currentZoom, tilesAcross: 5, margin })
  return null
}
