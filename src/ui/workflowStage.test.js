import { describe, expect, it, vi } from 'vitest'
import { createWorkflowStage, routeCanBeAnalyzed, WORKFLOW_STAGES } from './workflowStage.js'

describe('Plan and Analyze workflow stage', () => {
  it('keeps one route object and its waypoint IDs across Plan → Analyze → Plan', () => {
    const route = { id: 'trip-a', waypoints: [{ id: 'start' }, { id: 'finish' }] }
    const onChange = vi.fn()
    const workflow = createWorkflowStage({ getRoute: () => route, onChange })

    expect(workflow.setStage(WORKFLOW_STAGES.ANALYZE)).toBe(true)
    expect(workflow.setStage(WORKFLOW_STAGES.PLAN)).toBe(true)

    expect(onChange.mock.calls.map(([stage]) => stage)).toEqual(['analyze', 'plan'])
    expect(onChange.mock.calls.every(([, context]) => context.route === route)).toBe(true)
    expect(route.waypoints.map(({ id }) => id)).toEqual(['start', 'finish'])
  })

  it('blocks Analyze until the route has a start and finish', () => {
    const onBlocked = vi.fn()
    const onChange = vi.fn()
    const route = { waypoints: [{ id: 'start' }] }
    const workflow = createWorkflowStage({ getRoute: () => route, onBlocked, onChange })

    expect(routeCanBeAnalyzed(route)).toBe(false)
    expect(workflow.setStage(WORKFLOW_STAGES.ANALYZE)).toBe(false)
    expect(workflow.stage).toBe(WORKFLOW_STAGES.PLAN)
    expect(onBlocked).toHaveBeenCalledWith('至少添加起点和终点')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('returns truthfully to Plan when the route or terrain becomes unavailable', () => {
    const route = { waypoints: [{ id: 'start' }, { id: 'finish' }] }
    const onChange = vi.fn()
    const workflow = createWorkflowStage({ getRoute: () => route, onChange })
    workflow.setStage(WORKFLOW_STAGES.ANALYZE)

    route.waypoints.pop()
    expect(workflow.reconcile()).toBe(true)
    expect(workflow.stage).toBe(WORKFLOW_STAGES.PLAN)
    expect(onChange).toHaveBeenLastCalledWith('plan', expect.objectContaining({ reason: 'route-unavailable', route }))

    route.waypoints.push({ id: 'finish' })
    workflow.setStage(WORKFLOW_STAGES.ANALYZE)
    expect(workflow.fallback()).toBe(true)
    expect(workflow.stage).toBe(WORKFLOW_STAGES.PLAN)
    expect(onChange).toHaveBeenLastCalledWith('plan', expect.objectContaining({ reason: 'terrain-unavailable', route }))
  })
})
