// Open-Meteo providers — free, no key, non-commercial use with attribution.
// forecast: https://open-meteo.com/ (CC-BY 4.0) · archive: ERA5 (~5 days back)
// fetchImpl is injected for tests (fixture); production passes the global fetch.

// ERA5 archive provider — same WeatherDay shape, source 'archive'.
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive'

export function createOpenMeteoArchiveProvider({ fetchImpl = fetch } = {}) {
  const fc = createOpenMeteoProvider({ fetchImpl })
  return {
    kind: 'open-meteo-archive',
    async daily(point, fromISO, toISO) {
      // archive accepts the same params on a different host
      const url = new URL(ARCHIVE_BASE)
      url.searchParams.set('latitude', String(point.lat))
      url.searchParams.set('longitude', String(point.lon))
      url.searchParams.set('daily', DAILY)
      url.searchParams.set('timezone', 'auto')
      url.searchParams.set('start_date', fromISO)
      url.searchParams.set('end_date', toISO)
      if (typeof point.ele === 'number' && Number.isFinite(point.ele))
        url.searchParams.set('elevation', String(Math.round(point.ele)))
      const res = await fetchImpl(url.toString())
      if (!res.ok) throw new Error(`open-meteo-archive HTTP ${res.status}`)
      const body = await res.json()
      if (body.error) throw new Error(`open-meteo-archive: ${body.reason ?? 'API error'}`)
      const d = body.daily
      if (!d || !Array.isArray(d.time) || !d.time.length)
        throw new Error('open-meteo-archive: empty daily block')
      const wc = d.weather_code ?? d.weathercode // archive may use legacy naming
      const n = d.time.length
      const pt = { lon: point.lon, lat: point.lat, ele: point.ele }
      return d.time.map((date, i) => ({
        date,
        point: pt,
        tempMax: d.temperature_2m_max[i],
        tempMin: d.temperature_2m_min[i],
        precipMm: d.precipitation_sum[i],
        weatherCode: wc[i],
        windMax: d.wind_speed_10m_max[i],
        source: 'archive',
      }))
    },
    _forecast: fc, // escape hatch for shared logic
  }
}

const BASE = 'https://api.open-meteo.com/v1/forecast'
// official current field names (legacy aliases weathercode/windspeed_10m_max not used)
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max'

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
      const n = d.time.length
      for (const key of ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'weather_code', 'wind_speed_10m_max'])
        if (!Array.isArray(d[key]) || d[key].length !== n)
          throw new Error(`open-meteo: daily.${key} length mismatch`)

      const pt = { lon: point.lon, lat: point.lat, ele: point.ele }
      return d.time.map((date, i) => ({
        date,
        point: pt,
        tempMax: d.temperature_2m_max[i],
        tempMin: d.temperature_2m_min[i],
        precipMm: d.precipitation_sum[i],
        weatherCode: d.weather_code[i],
        windMax: d.wind_speed_10m_max[i], // km/h — Open-Meteo default unit
        source: 'forecast',
      }))
    },
  }
}
