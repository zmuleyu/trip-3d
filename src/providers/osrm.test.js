import { describe, it, expect } from 'vitest'
import { createOsrmProvider } from './osrm.js'
import { createRoutingProvider } from './routing.js'

const OSRM_FIXTURE = {
  code: 'Ok',
  routes: [
    {
      distance: 21501.4,
      duration: 3094.4,
      geometry: {
        type: 'LineString',
        coordinates: [
          [102.83, 31.05],
          [102.85, 31.04],
          [102.87, 31.03],
          [102.9, 31.02],
        ],
      },
      legs: [{ distance: 21501.4, duration: 3094.4 }],
    },
  ],
  waypoints: [{ name: '' }, { name: '' }],
}

const okJson = (body) => async () => ({ ok: true, json: async () => body })

describe('osrm provider', () => {
  it('maps route response to normalized shape', async () => {
    const p = createOsrmProvider({ fetchImpl: okJson(OSRM_FIXTURE) })
    const r = await p.route([
      { lon: 102.83, lat: 31.05 },
      { lon: 102.9, lat: 31.02 },
    ])
    expect(r.distanceM).toBeCloseTo(21501.4)
    expect(r.durationS).toBeCloseTo(3094.4)
    expect(r.geometry).toHaveLength(4)
    expect(r.geometry[0]).toEqual([102.83, 31.05])
  })

  it('maps legs to { distanceM, durationS } per leg', async () => {
    const multi = {
      code: 'Ok',
      routes: [
        {
          distance: 3000,
          duration: 2600,
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 2]] },
          legs: [
            { distance: 1200, duration: 1000 },
            { distance: 1800, duration: 1600 },
          ],
        },
      ],
    }
    const p = createOsrmProvider({ fetchImpl: okJson(multi) })
    const r = await p.route([{ lon: 0, lat: 0 }, { lon: 1, lat: 1 }, { lon: 2, lat: 2 }])
    expect(r.legs).toHaveLength(2)
    expect(r.legs[0]).toEqual({ distanceM: 1200, durationS: 1000 })
    expect(r.legs[1]).toEqual({ distanceM: 1800, durationS: 1600 })
  })

  it('missing legs in response → legs is []', async () => {
    const noLegs = { code: 'Ok', routes: [{ distance: 100, duration: 90, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }] }
    const p = createOsrmProvider({ fetchImpl: okJson(noLegs) })
    const r = await p.route([{ lon: 0, lat: 0 }, { lon: 1, lat: 1 }])
    expect(r.legs).toEqual([])
  })

  it('builds URL with foot profile and geojson overview', async () => {
    let url = ''
    const p = createOsrmProvider({ fetchImpl: async (u) => { url = u; return { ok: true, json: async () => OSRM_FIXTURE } } })
    await p.route([{ lon: 102.83, lat: 31.05 }, { lon: 102.9, lat: 31.02 }])
    expect(url).toContain('routing.openstreetmap.de/routed-foot/route/v1/foot/102.83,31.05;102.9,31.02')
    expect(url).toContain('overview=full')
    expect(url).toContain('geometries=geojson')
  })

  it('appends exclude param when set (car: 避开高速)', async () => {
    let url = ''
    const p = createOsrmProvider({ fetchImpl: async (u) => { url = u; return { ok: true, json: async () => OSRM_FIXTURE } }, profile: 'car', exclude: 'motorway' })
    await p.route([{ lon: 102.83, lat: 31.05 }, { lon: 102.9, lat: 31.02 }])
    expect(url).toContain('routed-car/route/v1/driving/')
    expect(url).toContain('&exclude=motorway')
  })

  it('exclude InvalidValue (FOSSGIS 不支持) → retries without exclude, flags excludeIgnored', async () => {
    const urls = []
    const p = createOsrmProvider({
      fetchImpl: async (u) => {
        urls.push(u)
        if (u.includes('exclude=')) return { ok: true, json: async () => ({ code: 'InvalidValue', message: 'Exclude flag combination is not supported.' }) }
        return { ok: true, json: async () => OSRM_FIXTURE }
      },
      profile: 'car',
      exclude: 'motorway',
    })
    const r = await p.route([{ lon: 102.83, lat: 31.05 }, { lon: 102.9, lat: 31.02 }])
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('&exclude=motorway')
    expect(urls[1]).not.toContain('&exclude=')
    expect(r.excludeIgnored).toBe(true)
    expect(r.geometry).toHaveLength(4)
  })

  it('exclude non-InvalidValue errors propagate (no silent retry)', async () => {
    const p = createOsrmProvider({
      fetchImpl: async () => ({ ok: true, json: async () => ({ code: 'NoRoute', routes: [] }) }),
      profile: 'car',
      exclude: 'motorway',
    })
    await expect(p.route([{ lon: 0, lat: 0 }, { lon: 1, lat: 1 }])).rejects.toThrow(/NoRoute/)
  })

  it('throws on <2 points', async () => {
    const p = createOsrmProvider({ fetchImpl: okJson(OSRM_FIXTURE) })
    await expect(p.route([{ lon: 0, lat: 0 }])).rejects.toThrow(/2/)
  })

  it('throws on non-Ok code (e.g. NoRoute)', async () => {
    const p = createOsrmProvider({ fetchImpl: okJson({ code: 'NoRoute', routes: [] }) })
    await expect(p.route([{ lon: 0, lat: 0 }, { lon: 1, lat: 1 }])).rejects.toThrow(/NoRoute/)
  })

  it('throws on HTTP error', async () => {
    const p = createOsrmProvider({ fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) })
    await expect(p.route([{ lon: 0, lat: 0 }, { lon: 1, lat: 1 }])).rejects.toThrow(/429/)
  })
})

describe('routing factory', () => {
  it('osrm registered with working shape', () => {
    const p = createRoutingProvider('osrm')
    expect(p.kind).toBe('osrm')
    expect(typeof p.route).toBe('function')
  })
  it('amap is a registered placeholder that throws on use', async () => {
    const p = createRoutingProvider('amap')
    expect(p.kind).toBe('amap')
    await expect(p.route([{ lon: 0, lat: 0 }, { lon: 1, lat: 1 }])).rejects.toThrow(/占位/)
  })
})
