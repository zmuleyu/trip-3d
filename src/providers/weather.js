// WeatherProvider — Open-Meteo registered (P2); Caiyun/QWeather reserved (P4).
//
// @typedef {{ date: string, precipMm: number, weatherCode: number }} WeatherDay
// Interface: daily(point: { lon, lat, ele? }, fromISO: string, toISO: string) => Promise<WeatherDay[]>
import { createOpenMeteoProvider } from './openmeteo.js'

class StubWeatherProvider {
  constructor(kind) { this.kind = kind }
  // eslint-disable-next-line no-unused-vars
  async daily(point, fromISO, toISO) {
    throw new Error(`NotImplemented: weather provider '${this.kind}' (reserved for P2)`)
  }
}

// values are zero-arg factories (open-meteo takes default global fetch)
const KINDS = {
  none: () => new StubWeatherProvider('none'),
  'open-meteo': () => createOpenMeteoProvider(),
}

export function createWeatherProvider(kind) {
  const make = KINDS[kind]
  if (!make) throw new Error(`unknown weather provider: ${kind}`)
  return make()
}
