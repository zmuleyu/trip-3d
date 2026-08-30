import { describe, expect, it } from 'vitest'
import { createSegmentComparison, createSegmentMetrics } from './segmentComparison.js'

const selection = { kind: 'segment', fromId: 'a', toId: 'b' }
const segment = { selection, startM: 0, endM: 1000, leg: { durationS: 600 } }
const metrics = (endEle = 1100, endM = 1000, durationS = 600) => createSegmentMetrics({ ...segment, endM, leg: { durationS } }, [
  { lon: 100, lat: 30, cumDistM: 0, ele: 1000 },
  { lon: 101, lat: 30, cumDistM: endM, ele: endEle },
])

describe('segment comparison', () => {
  it('shows a truthful no-change comparison only after re-analysis is requested', () => {
    const comparison = createSegmentComparison()
    comparison.begin({ selection, fingerprint: 'trip-a:1', metrics: metrics() })
    comparison.observe({ fingerprint: 'trip-a:2', selection, analysisReady: true, metrics: metrics() })
    expect(comparison.value.status).toBe('pending')
    comparison.requestReanalysis({ fingerprint: 'trip-a:2', selection })
    comparison.observe({ fingerprint: 'trip-a:2', selection, analysisReady: true, metrics: metrics() })
    expect(comparison.value).toMatchObject({ status: 'ready', change: { distanceM: 0, elevationDeltaM: 0, netGradePct: 0, durationS: 0 } })
  })

  it('compares real metrics for the same stable segment', () => {
    const comparison = createSegmentComparison()
    comparison.begin({ selection, fingerprint: 'trip-a:1', metrics: metrics(1100, 1000, 600) })
    comparison.observe({ fingerprint: 'trip-a:2', selection, analysisReady: false, metrics: metrics(1150, 1500, 900) })
    comparison.requestReanalysis({ fingerprint: 'trip-a:2', selection })
    comparison.observe({ fingerprint: 'trip-a:2', selection, analysisReady: true, metrics: metrics(1150, 1500, 900) })
    expect(comparison.value).toMatchObject({ status: 'ready', change: { distanceM: 500, elevationDeltaM: 50, durationS: 300 } })
  })

  it('fails closed when the adjacent waypoint identity changes or a route changes', () => {
    const comparison = createSegmentComparison()
    comparison.begin({ selection, fingerprint: 'trip-a:1', metrics: metrics() })
    comparison.observe({ fingerprint: 'trip-a:2', selection: { kind: 'segment', fromId: 'a', toId: 'c' }, analysisReady: false })
    expect(comparison.value).toEqual({ status: 'idle', notice: '该路段已变化，无法直接比较' })

    comparison.begin({ selection, fingerprint: 'trip-a:1', metrics: metrics() })
    comparison.observe({ fingerprint: 'trip-b:2', selection, analysisReady: true, metrics: metrics() })
    expect(comparison.value).toEqual({ status: 'idle', notice: '该路段已变化，无法直接比较' })
  })

  it('keeps pending through loading or errors and never converts unknown metrics to zero', () => {
    const comparison = createSegmentComparison()
    comparison.begin({ selection, fingerprint: 'trip-a:1', metrics: metrics(1100, 1000, null) })
    comparison.observe({ fingerprint: 'trip-a:2', selection, analysisReady: false, metrics: null })
    comparison.requestReanalysis({ fingerprint: 'trip-a:2', selection })
    comparison.observe({ fingerprint: 'trip-a:2', selection, analysisReady: false, metrics: null })
    expect(comparison.value.status).toBe('pending')
    comparison.observe({ fingerprint: 'trip-a:2', selection, analysisReady: true, metrics: metrics(1100, 1000, 600) })
    expect(comparison.value).toMatchObject({ status: 'ready', change: { durationS: null } })
  })
})
