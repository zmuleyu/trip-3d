export const WORKFLOW_STAGES = Object.freeze({
  PLAN: 'plan',
  ANALYZE: 'analyze',
})

export function routeCanBeAnalyzed(route) {
  return (route?.waypoints?.length ?? 0) >= 2
}

export function createWorkflowStage({ getRoute, onChange, onBlocked } = {}) {
  let stage = WORKFLOW_STAGES.PLAN

  const transition = (next, reason) => {
    if (next === stage) return false
    stage = next
    onChange?.(stage, { reason, route: getRoute?.() ?? null })
    return true
  }

  return {
    get stage() { return stage },
    setStage(next, { reason = 'user' } = {}) {
      const requested = next === WORKFLOW_STAGES.ANALYZE
        ? WORKFLOW_STAGES.ANALYZE
        : WORKFLOW_STAGES.PLAN
      if (requested === WORKFLOW_STAGES.ANALYZE && !routeCanBeAnalyzed(getRoute?.())) {
        onBlocked?.('至少添加起点和终点')
        return false
      }
      transition(requested, reason)
      return stage === requested
    },
    reconcile() {
      if (stage !== WORKFLOW_STAGES.ANALYZE || routeCanBeAnalyzed(getRoute?.())) return false
      return transition(WORKFLOW_STAGES.PLAN, 'route-unavailable')
    },
    fallback(reason = 'terrain-unavailable') {
      return transition(WORKFLOW_STAGES.PLAN, reason)
    },
  }
}
