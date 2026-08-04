import { describe, it, expect } from 'vitest'
import { createOpenMeteoProvider } from './openmeteo.js'

const FIXTURE = {
  latitude: 31.05,
  longitude: 102.83,
  elevation: 3850.5,
  timezone: 'Asia/Shanghai',
  daily: {
    time: ['2026-09-14', '2026-09-15', '2026-09-16'],
    temperature_2m_max: [12.3, 11.0, 9.8],
    temperature_2m_min: [2.1, 1.0, -0.5],
    precipitation_sum: [0.0, 3.2, 0.4],
    weathercode: [2, 61, 3],
    windspeed_10m_max: [14.5, 33.2, 18.0],
  },
}

const fetchOk = async (url) => ({
  ok: true,
  json: async () => FIXTURE,
  url,
})

describe('open-meteo provider', () => {
  it('maps daily arrays to WeatherDay rows with source=forecast', async () => {
    const p = createOpenMeteoProvider({ fetchImpl: fetchOk })
    const days = await p.daily({ lon: 102.83, lat: 31.05, ele: 3850 }, '2026-09-14', '2026-09-16')
    expect(days).toHaveLength(3)
    expect(days[1]).toMatchObject({
      date: '2026-09-15',
      tempMax: 11.0,
      tempMin: 1.0,
      precipMm: 3.2,
      weatherCode: 61,
      windMax: 33.2,
      source: 'forecast',
    })
    expect(days[0].point).toMatchObject({ lon: 102.83, lat: 31.05, ele: 3850 })
  })

  it('builds the request URL with daily fields, timezone=auto and elevation', async () => {
    let seenUrl = ''
    const p = createOpenMeteoProvider({
      fetchImpl: async (url) => { seenUrl = url; return { ok: true, json: async () => FIXTURE } },
    })
    await p.daily({ lon: 102.83, lat: 31.05, ele: 3850 }, '2026-09-14', '2026-09-16')
    expect(seenUrl).toContain('https://api.open-meteo.com/v1/forecast?')
    expect(seenUrl).toContain('latitude=31.05')
    expect(seenUrl).toContain('longitude=102.83')
    expect(seenUrl).toContain('daily=temperature_2m_max%2Ctemperature_2m_min%2Cprecipitation_sum%2Cweathercode%2Cwindspeed_10m_max')
    expect(seenUrl).toContain('timezone=auto')
    expect(seenUrl).toContain('start_date=2026-09-14')
    expect(seenUrl).toContain('end_date=2026-09-16')
    expect(seenUrl).toContain('elevation=3850')
  })

  it('omits elevation param when point has no ele', async () => {
    let seenUrl = ''
    const p = createOpenMeteoProvider({
      fetchImpl: async (url) => { seenUrl = url; return { ok: true, json: async () => FIXTURE } },
    })
    await p.daily({ lon: 102.83, lat: 31.05 }, '2026-09-14', '2026-09-14')
    expect(seenUrl).not.toContain('elevation=')
  })

  it('throws on HTTP error with status', async () => {
    const p = createOpenMeteoProvider({
      fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
    })
    await expect(p.daily({ lon: 0, lat: 0 }, '2026-09-14', '2026-09-15')).rejects.toThrow(/429/)
  })

  it('throws on API-level error payload (e.g. bad dates)', async () => {
    const p = createOpenMeteoProvider({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ error: true, reason: 'Start date must be before end date' }),
      }),
    })
    await expect(p.daily({ lon: 0, lat: 0 }, '2026-09-16', '2026-09-14')).rejects.toThrow(/Start date/)
  })

  it('throws when daily block is missing/empty', async () => {
    const p = createOpenMeteoProvider({
      fetchImpl: async () => ({ ok: true, json: async () => ({ latitude: 0 }) }),
    })
    await expect(p.daily({ lon: 0, lat: 0 }, '2026-09-14', '2026-09-15')).rejects.toThrow(/daily/)
  })
})
