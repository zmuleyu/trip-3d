import { describe, expect, it } from 'vitest'
import { deriveRouteOverview } from './routeOverview.js'

const route = { waypoints: [
  { id: 'a', name: '营地' },
  { id: 'b', name: '山口' },
  { id: 'c', name: '出口' },
] }
const segments = [
  { index: 0, selection: { kind: 'segment', fromId: 'a', toId: 'b' }, from: route.waypoints[0], to: route.waypoints[1], startM: 0, endM: 1100, leg: { real: true, durationS: 600 } },
  { index: 1, selection: { kind: 'segment', fromId: 'b', toId: 'c' }, from: route.waypoints[1], to: route.waypoints[2], startM: 1100, endM: 3200, leg: { real: true, durationS: 900 } },
]
const analysis = {
  status: 'ready',
  profile: { distanceM: 3200 },
  grade: { status: 'ready' },
  points: [
    { cumDistM: 0, ele: 1200 },
    { cumDistM: 1100, ele: 1050 },
    { cumDistM: 3200, ele: 1450 },
  ],
}

describe('Route Overview facts', () => {
  it('selects the longest stable segment and absolute maximum signed elevation change', () => {
    const overview = deriveRouteOverview({ route, segments, analysis, resilience: { status: 'ready' }, selectedSegment: segments[0] })
    expect(overview.longest).toMatchObject({ index: 1, distanceM: 2100 })
    expect(overview.elevation).toMatchObject({ index: 1, elevationDeltaM: 400 })
    expect(overview.selected).toMatchObject({ index: 0, distanceM: 1100 })
    expect(overview.availability).toContain('高程与坡度可用')
    expect(overview.availability).toContain('路线时长可用')
  })

  it('keeps a downhill elevation change signed instead of treating it as zero', () => {
    const downhill = deriveRouteOverview({
      route: { waypoints: route.waypoints.slice(0, 2) },
      segments: [segments[0]],
      analysis: { ...analysis, points: [{ cumDistM: 0, ele: 1300 }, { cumDistM: 1100, ele: 1050 }] },
      resilience: { status: 'ready' },
    })
    expect(downhill.elevation).toMatchObject({ elevationDeltaM: -250 })
  })

  it('fails closed for unknown ranges and keeps fallback facts truthful', () => {
    const unknown = deriveRouteOverview({ route, segments: [], analysis, resilience: { status: 'fallback-ready' } })
    expect(unknown.longest).toBeNull()
    expect(unknown.elevation).toBeNull()
    expect(unknown.availability).toContain('3D 不可用，2D 分析可用')
  })

  it.each(['preparing', 'stale', 'failed', 'incomplete'])('does not expose old facts while %s', (status) => {
    const overview = deriveRouteOverview({ route, segments, analysis, resilience: { status } })
    expect(overview.ready).toBe(false)
    expect(overview.longest).toBeNull()
    expect(overview.message).toContain('恢复操作在高程剖面中')
  })
})
