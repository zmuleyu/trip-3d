import { describe, expect, it } from 'vitest'
import { deriveAnalyzeResilience, selectionForCurrentAnalysisRun } from './analysisResilience.js'

const readyAnalysis = {
  status: 'ready',
  points: [{ cumDistM: 0 }, { cumDistM: 1000 }],
  profile: { distanceM: 1000 },
}

describe('deriveAnalyzeResilience', () => {
  it('distinguishes incomplete, preparing, ready, stale, failed, and 2D fallback', () => {
    expect(deriveAnalyzeResilience({ waypointCount: 1 })).toMatchObject({ status: 'incomplete' })
    expect(deriveAnalyzeResilience({ waypointCount: 2, corridorStatus: 'loading' })).toMatchObject({ status: 'preparing' })
    expect(deriveAnalyzeResilience({ waypointCount: 2, analysis: readyAnalysis, analysisKey: 'run:2', currentRunKey: 'run:2' })).toMatchObject({ status: 'ready' })
    expect(deriveAnalyzeResilience({ waypointCount: 2, analysis: readyAnalysis, analysisKey: 'run:2', currentRunKey: 'run:2', freshnessStale: true })).toMatchObject({ status: 'stale' })
    expect(deriveAnalyzeResilience({ waypointCount: 2, analysis: { status: 'route-terrain-unavailable' }, corridorStatus: 'error' })).toMatchObject({ status: 'failed', reason: 'route-terrain-unavailable' })
    expect(deriveAnalyzeResilience({ waypointCount: 2, analysis: readyAnalysis, analysisKey: 'run:2', currentRunKey: 'run:2', terrainState: 'fallback' })).toMatchObject({ status: 'fallback-ready' })
  })

  it('never presents an old asynchronous ready result as current', () => {
    expect(deriveAnalyzeResilience({
      waypointCount: 2,
      analysis: readyAnalysis,
      analysisKey: 'route:4:raw',
      currentRunKey: 'route:5:raw',
      corridorStatus: 'loading',
    })).toMatchObject({ status: 'preparing' })
  })

  it('requires both current run keys before presenting a ready profile', () => {
    expect(deriveAnalyzeResilience({ waypointCount: 2, analysis: readyAnalysis, analysisKey: 'route:4' })).toMatchObject({ status: 'preparing' })
    expect(deriveAnalyzeResilience({ waypointCount: 2, analysis: readyAnalysis, currentRunKey: 'route:4' })).toMatchObject({ status: 'preparing' })
  })

  it('keeps the known analysis status or corridor error kind as a failure reason', () => {
    expect(deriveAnalyzeResilience({ waypointCount: 2, analysis: { status: 'outside-coverage' } })).toMatchObject({ status: 'failed', reason: 'outside-coverage' })
    expect(deriveAnalyzeResilience({ waypointCount: 2, corridorStatus: 'error', corridorError: { code: 'budget-exceeded' } })).toMatchObject({ status: 'failed', reason: 'budget-exceeded' })
  })

  it('restores a selected segment only for the same route fingerprint and run', () => {
    const checkpoint = { fingerprint: 'route:4', runKey: 'route:4:raw', selection: { kind: 'segment', fromId: 'a', toId: 'b' } }
    expect(selectionForCurrentAnalysisRun({ checkpoint, fingerprint: 'route:4', runKey: 'route:4:raw' })).toEqual(checkpoint.selection)
    expect(selectionForCurrentAnalysisRun({ checkpoint, fingerprint: 'route:5', runKey: 'route:5:raw' })).toBeNull()
  })
})
