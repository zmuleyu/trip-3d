import { dailyIndex } from '../lib/tripIndex.js'

const empty = () => ({ type: 'FeatureCollection', features: [] })
const finiteCoordinate = (value) => Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])
const samePoint = (a, b) => a?.lon === b?.lon && a?.lat === b?.lat

function adminIdentity(region) {
  const adcode = region?.adcode
  if (typeof adcode === 'string' || Number.isFinite(adcode)) return `adcode:${adcode}`
  return `${region?.level ?? ''}:${region?.name ?? ''}`
}

// Projects the existing clipped DEM rings into MapLibre-only display data.
// Bad or incomplete source records fail closed instead of becoming a made-up boundary.
export function adminOverlayGeoJSON({ enabled, rings, selected } = {}) {
  if (!enabled || !Array.isArray(rings)) return empty()
  const selectedId = selected ? adminIdentity(selected) : null
  const features = rings.flatMap((ring) => {
    const coordinates = ring?.ring
    if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(finiteCoordinate)) return []
    const id = adminIdentity(ring)
    return [{
      type: 'Feature',
      properties: {
        id,
        adcode: ring.adcode ?? null,
        name: ring.name ?? '',
        level: ring.level ?? '',
        selected: selectedId === id,
      },
      geometry: { type: 'LineString', coordinates },
    }]
  })
  return { type: 'FeatureCollection', features }
}

function scoreForPoint(result, point) {
  const days = (result?.agg ?? [])
    .flatMap((day) => day?.points ?? [])
    .filter((day) => samePoint(day?.point, point))
  if (!days.length) return null
  const complete = days.every((day) => [day.precipMm, day.windMax, day.tempMin, day.weatherCode].every(Number.isFinite))
  return complete ? Math.min(...days.map(dailyIndex)) : null
}

function weatherForPoint(result, point) {
  const days = (result?.agg ?? [])
    .flatMap((day) => day?.points ?? [])
    .filter((day) => samePoint(day?.point, point))
  if (!days.length) return null
  return days.reduce((worst, day) => dailyIndex(day) < dailyIndex(worst) ? day : worst, days[0])
}

function riskBand(score) {
  if (!Number.isFinite(score)) return 'unknown'
  if (score < 45) return 'high'
  if (score < 65) return 'medium'
  return 'low'
}

// Weather has no parallel cache here: only a result bound to the active route
// revision can become a bounded, route-linked MapLibre marker set.
export function weatherOverlayGeoJSON({ routeRevision, weatherRevision, result } = {}) {
  if (weatherRevision !== routeRevision || !Array.isArray(result?.rep)) return empty()
  const seen = new Set()
  const features = result.rep.flatMap((point) => {
    if (!Number.isFinite(point?.lon) || !Number.isFinite(point?.lat)) return []
    const key = `${point.lon},${point.lat}`
    if (seen.has(key)) return []
    seen.add(key)
    const score = scoreForPoint(result, point)
    const weather = weatherForPoint(result, point)
    return [{
      type: 'Feature',
      properties: {
        role: point.role ?? point.name ?? '',
        risk: riskBand(score),
        score: Number.isFinite(score) ? score : null,
        date: weather?.date ?? '',
        tempMin: Number.isFinite(weather?.tempMin) ? weather.tempMin : null,
        tempMax: Number.isFinite(weather?.tempMax) ? weather.tempMax : null,
        tempLabel: Number.isFinite(weather?.tempMax) ? `${Math.round(weather.tempMax)}°` : '',
        precipMm: Number.isFinite(weather?.precipMm) ? weather.precipMm : null,
        windMax: Number.isFinite(weather?.windMax) ? weather.windMax : null,
        weatherCode: Number.isFinite(weather?.weatherCode) ? weather.weatherCode : null,
        source: result?.source ?? 'forecast',
      },
      geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    }]
  })
  return { type: 'FeatureCollection', features }
}
