import { describe, it, expect } from 'vitest'
import { createHistory } from './history.js'
import { createRoute, addWaypoint, removeWaypoint, moveWaypoint, toggleDayEnd } from './route.js'

const mk = () => {
  const r = createRoute('t')
  addWaypoint(r, 116.0, 39.0, 100, 'A')
  addWaypoint(r, 116.1, 39.1, 200, 'B')
  return r
}

describe('edit history stack', () => {
  it('record → undo restores previous snapshot; redo re-applies', () => {
    const r = mk()
    const h = createHistory()
    h.reset(r)
    expect(h.canUndo()).toBe(false)
    addWaypoint(r, 116.2, 39.2, 300, 'C')
    h.record(r)
    expect(h.canUndo()).toBe(true)
    h.undo(r)
    expect(r.waypoints.map((w) => w.name)).toEqual(['A', 'B'])
    expect(h.canRedo()).toBe(true)
    h.redo(r)
    expect(r.waypoints.map((w) => w.name)).toEqual(['A', 'B', 'C'])
  })
  it('new edit clears redo stack', () => {
    const r = mk()
    const h = createHistory()
    h.reset(r)
    addWaypoint(r, 116.2, 39.2, 300, 'C')
    h.record(r)
    h.undo(r)
    removeWaypoint(r, 1)
    h.record(r)
    expect(h.canRedo()).toBe(false)
  })
  it('record is a no-op when nothing changed (dedup)', () => {
    const r = mk()
    const h = createHistory()
    h.reset(r)
    h.record(r) // identical state
    expect(h.canUndo()).toBe(false)
  })
  it('undo/redo includes the first-class route mode', () => {
    const r = mk()
    const h = createHistory()
    h.reset(r)
    r.mode = 'foot'
    h.record(r)
    expect(h.undo(r)).toBe(true)
    expect(r.mode).toBe('straight')
    expect(h.redo(r)).toBe(true)
    expect(r.mode).toBe('foot')
  })
  it('snapshots include dayEnds; cap trims oldest', () => {
    const r = mk()
    const h = createHistory(3)
    h.reset(r)
    toggleDayEnd(r, 1)
    h.record(r) // S1: dayEnds set
    addWaypoint(r, 116.2, 39.2, 300, 'C')
    h.record(r)
    moveWaypoint(r, 0, 2)
    h.record(r)
    removeWaypoint(r, 0)
    h.record(r) // 4 records on cap 3 → oldest (pre-dayEnd) trimmed
    let steps = 0
    while (h.undo(r)) steps++
    expect(steps).toBe(3) // can only walk back to S1, not the trimmed S0
    expect(r.dayEnds).toHaveLength(1) // S1 included the day-end marker
    expect(r.waypoints).toHaveLength(2)
  })
})
