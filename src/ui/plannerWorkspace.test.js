// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createPlannerWorkspace } from './plannerWorkspace.js'

describe('planner workspace chrome', () => {
  it('switches between Plan and Analyze only after a route is available', () => {
    const onStage = vi.fn()
    const workspace = createPlannerWorkspace({ onStage })
    const analyze = workspace.el.querySelector('[data-stage="analyze"]')
    expect(workspace.stage).toBe('plan')
    expect(workspace.view).toBe('2d')
    expect(analyze.disabled).toBe(true)
    expect(analyze.getAttribute('aria-label')).toContain('至少添加起点和终点')

    workspace.setAnalyzeAvailable(true)
    analyze.click()
    expect(workspace.stage).toBe('analyze')
    expect(workspace.view).toBe('3d')
    expect(onStage).toHaveBeenCalledWith('analyze')
    expect(analyze.getAttribute('aria-selected')).toBe('true')
    expect(workspace.el.querySelector('canvas')).toBeNull()
  })

  it('keeps route-coverage internals out of the workspace chrome', () => {
    const workspace = createPlannerWorkspace()
    workspace.setCoverage({ covered: false, outsideCount: 18, total: 240 })
    expect(workspace.el.querySelector('.ui-route-coverage')).toBeNull()
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

  it('keeps secondary destinations discoverable inside the overflow menu', () => {
    const onMoreAction = vi.fn()
    const workspace = createPlannerWorkspace({ onMoreAction })
    for (const action of ['library', 'save', 'share', 'import', 'export', 'admin', 'settings']) {
      expect(workspace.el.querySelector(`[data-more-action="${action}"]`)).not.toBeNull()
    }
    workspace.el.querySelector('[data-more-action="admin"]').click()
    expect(onMoreAction).toHaveBeenCalledWith('admin')
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

  it('uses the primary action to enter Analyze and to return to Plan', () => {
    const onPrimary = vi.fn()
    const workspace = createPlannerWorkspace({ onPrimary })
    const primary = workspace.el.querySelector('.ui-planner-primary')

    expect(primary.textContent).toBe('开始规划')
    primary.click()
    expect(onPrimary).toHaveBeenLastCalledWith({ stage: 'plan', analyzeAvailable: false })

    workspace.setAnalyzeAvailable(true)
    expect(primary.textContent).toBe('分析地形')
    expect(workspace.el.querySelector('.ui-planner-primary').classList.contains('has-route')).toBe(true)
    primary.click()
    expect(onPrimary).toHaveBeenLastCalledWith({ stage: 'plan', analyzeAvailable: true })

    workspace.setStage('analyze')
    expect(primary.textContent).toBe('返回规划')
    primary.click()
    expect(onPrimary).toHaveBeenLastCalledWith({ stage: 'analyze', analyzeAvailable: true })
  })
})
