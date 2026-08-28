import { createWorkflowStage, WORKFLOW_STAGES } from '../ui/workflowStage.js'

// Owns workspace transition state while leaving renderer, layout, and UI work
// behind explicit ports. It deliberately has no trip mutation or DOM knowledge.
export function createWorkspaceLifecycleCoordinator({
  getRoute,
  hasLegacyFrameWork,
  onBlocked,
  onStageChange,
  onWorkspaceChange,
  onWorkspaceSettled,
  onPlannerViewRequest,
  onPlannerViewChange,
  onFit,
} = {}) {
  let frameScheduler = null
  let legacyFrameModeActive = false
  let legacyFrameStartPending = false
  let mapWorkspaceActive = false

  const wakeLegacyFrames = () => {
    if (frameScheduler) frameScheduler.start()
    else legacyFrameStartPending = true
  }

  const settleLegacyFrames = () => {
    if (!legacyFrameModeActive && !hasLegacyFrameWork?.()) frameScheduler?.stop()
  }

  const setLegacyFrameModeActive = (on) => {
    legacyFrameModeActive = !!on
    if (legacyFrameModeActive) wakeLegacyFrames()
    else settleLegacyFrames()
  }

  const workflowStage = createWorkflowStage({
    getRoute,
    onBlocked,
    onChange: (stage, detail) => onStageChange?.(stage, detail),
  })

  const applyPlannerView = (view) => {
    const requested = view === '3d' ? '3d' : '2d'
    const actual = onPlannerViewRequest?.(requested) === false ? '2d' : requested
    setLegacyFrameModeActive(false)
    onPlannerViewChange?.({
      requested,
      actual,
      stage: workflowStage.stage,
      mapWorkspaceActive,
    })
    return actual
  }

  const workspaceState = (weather = false) => ({
    weather: !!weather,
    editing: workflowStage.stage === WORKFLOW_STAGES.PLAN,
    view: workflowStage.stage === WORKFLOW_STAGES.ANALYZE ? '3d' : '2d',
  })

  return {
    get stage() { return workflowStage.stage },
    get mapWorkspaceActive() { return mapWorkspaceActive },
    get legacyFrameModeActive() { return legacyFrameModeActive },
    get frameScheduler() { return frameScheduler },
    setStage: (...args) => workflowStage.setStage(...args),
    reconcile: () => workflowStage.reconcile(),
    fallback: (...args) => workflowStage.fallback(...args),
    wakeLegacyFrames,
    setLegacyFrameModeActive,
    settleLegacyFrames,
    attachFrameScheduler(scheduler) {
      frameScheduler = scheduler
      if (legacyFrameStartPending || legacyFrameModeActive || hasLegacyFrameWork?.()) frameScheduler.start()
      legacyFrameStartPending = false
    },
    setMapWorkspace({ weather = false } = {}) {
      mapWorkspaceActive = true
      const state = workspaceState(weather)
      onWorkspaceChange?.({ ...state, mapWorkspaceActive })
      const actual = applyPlannerView(state.view)
      onWorkspaceSettled?.({ ...state, actual, mapWorkspaceActive })
      return actual
    },
    fit() {
      onFit?.()
    },
  }
}
