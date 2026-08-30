import { describe, expect, it } from 'vitest'
import { canMarkAnalysisFresh, createAnalysisFreshness, routeGeometryFingerprint } from './analysisFreshness.js'

describe('analysis freshness', () => {
  it('only expires a completed analysis when route geometry changes', () => {
    const route = { id: 'trip-a', geometryRevision: 2 }
    const freshness = createAnalysisFreshness()
    expect(routeGeometryFingerprint(route)).toBe('trip-a:2')
    freshness.markAnalyzed(route)
    expect(freshness.isStale({ ...route, revision: 9 })).toBe(false)
    expect(freshness.isStale({ ...route, geometryRevision: 3 })).toBe(true)
    expect(freshness.isStale({ id: 'trip-b', geometryRevision: 9 })).toBe(false)
  })

  it('marks fresh only for a ready current analysis in either usable Analyze view', () => {
    expect(canMarkAnalysisFresh({ stage: 'analyze', analysis: { status: 'ready' }, plannerView: '3d' })).toBe(true)
    expect(canMarkAnalysisFresh({ stage: 'analyze', analysis: { status: 'loading' }, plannerView: '3d' })).toBe(false)
    expect(canMarkAnalysisFresh({ stage: 'analyze', analysis: { status: 'ready' }, plannerView: '2d' })).toBe(true)
    expect(canMarkAnalysisFresh({ stage: 'plan', analysis: { status: 'ready' }, plannerView: '3d' })).toBe(false)
  })
})
