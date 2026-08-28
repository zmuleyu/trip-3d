import { describe, expect, it, vi } from 'vitest'
import { runRouteMutationInPlan } from './routeMutationGuard.js'

describe('Analyze route mutation guard', () => {
  const guardedMutation = (operation) => {
    let stage = 'analyze'
    const order = []
    const mutate = vi.fn(() => order.push(operation))

    const accepted = runRouteMutationInPlan({
      enterPlan: () => { stage = 'plan'; order.push('plan') },
      isPlan: () => stage === 'plan',
      mutate,
    })

    expect(accepted).toBe(true)
    expect(mutate).toHaveBeenCalledOnce()
    expect(order).toEqual(['plan', operation])
  }

  it('runs GPX import only after returning to Plan', () => guardedMutation('gpx-import'))
  it('runs library load only after returning to Plan', () => guardedMutation('library-load'))
  it('runs undo only after returning to Plan', () => guardedMutation('undo'))
  it('runs redo only after returning to Plan', () => guardedMutation('redo'))

  it('rejects a mutation when Plan could not be restored', () => {
    const mutate = vi.fn()
    const accepted = runRouteMutationInPlan({
      enterPlan: vi.fn(),
      isPlan: () => false,
      mutate,
    })

    expect(accepted).toBe(false)
    expect(mutate).not.toHaveBeenCalled()
  })
})
