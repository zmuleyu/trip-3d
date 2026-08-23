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

  it('throttles live 3D preview copies from the renderer canvas', () => {
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage })
    const workspace = createPlannerWorkspace()
    const source = document.createElement('canvas')
    source.width = 1440
    source.height = 900
    workspace.drawPreview(source, 1000)
    workspace.drawPreview(source, 1100)
    workspace.drawPreview(source, 1300)
    expect(drawImage).toHaveBeenCalledTimes(2)
  })
})
