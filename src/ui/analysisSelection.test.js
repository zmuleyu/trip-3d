import { describe, expect, it } from 'vitest'
import { adjacentAnalysisSegment, analysisSegmentAtDistance, analysisSegmentForSelection, analysisSegmentRanges } from './analysisSelection.js'

const route = { waypoints: [
  { id: 'a', lon: 100, lat: 30, name: '甲' },
  { id: 'b', lon: 101, lat: 30, name: '乙' },
  { id: 'c', lon: 102, lat: 30, name: '丙' },
] }
const points = [
  { lon: 100, lat: 30, cumDistM: 0, ele: 100 },
  { lon: 101, lat: 30, cumDistM: 1000, ele: 200 },
  { lon: 102, lat: 30, cumDistM: 3000, ele: 300 },
]
const legs = [{ distanceM: 1000 }, { distanceM: 2000 }]

describe('Analyze segment selection', () => {
  it('uses adjacent waypoint IDs and profile-distance ranges for one stable selection', () => {
    expect(analysisSegmentRanges(route, points, legs)).toMatchObject([
      { selection: { kind: 'segment', fromId: 'a', toId: 'b' }, startM: 0, endM: 1000 },
      { selection: { kind: 'segment', fromId: 'b', toId: 'c' }, startM: 1000, endM: 3000 },
    ])
    expect(analysisSegmentAtDistance(route, points, legs, 1500)?.selection).toEqual({ kind: 'segment', fromId: 'b', toId: 'c' })
  })

  it('reconciles stale selections and supports keyboard-adjacent legs', () => {
    const first = { kind: 'segment', fromId: 'a', toId: 'b' }
    expect(analysisSegmentForSelection(first, route, points, legs)?.index).toBe(0)
    expect(adjacentAnalysisSegment(first, route, points, legs, 1)?.selection).toEqual({ kind: 'segment', fromId: 'b', toId: 'c' })
    expect(analysisSegmentForSelection({ kind: 'segment', fromId: 'a', toId: 'c' }, route, points, legs)).toBeNull()
  })
})
