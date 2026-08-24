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

  it('keeps search and secondary actions progressively disclosed', () => {
    const onSearch = vi.fn()
    const onMoreAction = vi.fn()
    const workspace = createPlannerWorkspace({ onSearch, onMoreAction })
    document.body.appendChild(workspace.el)
    const search = workspace.el.querySelector('.ui-command-search')
    search.querySelector('input').value = '四姑娘山'
    search.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(onSearch).toHaveBeenCalledWith('四姑娘山')

    workspace.el.querySelector('.ui-planner-more').click()
    expect(workspace.el.querySelector('.ui-planner-more-menu').classList.contains('hidden')).toBe(false)
    workspace.el.querySelector('[data-more-action="settings"]').click()
    expect(onMoreAction).toHaveBeenCalledWith('settings')
  })

  it('renders a compact multi-day trip spine and opens details from either edge', () => {
    const onSpineExpand = vi.fn()
    const workspace = createPlannerWorkspace({ onSpineExpand })
    document.body.appendChild(workspace.el)
    workspace.setJourneySpine({
      route: {
        dayEnds: ['b'],
        waypoints: [
          { id: 'a', name: '起点' },
          { id: 'b', name: '盆景滩' },
          { id: 'c', name: '终点' },
        ],
      },
      legs: [{ distanceM: 4800 }, { distanceM: 3200 }],
      weatherDays: [
        { date: '2026-08-24', isRain: false, tempMax: 18 },
        { date: '2026-08-25', isRain: true, tempMax: 12 },
      ],
    })
    const days = workspace.el.querySelectorAll('.ui-trip-spine-day')
    expect(days).toHaveLength(2)
    expect(days[0].textContent).toContain('D1 · 08月24日')
    expect(days[0].textContent).toContain('起点 → 盆景滩')
    expect(days[1].textContent).toContain('有雨 12°')
    workspace.el.querySelector('.ui-trip-spine-title').click()
    workspace.el.querySelector('.ui-trip-spine-expand').click()
    expect(onSpineExpand).toHaveBeenCalledTimes(2)
  })

  it('distinguishes route editing from the first planning action', () => {
    const workspace = createPlannerWorkspace()
    workspace.setPrimaryLabel('编辑路线')
    expect(workspace.el.querySelector('.ui-planner-primary').classList.contains('has-route')).toBe(true)
    workspace.setPrimaryLabel('开始规划')
    expect(workspace.el.querySelector('.ui-planner-primary').classList.contains('has-route')).toBe(false)
  })
})
