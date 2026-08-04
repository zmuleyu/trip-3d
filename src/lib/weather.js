// Weather domain helpers: representative points, rain-day rule, trip dates, WMO glyphs.
// Pure module.
export const MAX_TRIP_DAYS = 16 // Open-Meteo forecast horizon

// first / highest / last waypoint with role labels, deduped
export function pickRepresentativePoints(waypoints) {
  if (!waypoints.length) return []
  const first = waypoints[0]
  const last = waypoints[waypoints.length - 1]
  const highest = waypoints.reduce((a, b) => (b.ele > a.ele ? b : a), waypoints[0])
  const out = []
  const push = (wp, role) => {
    if (!out.some((p) => p.lon === wp.lon && p.lat === wp.lat)) out.push({ ...wp, role })
    else out[out.findIndex((p) => p.lon === wp.lon && p.lat === wp.lat)].role += `·${role}`
  }
  if (waypoints.length === 1) return [{ ...first, role: '起点·终点' }]
  push(first, '起点')
  if (highest !== first && highest !== last) push(highest, '最高点')
  else if (highest === last) push(last, '终点·最高')
  if (highest !== last) push(last, '终点')
  return out
}

const RAIN_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, // drizzle + rain + freezing rain
  71, 73, 75, 77, // snow
  80, 81, 82, // rain showers
  85, 86, // snow showers
  95, 96, 99, // thunderstorm
])

export function isRainDay(day) {
  if (day.precipMm >= 1) return true
  return RAIN_CODES.has(day.weatherCode)
}

export function tripDates(startISO, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO)) throw new Error(`invalid start date: ${startISO}`)
  const n = Math.min(Math.max(1, Math.trunc(days)), MAX_TRIP_DAYS)
  const start = new Date(`${startISO}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) throw new Error(`invalid start date: ${startISO}`)
  const out = []
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function wmoIcon(code) {
  if (code === 0) return '☀'
  if (code === 1) return '🌤'
  if (code === 2) return '⛅'
  if (code === 3) return '☁'
  if (code === 45 || code === 48) return '🌫'
  if (code >= 51 && code <= 67) return '🌧'
  if (code >= 71 && code <= 77) return '🌨'
  if (code >= 80 && code <= 82) return '🌦'
  if (code >= 85 && code <= 86) return '🌨'
  if (code >= 95) return '⛈'
  return '·'
}
