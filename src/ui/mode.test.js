import { describe, it, expect, vi } from 'vitest'
import { createModeMachine, MODES } from './mode.js'

describe('mode machine', () => {
  it('starts in browse mode', () => {
    const m = createModeMachine()
    expect(m.mode).toBe(MODES.BROWSE)
    expect(m.isPlanning()).toBe(false)
  })

  it('enterPlanning / exitPlanning transitions with notification', () => {
    const onChange = vi.fn()
    const m = createModeMachine({ onChange })
    m.enterPlanning()
    expect(m.mode).toBe(MODES.PLANNING)
    expect(m.isPlanning()).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith(MODES.PLANNING)
    m.exitPlanning()
    expect(m.mode).toBe(MODES.BROWSE)
    expect(onChange).toHaveBeenLastCalledWith(MODES.BROWSE)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('togglePlanning flips both ways; redundant transitions do not notify', () => {
    const onChange = vi.fn()
    const m = createModeMachine({ onChange })
    m.enterPlanning()
    m.enterPlanning() // no-op
    expect(onChange).toHaveBeenCalledTimes(1)
    m.togglePlanning()
    expect(m.mode).toBe(MODES.BROWSE)
    m.togglePlanning()
    expect(m.mode).toBe(MODES.PLANNING)
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('handleKey exits planning on Escape, ignores other keys and browse mode', () => {
    const m = createModeMachine()
    m.enterPlanning()
    expect(m.handleKey('a')).toBe(false)
    expect(m.mode).toBe(MODES.PLANNING)
    expect(m.handleKey('Escape')).toBe(true)
    expect(m.mode).toBe(MODES.BROWSE)
    expect(m.handleKey('Escape')).toBe(false) // already browse
  })
})
