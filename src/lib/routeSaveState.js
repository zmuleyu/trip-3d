// Local-save presentation is derived from an exact route snapshot, never from
// a revision counter. Undo creates new revisions, so returning to the saved
// route must still truthfully restore the saved state.
export function routeSaveFingerprint(route) {
  return JSON.stringify({
    id: route?.id ?? null,
    name: route?.name ?? '',
    mode: route?.mode ?? 'straight',
    waypoints: (route?.waypoints ?? []).map(({ id, lon, lat, ele, name }) => ({ id, lon, lat, ele, name })),
    dayEnds: route?.dayEnds ?? [],
  })
}

export function createRouteSaveState() {
  let savedSnapshot = null
  let failedSnapshot = null
  let unavailable = false

  const snapshot = (route) => ({ routeId: route?.id ?? null, fingerprint: routeSaveFingerprint(route) })
  const matches = (candidate, route) => candidate?.routeId === route?.id && candidate.fingerprint === routeSaveFingerprint(route)

  return {
    status(route) {
      if (unavailable) return 'unavailable'
      if (matches(savedSnapshot, route)) return 'saved'
      if (matches(failedSnapshot, route)) return 'failed'
      return (route?.waypoints?.length ?? 0) ? 'dirty' : 'idle'
    },
    markSaved(route) {
      savedSnapshot = snapshot(route)
      failedSnapshot = null
    },
    markFailed(route) {
      failedSnapshot = snapshot(route)
    },
    markUnavailable() {
      unavailable = true
    },
  }
}
