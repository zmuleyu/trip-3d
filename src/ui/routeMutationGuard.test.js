import { describe, expect, it, vi } from 'vitest'
import { runRouteMutationInPlan } from './routeMutationGuard.js'

describe('Analyze route mutation guard', () => {
  const guardedMutation = (operation) => {
    let stage = 'analyze'
    let editing = false
    const order = []
    const mutate = vi.fn(() => order.push(operation))

    const accepted = runRouteMutationInPlan({
      enterPlanForEditing: () => { stage = 'plan'; editing = true; order.push('plan') },
      isPlanEditing: () => stage === 'plan' && editing,
      mutate,
    })

    expect(accepted).toBe(true)
    expect(mutate).toHaveBeenCalledOnce()
    expect(order).toEqual(['plan', operation])
  }

  it('runs GPX import only after returning to Plan editing', () => guardedMutation('gpx-import'))
  it('runs library load only after returning to Plan editing', () => guardedMutation('library-load'))
  it('runs undo only after returning to Plan editing', () => guardedMutation('undo'))
  it('runs redo only after returning to Plan editing', () => guardedMutation('redo'))

  it('rejects a mutation when Plan editing could not be restored', () => {
    const mutate = vi.fn()
    const accepted = runRouteMutationInPlan({
      enterPlanForEditing: vi.fn(),
      isPlanEditing: () => false,
      mutate,
    })

    expect(accepted).toBe(false)
    expect(mutate).not.toHaveBeenCalled()
  })
})
