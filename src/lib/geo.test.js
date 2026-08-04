import { describe, it, expect } from 'vitest'
import { makeGeoContext, lonLatToWorld, worldToLonLat, haversineMeters } from './geo.js'

// z12, 3×3 tiles → size 768; context mirrors dem.js tile math
const dem = { lat: 36.998, lon: -110.0984, zoom: 12, size: 768 }
const geo = makeGeoContext(dem)

describe('geo', () => {
  it('round-trips lon/lat → world → lon/lat', () => {
    for (const [lon, lat] of [[-110.0984, 36.998], [-110.05, 37.01], [-110.15, 36.96]]) {
      const w = lonLatToWorld(geo, lon, lat)
      const back = worldToLonLat(geo, w.x, w.z)
      expect(back.lon).toBeCloseTo(lon, 6)
      expect(back.lat).toBeCloseTo(lat, 6)
    }
  })

  it('world origin maps inside the DEM canvas', () => {
    const { px, py } = geo.worldToPx(0, 0)
    expect(px).toBeGreaterThan(0)
    expect(px).toBeLessThan(768)
    expect(py).toBeGreaterThan(0)
    expect(py).toBeLessThan(768)
  })

  it('index semantics: px ±0.5 spans the whole 3-tile canvas', () => {
    // px=-0.5 ↔ NW canvas boundary; px=767.5 ↔ SE boundary (terrain samples pixel CENTERS 0..767)
    const nw = geo.pxToLonLat(-0.5, -0.5)
    const se = geo.pxToLonLat(767.5, 767.5)
    expect(se.lon).toBeGreaterThan(nw.lon)
    expect(se.lat).toBeLessThan(nw.lat)
    // 3 tiles at z12 ≈ 0.2637° lon span
    expect(se.lon - nw.lon).toBeCloseTo((3 / 2 ** 12) * 360, 4)
  })

  it('dem center lon/lat lands inside the canvas center tile', () => {
    // independent invariant: floor() construction guarantees the center tile holds (dem.lon, dem.lat)
    const { px, py } = geo.lonLatToPx(dem.lon, dem.lat)
    expect(px).toBeGreaterThanOrEqual(256)
    expect(px).toBeLessThan(512)
    expect(py).toBeGreaterThanOrEqual(256)
    expect(py).toBeLessThan(512)
  })

  it('haversine: 1° lat ≈ 111.195 km', () => {
    expect(haversineMeters(0, 0, 1, 0)).toBeCloseTo(111195, -2)
  })

  it('world +x = east, +z = south', () => {
    const a = worldToLonLat(geo, 0, 0)
    const east = worldToLonLat(geo, 5, 0)
    const south = worldToLonLat(geo, 0, 5)
    expect(east.lon).toBeGreaterThan(a.lon)
    expect(south.lat).toBeLessThan(a.lat)
  })
})
