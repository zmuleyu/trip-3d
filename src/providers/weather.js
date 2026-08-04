// WeatherProvider — P2 extension point (Open-Meteo first, Caiyun/QWeather later).
// MVP ships no implementation; 'none' is the only registered kind.
//
// @typedef {{ date: string, precipMm: number, weatherCode: number }} WeatherDay
// Interface: daily(point: { lon, lat }, fromISO: string, toISO: string) => Promise<WeatherDay[]>

class StubWeatherProvider {
  constructor(kind) { this.kind = kind }
  // eslint-disable-next-line no-unused-vars
  async daily(point, fromISO, toISO) {
    throw new Error(`NotImplemented: weather provider '${this.kind}' (reserved for P2)`)
  }
}

const KINDS = { none: StubWeatherProvider }

export function createWeatherProvider(kind) {
  const Klass = KINDS[kind]
  if (!Klass) throw new Error(`unknown weather provider: ${kind}`)
  return new Klass(kind)
}
