import { sampleAnalysisAtDistance } from './analysisCursor.js'

function stableSelection(selection) {
  return selection?.kind === 'segment' && selection.fromId && selection.toId
    ? { kind: 'segment', fromId: selection.fromId, toId: selection.toId }
    : null
}

function sameSelection(a, b) {
  return a?.kind === b?.kind && a?.fromId === b?.fromId && a?.toId === b?.toId
}

function numeric(value) {
  return Number.isFinite(value) ? value : null
}

function fingerprintRouteId(fingerprint) {
  const separator = typeof fingerprint === 'string' ? fingerprint.lastIndexOf(':') : -1
  return separator > 0 ? fingerprint.slice(0, separator) : null
}

export function createSegmentMetrics(segment, points) {
  const selection = stableSelection(segment?.selection)
  const distanceM = numeric(segment?.endM - segment?.startM)
  const start = sampleAnalysisAtDistance(points, segment?.startM)
  const end = sampleAnalysisAtDistance(points, segment?.endM)
  const elevationDeltaM = Number.isFinite(start?.ele) && Number.isFinite(end?.ele) ? end.ele - start.ele : null
  return selection && distanceM != null && distanceM >= 0
    ? {
        selection,
        distanceM,
        elevationDeltaM,
        netGradePct: Number.isFinite(elevationDeltaM) && distanceM > 0 ? (elevationDeltaM / distanceM) * 100 : null,
        durationS: numeric(segment?.leg?.durationS),
      }
    : null
}

function comparisonChange(before, current) {
  return Object.fromEntries(['distanceM', 'elevationDeltaM', 'netGradePct', 'durationS'].map((field) => [
    field,
    Number.isFinite(before[field]) && Number.isFinite(current[field]) ? current[field] - before[field] : null,
  ]))
}

// A comparison belongs to one explicit Adjust → Re-analyze iteration. It keeps
// only the selected adjacent waypoint IDs and proven segment metrics; route
// geometry and analysis data stay owned by their existing lifecycles.
export function createSegmentComparison() {
  let state = { status: 'idle', notice: null }

  const invalidate = (notice) => {
    state = { status: 'idle', notice }
    return state
  }

  return {
    begin({ selection, fingerprint, metrics } = {}) {
      const stable = stableSelection(selection)
      if (!stable || !fingerprint || !metrics || !sameSelection(stable, metrics.selection)) return invalidate(null)
      state = {
        status: 'pending',
        selection: stable,
        before: { ...metrics, fingerprint },
        pendingFingerprint: null,
        reanalysisRequested: false,
        notice: null,
      }
      return state
    },
    requestReanalysis({ fingerprint, selection } = {}) {
      if (state.status !== 'pending') return state
      if (!sameSelection(state.selection, stableSelection(selection))) return invalidate('该路段已变化，无法直接比较')
      if (!state.pendingFingerprint || state.pendingFingerprint !== fingerprint) return invalidate(null)
      state = { ...state, reanalysisRequested: true }
      return state
    },
    observe({ fingerprint, selection, analysisReady, metrics } = {}) {
      if (state.status === 'idle') return state
      const stable = stableSelection(selection)
      if (!sameSelection(state.selection, stable)) return invalidate('该路段已变化，无法直接比较')
      if (state.status === 'ready') {
        return state.current.fingerprint === fingerprint ? state : invalidate('该路段已变化，无法直接比较')
      }
      if (fingerprintRouteId(state.before.fingerprint) !== fingerprintRouteId(fingerprint)) {
        return invalidate('该路段已变化，无法直接比较')
      }
      if (fingerprint !== state.before.fingerprint) {
        state = { ...state, pendingFingerprint: fingerprint }
      }
      if (!state.reanalysisRequested || !analysisReady || state.pendingFingerprint !== fingerprint) return state
      if (!metrics || !sameSelection(state.selection, metrics.selection)) return invalidate('当前路段指标不可用，无法直接比较')
      state = {
        status: 'ready',
        selection: state.selection,
        before: state.before,
        current: { ...metrics, fingerprint },
        change: comparisonChange(state.before, metrics),
        notice: null,
      }
      return state
    },
    clear() {
      state = { status: 'idle', notice: null }
      return state
    },
    get value() { return state },
    get selection() { return state.selection ?? null },
  }
}
