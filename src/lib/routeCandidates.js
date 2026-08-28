// Transient route-result identity helpers. They deliberately do not own or
// mutate Trip state: a selected provider alternative is derived path state.
export function createRouteCandidateId({ routeId, geometryRevision, mode, requestId, index }) {
  return `${routeId}:${geometryRevision}:${mode}:${requestId}:${index}`
}

export function isCurrentRouteCandidate(candidate, { routeId, geometryRevision, mode } = {}) {
  return !!candidate && candidate.routeId === routeId && candidate.geometryRevision === geometryRevision && candidate.mode === mode
}

export function routeCandidatePathKey({ version, resultId, candidate } = {}) {
  return candidate ? `snapped:${version}:result:${resultId}:candidate:${candidate.id}` : 'raw'
}

export function weatherResultMatchesPath(weather, { revision, pathKey } = {}) {
  return !!weather?.result && weather.revision === revision && weather.pathKey === pathKey
}
