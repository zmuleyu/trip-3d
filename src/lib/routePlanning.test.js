import { describe, expect, it } from 'vitest'
import { durationContract, fitDemToCoordinates, normalizeRouteMode, routeCoverage, routeDistanceMeters } from './routePlanning.js'
import { makeGeoContext } from './geo.js'

describe('route planning contract', () => {
  it('normalizes unknown and legacy route modes to straight', () => {
    expect(normalizeRouteMode('foot')).toBe('foot')
    expect(normalizeRouteMode('car')).toBe('car')
    expect(normalizeRouteMode('straight')).toBe('straight')
    expect(normalizeRouteMode(undefined)).toBe('straight')
    expect(normalizeRouteMode('drive')).toBe('straight')
  })

  it('never presents a driving heuristic as straight-line or mixed-route duration', () => {
    const stats = { driveMinutes: 10 }
    expect(durationContract({ mode: 'straight', stats, legs: [] })).toEqual({
      minutes: null,
      reliable: false,
      label: '直线示意不估时',
      routedLegs: 0,
      totalLegs: 0,
    })
    expect(durationContract({
      mode: 'foot',
      stats,
      legs: [{ real: true, durationS: 600 }, { real: false, durationS: 0 }],
    })).toEqual({
      minutes: null,
      reliable: false,
      label: '路网覆盖 1/2 段',
      routedLegs: 1,
      totalLegs: 2,
    })
  })

  it('uses provider duration only when every route leg is real', () => {
    expect(durationContract({
      mode: 'foot',
      stats: { driveMinutes: 10 },
      legs: [{ real: true, durationS: 600 }, { real: true, durationS: 900 }],
    })).toEqual({
      minutes: 25,
      reliable: true,
      label: '步行路网时长',
      routedLegs: 2,
      totalLegs: 2,
    })
  })

  it('marks route geometry outside the current terrain instead of clamping it', () => {
    const geo = {
      lonLatToPx: (lon, lat) => ({ px: lon, py: lat }),
      pxToWorld: (px, py) => ({ x: px, z: py }),
    }
    expect(routeCoverage(geo, [[-20, 10], [24, -12]], 56)).toMatchObject({
      covered: true,
      outsideCount: 0,
      total: 2,
    })
    expect(routeCoverage(geo, [[-20, 10], [34, -12]], 56)).toMatchObject({
      covered: false,
      outsideCount: 1,
      total: 2,
    })
  })

  it('keeps geodesic distance available when DEM-derived statistics are blocked', () => {
    expect(routeDistanceMeters([{ lon: 0, lat: 0 }, { lon: 0, lat: 1 }])).toBeCloseTo(111195, -2)
    expect(routeDistanceMeters([])).toBe(0)
  })

  it('fits a wide route by recentering and lowering zoom within a three-tile DEM', () => {
    const fit = fitDemToCoordinates([
      { lon: 113.0, lat: 41.2 },
      { lon: 113.7, lat: 41.7 },
    ], { currentZoom: 12 })
    expect(Math.abs(fit.lon - 113.35)).toBeLessThan(1)
    expect(Math.abs(fit.lat - 41.45)).toBeLessThan(1)
    expect(fit.zoom).toBeLessThan(12)
    expect(fit.tilesAcross).toBe(3)
    const geo = makeGeoContext({ lat: fit.lat, lon: fit.lon, zoom: fit.zoom, size: fit.tilesAcross * 256 })
    expect(routeCoverage(geo, [{ lon: 113.0, lat: 41.2 }, { lon: 113.7, lat: 41.7 }], 56).covered).toBe(true)
  })

  it('verifies real floored tile boundaries before accepting a fit', () => {
    const coords = [
      { lon: -145.212890625, lat: 0 },
      { lon: -144.474609375, lat: 0 },
    ]
    const fit = fitDemToCoordinates(coords, { currentZoom: 10 })
    const geo = makeGeoContext({ lat: fit.lat, lon: fit.lon, zoom: fit.zoom, size: fit.tilesAcross * 256 })
    expect(fit.zoom).toBeLessThan(10)
    expect(routeCoverage(geo, coords, 56).covered).toBe(true)
  })

  it('uses a five-tile fallback only when the minimum zoom cannot fit three tiles', () => {
    const coords = [{ lon: 0, lat: 0 }, { lon: 4.9, lat: 0 }]
    const fit = fitDemToCoordinates(coords, { currentZoom: 8 })
    expect(fit.tilesAcross).toBe(5)
    const geo = makeGeoContext({ lat: fit.lat, lon: fit.lon, zoom: fit.zoom, size: fit.tilesAcross * 256 })
    expect(routeCoverage(geo, coords, 56).covered).toBe(true)
  })
})
