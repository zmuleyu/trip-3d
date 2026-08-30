export function routeGeometryFingerprint(route) {
  if (!route?.id || !Number.isFinite(route.geometryRevision)) return null
  return `${route.id}:${route.geometryRevision}`
}

export function canMarkAnalysisFresh({ stage, analysis, plannerView } = {}) {
  return stage === 'analyze' && analysis?.status === 'ready' && plannerView === '3d'
}

// This transient record tracks geometry only: naming and presentation edits do
// not make terrain facts stale.
export function createAnalysisFreshness() {
  let analyzedFingerprint = null
  let analyzedRouteId = null
  return {
    markAnalyzed(route) {
      analyzedFingerprint = routeGeometryFingerprint(route)
      analyzedRouteId = route?.id ?? null
      return analyzedFingerprint
    },
    isStale(route) {
      const current = routeGeometryFingerprint(route)
      if (!analyzedFingerprint || !current) return false
      return analyzedRouteId === route?.id && analyzedFingerprint !== current
    },
    get fingerprint() { return analyzedFingerprint },
  }
}
