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

  it('builds URL with foot profile and geojson overview', async () => {
    let url = ''
    const p = createOsrmProvider({ fetchImpl: async (u) => { url = u; return { ok: true, json: async () => OSRM_FIXTURE } } })
    await p.route([{ lon: 102.83, lat: 31.05 }, { lon: 102.9, lat: 31.02 }])
    expect(url).toContain('router.project-osrm.org/route/v1/foot/102.83,31.05;102.9,31.02')
    expect(url).toContain('overview=full')
    expect(url).toContain('geometries=geojson')
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
