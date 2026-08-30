import { describe, expect, it } from 'vitest'
import { createRouteSaveState } from './routeSaveState.js'

const route = (id = 'route-a') => ({
  id,
  name: '川西路线',
  mode: 'straight',
  waypoints: [{ id: 'a', lon: 102.1, lat: 31.1, ele: 3200, name: '起点' }, { id: 'b', lon: 102.2, lat: 31.2, ele: 3300, name: '终点' }],
  dayEnds: [],
})

describe('local route save state', () => {
  it('restores saved state when undo returns to the exact saved snapshot', () => {
    const state = createRouteSaveState()
    const current = route()
    state.markSaved(current)
    expect(state.status(current)).toBe('saved')
    current.waypoints[1].name = '新终点'
    expect(state.status(current)).toBe('dirty')
    current.waypoints[1].name = '终点'
    expect(state.status(current)).toBe('saved')
  })

  it('keeps failed saves dirty and isolates saved state by route identity', () => {
    const state = createRouteSaveState()
    const current = route()
    state.markFailed(current)
    expect(state.status(current)).toBe('failed')
    current.name = '再次编辑'
    expect(state.status(current)).toBe('dirty')
    expect(state.status(route('route-b'))).toBe('dirty')
  })

  it('reports unavailable local storage instead of a stale saved claim', () => {
    const state = createRouteSaveState()
    const current = route()
    state.markSaved(current)
    state.markUnavailable()
    expect(state.status(current)).toBe('unavailable')
  })
})
