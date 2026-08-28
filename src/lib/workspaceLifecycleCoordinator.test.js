import { describe, expect, it, vi } from 'vitest'
import { WORKFLOW_STAGES } from '../ui/workflowStage.js'
import { createWorkspaceLifecycleCoordinator } from './workspaceLifecycleCoordinator.js'

function createScheduler() {
  return { start: vi.fn(), stop: vi.fn() }
}

describe('workspace lifecycle coordinator', () => {
  it('keeps Plan idle while allowing explicit short legacy work to wake frames', () => {
    const scheduler = createScheduler()
    let legacyWork = false
    const coordinator = createWorkspaceLifecycleCoordinator({ hasLegacyFrameWork: () => legacyWork })

    coordinator.attachFrameScheduler(scheduler)
    coordinator.setMapWorkspace({ view: '2d', editing: true })
    coordinator.settleLegacyFrames()
    expect(scheduler.stop).toHaveBeenCalled()
    expect(scheduler.start).not.toHaveBeenCalled()

    legacyWork = true
    coordinator.wakeLegacyFrames()
    expect(scheduler.start).toHaveBeenCalledTimes(1)
  })

  it('does not wake legacy frames for Analyze itself', () => {
    const scheduler = createScheduler()
    const route = { waypoints: [{ id: 'start' }, { id: 'finish' }] }
    const requestView = vi.fn(() => true)
    const coordinator = createWorkspaceLifecycleCoordinator({
      getRoute: () => route,
      hasLegacyFrameWork: () => false,
      onPlannerViewRequest: requestView,
    })

    coordinator.attachFrameScheduler(scheduler)
    expect(coordinator.setStage(WORKFLOW_STAGES.ANALYZE)).toBe(true)
    expect(coordinator.applyPlannerView('3d')).toBe('3d')
    expect(requestView).toHaveBeenCalledWith('3d')
    expect(scheduler.start).not.toHaveBeenCalled()
  })

  it('settles a workspace once after its synchronous view transition', () => {
    const calls = []
    const coordinator = createWorkspaceLifecycleCoordinator({
      onWorkspaceChange: () => calls.push('workspace'),
      onPlannerViewRequest: () => { calls.push('request-view'); return true },
      onPlannerViewChange: () => calls.push('apply-view'),
      onWorkspaceSettled: () => calls.push('settle'),
    })

    coordinator.setMapWorkspace({ weather: false, editing: true, view: '2d' })

    expect(calls).toEqual(['workspace', 'request-view', 'apply-view', 'settle'])
  })

  it('keeps a terrain refusal explicit so callers can truthfully fallback to Plan', () => {
    const route = { waypoints: [{ id: 'start' }, { id: 'finish' }] }
    const coordinator = createWorkspaceLifecycleCoordinator({
      getRoute: () => route,
      onPlannerViewRequest: () => false,
    })

    coordinator.setStage(WORKFLOW_STAGES.ANALYZE)
    expect(coordinator.applyPlannerView('3d')).toBe('2d')
    expect(coordinator.fallback('terrain-unavailable')).toBe(true)
    expect(coordinator.stage).toBe(WORKFLOW_STAGES.PLAN)
  })
})
