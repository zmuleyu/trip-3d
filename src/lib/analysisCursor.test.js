import { describe, expect, it } from 'vitest'
import { analysisPointsReady, initialAnalysisCursorDistance, nearestAnalysisDistance, nearestAnalysisIndex, sampleAnalysisAtDistance } from './analysisCursor.js'

const points = [
  { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
  { lon: 101, lat: 30, ele: 1200, cumDistM: 1000 },
  { lon: 101, lat: 31, ele: 1400, cumDistM: 2000 },
]

describe('analysis cursor geometry', () => {
  it('samples distance and elevation along the raw DEM profile with endpoint bounds', () => {
    expect(sampleAnalysisAtDistance(points, 500)).toMatchObject({ distanceM: 500, lon: 100.5, lat: 30, ele: 1100 })
    expect(sampleAnalysisAtDistance(points, -10)).toMatchObject({ distanceM: 0, ele: 1000 })
    expect(sampleAnalysisAtDistance(points, 3000)).toMatchObject({ distanceM: 2000, ele: 1400 })
  })

  it('projects a map location to the nearest shared route distance', () => {
    expect(nearestAnalysisDistance(points, 100.4, 30.1)).toBeCloseTo(400, 4)
    expect(nearestAnalysisDistance(points, 101.1, 30.6)).toBeCloseTo(1600, 4)
    expect(nearestAnalysisIndex(points, 1490)).toBe(1)
  })

  it('fails closed for empty or unavailable analysis points', () => {
    expect(analysisPointsReady([])).toBe(false)
    expect(sampleAnalysisAtDistance([], 0)).toBeNull()
    expect(nearestAnalysisDistance([{ lon: 0, lat: 0, ele: 0, cumDistM: 0 }], 0, 0)).toBeNull()
  })

  it('keeps repeated zero-length samples finite at the first endpoint', () => {
    const repeated = [
      { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
      { lon: 100, lat: 30, ele: 1100, cumDistM: 0 },
    ]
    expect(sampleAnalysisAtDistance(repeated, 0)).toMatchObject({ distanceM: 0, lon: 100, lat: 30, ele: 1000 })
    expect(nearestAnalysisDistance(repeated, 100, 30)).toBe(0)
    expect(nearestAnalysisIndex(repeated, 0)).toBe(0)
  })

  it('initializes only a missing owner cursor and preserves it across unrelated refreshes', () => {
    const firstReady = points.map((point) => ({ ...point, cumDistM: point.cumDistM + 120 }))
    const routeChanged = points.map((point) => ({ ...point, cumDistM: point.cumDistM + 380 }))
    expect(initialAnalysisCursorDistance(firstReady, null)).toBe(120)
    expect(initialAnalysisCursorDistance(firstReady, 620)).toBe(620)
    expect(initialAnalysisCursorDistance(routeChanged, null)).toBe(380)
  })
})
