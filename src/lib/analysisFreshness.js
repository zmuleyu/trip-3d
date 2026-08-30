export function routeGeometryFingerprint(route) {
  if (!route?.id || !Number.isFinite(route.geometryRevision)) return null
  return `${route.id}:${route.geometryRevision}`
}

// This transient record tracks geometry only: naming and presentation edits do
// not make terrain facts stale.
export function createAnalysisFreshness() {
  let analyzedFingerprint = null
  return {
    markAnalyzed(route) {
      analyzedFingerprint = routeGeometryFingerprint(route)
      return analyzedFingerprint
    },
    isStale(route) {
      const current = routeGeometryFingerprint(route)
      return !!analyzedFingerprint && analyzedFingerprint !== current
    },
    get fingerprint() { return analyzedFingerprint },
  }
}
