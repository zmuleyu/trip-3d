import { describe, it, expect } from 'vitest'
import { provinceAdcode, extractRings, filterRingsToBbox } from './adminBoundaries.js'

describe('provinceAdcode (address → CN province adcode)', () => {
  it('matches by state name with suffix stripping', () => {
    expect(provinceAdcode({ state: '北京市' })).toBe(110000)
    expect(provinceAdcode({ state: '内蒙古自治区' })).toBe(150000)
    expect(provinceAdcode({ state: '广西壮族自治区' })).toBe(450000)
    expect(provinceAdcode({ state: '新疆维吾尔自治区' })).toBe(650000)
  })
  it('non-CN / unknown → null', () => {
    expect(provinceAdcode({ state: 'Arizona' })).toBeNull()
    expect(provinceAdcode({})).toBeNull()
    expect(provinceAdcode(null)).toBeNull()
  })
})

describe('extractRings (GeoJSON → flat ring list)', () => {
  const gj = {
    type: 'FeatureCollection',
    features: [
      { properties: { adcode: 110101, name: '东城区', level: 'district' }, geometry: { type: 'Polygon', coordinates: [[[116.4, 39.9], [116.5, 39.9], [116.5, 40.0], [116.4, 39.9]]] } },
      { properties: { adcode: 110105, name: '朝阳区', level: 'district' }, geometry: { type: 'MultiPolygon', coordinates: [[[[116.6, 39.9], [116.7, 39.9], [116.6, 39.9]]]] } },
      { properties: { adcode: 999, name: '坏数据' }, geometry: null },
    ],
  }
  it('flattens Polygon + MultiPolygon, skips null geometry', () => {
    const rings = extractRings(gj)
    expect(rings).toHaveLength(2)
    expect(rings[0]).toMatchObject({ name: '东城区', level: 'district', adcode: 110101 })
    expect(rings[0].ring).toHaveLength(4)
    expect(rings[1].name).toBe('朝阳区')
  })
})

describe('filterRingsToBbox', () => {
  const rings = [
    { name: 'in', ring: [[116.4, 39.9], [116.5, 40.0]] },
    { name: 'out', ring: [[121.0, 31.0], [121.2, 31.1]] },
    { name: 'edge', ring: [[116.9, 40.5], [117.2, 40.6]] },
  ]
  it('keeps rings intersecting the bbox', () => {
    const out = filterRingsToBbox(rings, { minLon: 116.0, maxLon: 117.0, minLat: 39.5, maxLat: 40.5 })
    expect(out.map((r) => r.name)).toEqual(['in', 'edge'])
  })
})
