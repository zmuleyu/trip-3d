const analysisIsReady = (analysis) => analysis?.status === 'ready' && Array.isArray(analysis.points) && analysis.points.length >= 2 && !!analysis.profile

// This is presentation-only. The route controller and DEM controller remain the
// lifecycle owners; Profile receives one truthful state derived from them.
export function deriveAnalyzeResilience({
  waypointCount = 0,
  analysis,
  analysisKey = null,
  currentRunKey = null,
  corridorStatus = 'idle',
  corridorError = null,
  freshnessStale = false,
  terrainState = 'ready',
} = {}) {
  if (waypointCount < 2) return { status: 'incomplete' }

  const runMatches = typeof analysisKey === 'string' && analysisKey.length > 0
    && typeof currentRunKey === 'string' && currentRunKey.length > 0
    && analysisKey === currentRunKey
  const ready = runMatches && analysisIsReady(analysis)

  if (corridorStatus === 'loading' || analysis?.status === 'route-terrain-loading') return { status: 'preparing' }
  if (corridorStatus === 'error') {
    return { status: 'failed', reason: analysis?.status ?? corridorError?.code ?? 'route-terrain-unavailable' }
  }
  if (freshnessStale) return { status: 'stale' }
  if (terrainState === 'fallback' && ready) return { status: 'fallback-ready' }
  if (ready) return { status: 'ready' }
  if (['dem-unavailable', 'outside-coverage', 'route-terrain-unavailable', 'route-terrain-budget', 'route-terrain-cancelled'].includes(analysis?.status)) {
    return { status: 'failed', reason: analysis.status }
  }
  return { status: 'preparing' }
}

export function selectionForCurrentAnalysisRun({ checkpoint, fingerprint, runKey } = {}) {
  if (!checkpoint?.selection || checkpoint.fingerprint !== fingerprint || checkpoint.runKey !== runKey) return null
  return checkpoint.selection
}
