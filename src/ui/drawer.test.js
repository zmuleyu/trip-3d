// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { setDrawerOpen } from './drawer.js'

describe('settings drawer focus lifecycle', () => {
  it('moves focus inside on open and restores the trigger on close', () => {
    const trigger = document.createElement('button')
    trigger.textContent = '设置'
    const drawer = document.createElement('aside')
    const first = document.createElement('button')
    first.textContent = '第一个设置'
    drawer.appendChild(first)
    document.body.append(trigger, drawer)
    trigger.focus()

    setDrawerOpen(drawer, true, trigger)
    expect(drawer.inert).toBe(false)
    expect(drawer.getAttribute('aria-hidden')).toBe('false')
    expect(document.activeElement).toBe(first)

    setDrawerOpen(drawer, false, trigger)
    expect(drawer.inert).toBe(true)
    expect(drawer.getAttribute('aria-hidden')).toBe('true')
    expect(drawer.childElementCount).toBe(0)
    expect(document.activeElement).toBe(trigger)
  })
})
