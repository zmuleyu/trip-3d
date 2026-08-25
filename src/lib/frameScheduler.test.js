import { describe, expect, it, vi } from 'vitest'
import { createFrameScheduler } from './frameScheduler.js'

describe('legacy frame scheduler lifecycle', () => {
  it('stays idle in Plan, runs in 3D, and stops again on return to Plan', () => {
    let nextId = 0
    const queued = new Map()
    const requestFrame = vi.fn((callback) => {
      const id = ++nextId
      queued.set(id, callback)
      return id
    })
    const cancelFrame = vi.fn((id) => queued.delete(id))
    const onFrame = vi.fn()
    const scheduler = createFrameScheduler({ requestFrame, cancelFrame, onFrame })

    expect(scheduler.running).toBe(false)
    expect(queued.size).toBe(0)

    scheduler.start()
    expect(scheduler.running).toBe(true)
    expect(queued.size).toBe(1)

    const [frameId, frame] = queued.entries().next().value
    queued.delete(frameId)
    frame(16)
    expect(onFrame).toHaveBeenCalledOnce()
    expect(scheduler.frameCount).toBe(1)
    expect(queued.size).toBe(1)

    scheduler.stop()
    expect(scheduler.running).toBe(false)
    expect(scheduler.frameCount).toBe(1)
    expect(queued.size).toBe(0)
    expect(cancelFrame).toHaveBeenCalledOnce()
  })
})
