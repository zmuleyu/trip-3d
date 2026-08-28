import { describe, it, expect, vi } from 'vitest'
import { createSnapRequestGate, joinGeometries, snapCacheKey } from './snap.js'

describe('joinGeometries', () => {
  it('concatenates segments dropping duplicate seam points', () => {
    const segs = [
      [[0, 0], [1, 1], [2, 2]],
      [[2, 2], [3, 3]],
      [[3, 3], [4, 4], [5, 5]],
    ]
    expect(joinGeometries(segs)).toEqual([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]])
  })
  it('empty/single segment passthrough', () => {
    expect(joinGeometries([])).toEqual([])
    expect(joinGeometries([[[0, 0], [1, 1]]])).toEqual([[0, 0], [1, 1]])
  })
})

describe('snapCacheKey', () => {
  it('includes provider/profile and direction matters', () => {
    const a = { lon: 102.83, lat: 31.05 }
    const b = { lon: 102.9, lat: 31.02 }
    expect(snapCacheKey('osrm', 'foot', a, b)).not.toBe(snapCacheKey('osrm', 'foot', b, a))
    expect(snapCacheKey('osrm', 'foot', a, b)).not.toBe(snapCacheKey('osrm', 'hiking', a, b))
    expect(snapCacheKey('osrm', 'foot', a, b)).not.toBe(snapCacheKey('amap', 'foot', a, b))
  })
})

describe('route request gate', () => {
  it('keeps only the latest geometry and dispatches at most once per 1.1 seconds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const calls = []
    const dispatch = vi.fn((intent, { signal }) => {
      calls.push({ identity: intent.identity, signal })
      if (intent.identity === 'route:1') return new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))
      return Promise.resolve()
    })
    const gate = createSnapRequestGate({ dispatch, minIntervalMs: 1100 })

    expect(gate.schedule({ identity: 'route:1', points: [[0, 0], [1, 1]] })).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    vi.setSystemTime(100)
    expect(gate.schedule({ identity: 'route:2', points: [[0, 0], [2, 2]] })).toBe(true)
    expect(gate.schedule({ identity: 'route:3', points: [[0, 0], [3, 3]] })).toBe(true)
    await vi.advanceTimersByTimeAsync(999)
    expect(dispatch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)

    expect(calls.map((call) => call.identity)).toEqual(['route:1', 'route:3'])
    expect(calls[0].signal.aborted).toBe(true)
    expect(dispatch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('coalesces duplicate pending and active route identities', async () => {
    vi.useFakeTimers()
    const dispatch = vi.fn(() => new Promise(() => {}))
    const gate = createSnapRequestGate({ dispatch, minIntervalMs: 1100 })
    const intent = { identity: 'same-route' }
    expect(gate.schedule(intent)).toBe(true)
    expect(gate.schedule(intent)).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(gate.schedule(intent)).toBe(false)
    expect(dispatch).toHaveBeenCalledTimes(1)
    gate.cancel()
    vi.useRealTimers()
  })
})
