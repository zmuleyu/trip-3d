import { describe, expect, it } from 'vitest'
import { createAnalysisFreshness, routeGeometryFingerprint } from './analysisFreshness.js'

describe('analysis freshness', () => {
  it('only expires a completed analysis when route geometry changes', () => {
    const route = { id: 'trip-a', geometryRevision: 2 }
    const freshness = createAnalysisFreshness()
    expect(routeGeometryFingerprint(route)).toBe('trip-a:2')
    freshness.markAnalyzed(route)
    expect(freshness.isStale({ ...route, revision: 9 })).toBe(false)
    expect(freshness.isStale({ ...route, geometryRevision: 3 })).toBe(true)
  })
})
