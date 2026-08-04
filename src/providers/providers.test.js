import { describe, it, expect } from 'vitest'
import { createRoutingProvider } from './routing.js'
import { createWeatherProvider } from './weather.js'

describe('provider skeletons', () => {
  it('routing stub throws NotImplemented with provider name', async () => {
    const p = createRoutingProvider('none')
    await expect(p.route([])).rejects.toThrow(/NotImplemented.*routing/)
  })
  it('weather stub throws NotImplemented with provider name', async () => {
    const p = createWeatherProvider('none')
    await expect(p.daily({ lon: 0, lat: 0 }, '2026-09-01', '2026-09-03')).rejects.toThrow(/NotImplemented.*weather/)
  })
  it('unknown provider kind throws at factory', () => {
    expect(() => createRoutingProvider('baidu')).toThrow(/unknown routing provider/)
    expect(() => createWeatherProvider('caiyun')).toThrow(/unknown weather provider/)
  })

  it('open-meteo is registered and returns a working provider shape', () => {
    const p = createWeatherProvider('open-meteo')
    expect(p.kind).toBe('open-meteo')
    expect(typeof p.daily).toBe('function')
  })
})
