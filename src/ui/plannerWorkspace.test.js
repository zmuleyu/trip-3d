// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createPlannerWorkspace } from './plannerWorkspace.js'

describe('planner workspace chrome', () => {
  it('switches between a 2D planning surface and the 3D preview', () => {
    const onView = vi.fn()
    const workspace = createPlannerWorkspace({ onView })
    expect(workspace.view).toBe('2d')
    workspace.el.querySelector('[data-view="3d"]').click()
    expect(workspace.view).toBe('3d')
    expect(onView).toHaveBeenCalledWith('3d')
    expect(workspace.el.querySelector('[data-view="3d"]').getAttribute('aria-pressed')).toBe('true')
    expect(workspace.el.querySelector('canvas')).toBeNull()
  })

  it('shows a persistent coverage alert with a recovery action', () => {
    const onExpand = vi.fn()
    const workspace = createPlannerWorkspace({ onExpand })
    workspace.setCoverage({ covered: false, outsideCount: 18, total: 240 })
    const alert = workspace.el.querySelector('[role="alert"]')
    expect(alert.classList.contains('hidden')).toBe(false)
    expect(alert.textContent).toContain('18/240')
    alert.querySelector('button').click()
    expect(onExpand).toHaveBeenCalledOnce()
    workspace.setCoverage({ covered: true, outsideCount: 0, total: 240 })
    expect(alert.classList.contains('hidden')).toBe(true)
  })

  it('opens planner layer tools on demand and closes them with the workspace', () => {
    const workspace = createPlannerWorkspace()
    document.body.appendChild(workspace.el)
    const toggle = workspace.el.querySelector('.ui-planner-layer-toggle')
    toggle.click()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.classList.contains('planner-layers-open')).toBe(true)
    workspace.setVisible(false)
    expect(document.body.classList.contains('planner-layers-open')).toBe(false)
  })
})
