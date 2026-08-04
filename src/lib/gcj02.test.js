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
  it('boundary epsilon: just inside converts, just outside passes through', () => {
    // NOTE: the rectangle is the public algorithm's activation zone, NOT the
    // national border — product decision: points inside it always convert
    const eps = 1e-4 // float64 can't resolve 1e-6 at this magnitude
    expect(outOfChina(72.004 - eps, 39)).toBe(true)
    expect(outOfChina(72.004 + eps, 39)).toBe(false)
    expect(outOfChina(137.8347 + eps, 39)).toBe(true)
    expect(outOfChina(116, 55.8271 + eps)).toBe(true)
    expect(outOfChina(116, 55.8271 - eps)).toBe(false)
  })
})

describe('round-trip stability across regions', () => {
  const REGIONS = [
    ['北京', 116.404, 39.915],
    ['上海', 121.474, 31.230],
    ['深圳', 114.058, 22.543],
    ['乌鲁木齐', 87.617, 43.793],
    ['拉萨', 91.132, 29.660],
    ['哈尔滨', 126.635, 45.802],
  ]
  for (const [name, lon, lat] of REGIONS) {
    it(`${name}: WGS→GCJ→WGS error < 0.5m`, () => {
      const g = wgs84ToGcj02(lon, lat)
      const w = gcj02ToWgs84(g.lon, g.lat)
      // ~0.5m ≈ 6e-6° lon / 4.5e-6° lat
      expect(Math.abs(w.lon - lon)).toBeLessThan(6e-6)
      expect(Math.abs(w.lat - lat)).toBeLessThan(4.5e-6)
    })
  }
  it('10 consecutive round-trips show no drift', () => {
    let pt = { lon: 116.404, lat: 39.915 }
    for (let i = 0; i < 10; i++) {
      const g = wgs84ToGcj02(pt.lon, pt.lat)
      pt = gcj02ToWgs84(g.lon, g.lat)
    }
    expect(Math.abs(pt.lon - 116.404)).toBeLessThan(6e-6)
    expect(Math.abs(pt.lat - 39.915)).toBeLessThan(4.5e-6)
  })
})
