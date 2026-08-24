import { describe, expect, it } from 'vitest'
import { adminOverlayGeoJSON, weatherOverlayGeoJSON } from './overlayAdapters.js'

describe('MapLibre overlay adapters', () => {
  it('projects only valid enabled admin rings and reflects the canonical selection', () => {
    const data = adminOverlayGeoJSON({
      enabled: true,
      selected: { adcode: 11 },
      rings: [
        { adcode: 11, name: '北京', level: 'province', ring: [[116, 39], [117, 40]] },
        { adcode: 12, name: '坏数据', level: 'city', ring: [[NaN, 39], [117, 40]] },
      ],
    })
    expect(data.features).toHaveLength(1)
    expect(data.features[0]).toMatchObject({ geometry: { type: 'LineString' }, properties: { adcode: 11, selected: true } })
    expect(adminOverlayGeoJSON({ enabled: false, rings: data.features }).features).toEqual([])
  })

  it('publishes only current, complete representative weather and keeps unknown values unknown', () => {
    const result = {
      rep: [{ lon: 116, lat: 39, role: '起点' }, { lon: 117, lat: 40, role: '终点' }],
      agg: [{ points: [
        { point: { lon: 116, lat: 39 }, precipMm: 7, windMax: 20, tempMin: 3, weatherCode: 61 },
        { point: { lon: 117, lat: 40 }, precipMm: null, windMax: 20, tempMin: 3, weatherCode: 0 },
      ] }],
    }
    expect(weatherOverlayGeoJSON({ routeRevision: 4, weatherRevision: 3, result }).features).toEqual([])
    const fresh = weatherOverlayGeoJSON({ routeRevision: 4, weatherRevision: 4, result })
    expect(fresh.features).toHaveLength(2)
    expect(fresh.features[0].properties).toMatchObject({ risk: 'high', score: 44 })
    expect(fresh.features[1].properties).toMatchObject({ risk: 'unknown', score: null })
  })
})
