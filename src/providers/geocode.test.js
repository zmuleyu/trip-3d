import { describe, it, expect } from 'vitest'
import { createGeocodeProvider, normalizeGeocodePlace } from './geocode.js'

const NOMINATIM_FIXTURE = [
  {
    place_id: 241430897,
    lat: '30.9955986',
    lon: '102.8308521',
    category: 'place',
    type: 'town',
    importance: 0.2521,
    name: '四姑娘山镇',
    display_name: '四姑娘山镇, 小金县, 阿坝藏族羌族自治州, 四川省, 624200, 中国',
    address: { town: '四姑娘山镇', county: '小金县', state: '四川省' },
  },
  {
    place_id: 100,
    lat: '31.1',
    lon: '102.9',
    type: 'peak',
    importance: 0.4,
    name: '幺妹峰',
    display_name: '幺妹峰, 四川省, 中国',
  },
]

const PHOTON_FIXTURE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { osm_type: 'N', osm_id: 1703112593, type: 'city', name: '四姑娘山镇', state: '四川省', country: '中国' },
      geometry: { type: 'Point', coordinates: [102.8308521, 30.9955986] },
    },
  ],
}

const okJson = (body) => async () => ({ ok: true, json: async () => body })

describe('nominatim provider', () => {
  it('maps results to normalized shape with numbers', async () => {
    const p = createGeocodeProvider('nominatim', { fetchImpl: okJson(NOMINATIM_FIXTURE) })
    const r = await p.search('四姑娘山')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ name: '四姑娘山镇', lon: 102.8308521, lat: 30.9955986, type: 'town' })
    expect(r[0].displayName).toContain('四川省')
    expect(r[0]).toMatchObject({ context: '四姑娘山镇 · 小金县 · 四川省', category: '城镇' })
    expect(typeof r[0].importance).toBe('number')
  })

  it('builds URL with format=jsonv2, limit and accept-language', async () => {
    let url = ''
    const p = createGeocodeProvider('nominatim', { fetchImpl: async (u) => { url = u; return { ok: true, json: async () => [] } } })
    await p.search('test', 6)
    expect(url).toContain('nominatim.openstreetmap.org/search?')
    expect(url).toContain('q=test')
    expect(url).toContain('format=jsonv2')
    expect(url).toContain('limit=6')
    expect(url).toContain('accept-language=')
    expect(url).toContain('addressdetails=1')
  })

  it('returns [] on empty query without fetching', async () => {
    let called = false
    const p = createGeocodeProvider('nominatim', { fetchImpl: async () => { called = true; return { ok: true, json: async () => [] } } })
    expect(await p.search('  ')).toEqual([])
    expect(called).toBe(false)
  })

  it('throws on HTTP error', async () => {
    const p = createGeocodeProvider('nominatim', { fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) })
    await expect(p.search('x')).rejects.toThrow(/503/)
  })
})

describe('photon provider', () => {
  it('maps GeoJSON features to normalized shape', async () => {
    const p = createGeocodeProvider('photon', { fetchImpl: okJson(PHOTON_FIXTURE) })
    const r = await p.search('四姑娘山')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ name: '四姑娘山镇', lon: 102.8308521, lat: 30.9955986 })
    expect(r[0].displayName).toContain('四川省')
    expect(r[0]).toMatchObject({ context: '城市信息暂缺 · 区县信息暂缺 · 四川省', category: '城市' })
  })

  it('skips features without coordinates', async () => {
    const bad = { features: [{ properties: { name: 'x' }, geometry: null }] }
    const p = createGeocodeProvider('photon', { fetchImpl: okJson(bad) })
    expect(await p.search('x')).toEqual([])
  })
})

describe('factory + amap stub', () => {
  it('unknown kind throws', () => {
    expect(() => createGeocodeProvider('baidu')).toThrow(/unknown geocode provider/)
  })
  it('amap is a registered placeholder that throws on use', async () => {
    const p = createGeocodeProvider('amap')
    expect(p.kind).toBe('amap')
    await expect(p.search('x')).rejects.toThrow(/占位/)
  })
})

describe('search result normalizer', () => {
  it('keeps city, district, province, and category readable when upstream labels a district as a city', () => {
    expect(normalizeGeocodePlace({ name: '人民公园', type: 'tower', address: { city: '青羊区', state: '四川省' } })).toMatchObject({
      context: '城市信息暂缺 · 青羊区 · 四川省',
      category: '塔',
    })
  })
})
