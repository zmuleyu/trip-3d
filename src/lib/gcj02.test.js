import { describe, it, expect } from 'vitest'
import { gcj02ToWgs84, wgs84ToGcj02, outOfChina } from './gcj02.js'

// truth pair from user's real amap link vs Nominatim (OSM, WGS-84):
// 高米店北地铁站 GCJ (116.3307872414589, 39.773541879180236) ↔ WGS (116.3244805, 39.7730301)
describe('gcj02ToWgs84', () => {
  it('converts GCJ-02 to WGS-84 within ~130m of truth pair', () => {
    // truth is the Nominatim station node — amap's POI may sit at a different
    // entrance, so tolerance covers both algorithm and POI-location uncertainty
    const w = gcj02ToWgs84(116.3307872414589, 39.773541879180236)
    expect(Math.abs(w.lon - 116.3244805)).toBeLessThan(0.0012)
    expect(Math.abs(w.lat - 39.7730301)).toBeLessThan(0.0012)
  })
  it('shift direction: GCJ lon is east-shifted, lat slightly north', () => {
    const w = gcj02ToWgs84(116.3307872414589, 39.773541879180236)
    expect(w.lon).toBeLessThan(116.3307872414589)
    expect(w.lat).toBeLessThan(39.773541879180236)
  })
})

describe('wgs84ToGcj02', () => {
  it('is the inverse (round-trip < 0.0001°)', () => {
    const g = wgs84ToGcj02(116.3244805, 39.7730301)
    const w = gcj02ToWgs84(g.lon, g.lat)
    expect(Math.abs(w.lon - 116.3244805)).toBeLessThan(0.0001)
    expect(Math.abs(w.lat - 39.7730301)).toBeLessThan(0.0001)
  })
})

describe('outOfChina passthrough', () => {
  it('points outside China are returned unchanged both ways', () => {
    expect(outOfChina(151.2, -33.8)).toBe(true)
    expect(gcj02ToWgs84(151.2, -33.8)).toEqual({ lon: 151.2, lat: -33.8 })
    expect(wgs84ToGcj02(151.2, -33.8)).toEqual({ lon: 151.2, lat: -33.8 })
    expect(outOfChina(116.4, 39.9)).toBe(false)
  })
})
