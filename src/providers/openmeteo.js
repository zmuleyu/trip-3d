// Open-Meteo forecast provider — free, no key, non-commercial use with attribution.
// https://open-meteo.com/ — data: national weather services, CC-BY 4.0.
// fetchImpl is injected for tests (fixture); production passes the global fetch.
const BASE = 'https://api.open-meteo.com/v1/forecast'
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max'

export function createOpenMeteoProvider({ fetchImpl = fetch } = {}) {
  return {
    kind: 'open-meteo',
    // point: { lon, lat, ele? } → WeatherDay[] aligned to skeleton interface
    async daily(point, fromISO, toISO) {
      const url = new URL(BASE)
      url.searchParams.set('latitude', String(point.lat))
      url.searchParams.set('longitude', String(point.lon))
      url.searchParams.set('daily', DAILY)
      url.searchParams.set('timezone', 'auto')
      url.searchParams.set('start_date', fromISO)
      url.searchParams.set('end_date', toISO)
      if (typeof point.ele === 'number' && Number.isFinite(point.ele))
        url.searchParams.set('elevation', String(Math.round(point.ele)))

      const res = await fetchImpl(url.toString())
      if (!res.ok) throw new Error(`open-meteo HTTP ${res.status}`)
      const body = await res.json()
      if (body.error) throw new Error(`open-meteo: ${body.reason ?? 'API error'}`)
      const d = body.daily
      if (!d || !Array.isArray(d.time) || !d.time.length)
        throw new Error('open-meteo: empty daily block')

      const pt = { lon: point.lon, lat: point.lat, ele: point.ele }
      return d.time.map((date, i) => ({
        date,
        point: pt,
        tempMax: d.temperature_2m_max[i],
        tempMin: d.temperature_2m_min[i],
        precipMm: d.precipitation_sum[i],
        weatherCode: d.weathercode[i],
        windMax: d.windspeed_10m_max[i],
        source: 'forecast',
      }))
    },
  }
}
