// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createPlannerWorkspace } from './plannerWorkspace.js'

describe('planner workspace chrome', () => {
  it('shows the application version beside the product identity', () => {
    const workspace = createPlannerWorkspace({ version: '0.4.1' })
    expect(workspace.el.querySelector('.ui-planner-version').textContent).toBe('v0.4.1')
    expect(workspace.el.querySelector('.ui-planner-version').hidden).toBe(false)
  })

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

  it('supports standard arrow-key navigation for the Plan and Analyze tabs', () => {
    const onStage = vi.fn()
    const workspace = createPlannerWorkspace({ onStage })
    document.body.appendChild(workspace.el)
    workspace.setAnalyzeAvailable(true)
    const plan = workspace.el.querySelector('[data-stage="plan"]')
    plan.focus()
    plan.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(workspace.el.querySelector('[data-stage="analyze"]'))
    expect(workspace.stage).toBe('analyze')
    expect(onStage).toHaveBeenCalledWith('analyze')
  })

  it('keeps route-coverage internals out of the workspace chrome', () => {
    const workspace = createPlannerWorkspace()
    workspace.setCoverage({ covered: false, outsideCount: 18, total: 240 })
    expect(workspace.el.querySelector('.ui-route-coverage')).toBeNull()
  })

  it('keeps layers and global actions out of the top bar for the shared map dock', () => {
    const workspace = createPlannerWorkspace()
    document.body.appendChild(workspace.el)
    expect(workspace.el.querySelector('.ui-planner-layer-toggle')).toBeNull()
    expect(workspace.el.querySelector('.ui-planner-action-island')).toBeNull()
    expect(workspace.el.querySelector('.ui-planner-primary')).toBeNull()
    workspace.setLayersOpen(true)
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

    search.querySelector('input').value = ''
    search.querySelector('button').click()
    expect(document.activeElement).toBe(search.querySelector('input'))

    workspace.toggleMore()
    expect(workspace.el.querySelector('.ui-planner-more-menu').classList.contains('hidden')).toBe(false)
    workspace.el.querySelector('[data-more-action="settings"]').click()
    expect(onMoreAction).toHaveBeenCalledWith('settings')
  })

  it('keeps search results and one-copy place selection anchored to the command surface', () => {
    const onSearchSelect = vi.fn()
    const onSearchRole = vi.fn()
    const onSearchDismiss = vi.fn()
    const workspace = createPlannerWorkspace({ onSearchSelect, onSearchRole, onSearchDismiss })
    document.body.appendChild(workspace.el)
    const place = { name: '人民公园', context: '成都市 · 青羊区 · 四川省', category: '公园' }
    workspace.setSearchSession({ state: 'results', results: [place], message: '找到 1 个地点' })
    const input = workspace.el.querySelector('.ui-command-search input')
    expect(input.getAttribute('aria-expanded')).toBe('true')
    workspace.el.querySelector('.ui-search-result').click()
    expect(onSearchSelect).toHaveBeenCalledWith(place)

    workspace.setSearchSession({ state: 'place-selection', selected: place })
    const popover = workspace.el.querySelector('.ui-search-popover')
    expect(popover.textContent.match(/人民公园/g)).toHaveLength(1)
    expect(popover.textContent.match(/成都市/g)).toHaveLength(1)
    popover.querySelector('.ui-search-place-actions button').click()
    expect(onSearchRole).toHaveBeenCalledWith('start')
    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onSearchDismiss).toHaveBeenCalledWith({ restoreFocus: true })
  })

  it('keeps secondary destinations discoverable inside the overflow menu', () => {
    const onMoreAction = vi.fn()
    const workspace = createPlannerWorkspace({ onMoreAction })
    for (const action of ['save', 'share', 'import', 'export', 'admin', 'settings', 'help', 'reset-layout']) {
      expect(workspace.el.querySelector(`[data-more-action="${action}"]`)).not.toBeNull()
    }
    workspace.el.querySelector('[data-more-action="admin"]').click()
    expect(onMoreAction).toHaveBeenCalledWith('admin')
  })

  it('keeps global actions and layers mutually exclusive', () => {
    const onMenuChange = vi.fn()
    const workspace = createPlannerWorkspace({ onMenuChange })
    workspace.setLayersOpen(true)
    expect(document.body.classList.contains('planner-layers-open')).toBe(true)
    workspace.setMoreOpen(true)
    expect(document.body.classList.contains('planner-layers-open')).toBe(false)
    expect(workspace.moreOpen).toBe(true)
    expect(onMenuChange).toHaveBeenLastCalledWith('more', true)
  })

  it('closes an attached layers surface on Escape, outside press, and stage changes', () => {
    const workspace = createPlannerWorkspace()
    const trigger = document.createElement('button')
    const surface = document.createElement('section')
    surface.id = 'ui-layer-tools'
    document.body.append(trigger, surface)
    workspace.attachLayers({ trigger, surface })
    workspace.setLayersOpen(true)
    expect(trigger.getAttribute('aria-controls')).toBe(surface.id)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.body.classList.contains('planner-layers-open')).toBe(false)
    expect(document.activeElement).toBe(trigger)

    workspace.setLayersOpen(true)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(document.body.classList.contains('planner-layers-open')).toBe(false)

    workspace.setLayersOpen(true)
    workspace.setStage('plan')
    expect(document.body.classList.contains('planner-layers-open')).toBe(false)
  })

  it('shows route context only for a selected waypoint or segment and can dismiss it', () => {
    const onSpineExpand = vi.fn()
    const onSpineDismiss = vi.fn()
    const workspace = createPlannerWorkspace({ onSpineExpand, onSpineDismiss })
    document.body.appendChild(workspace.el)
    const route = {
      waypoints: [
        { id: 'a', name: '起点', lon: 102.1, lat: 31.1 },
        { id: 'b', name: '盆景滩', lon: 102.2, lat: 31.2 },
        { id: 'c', name: '终点', lon: 102.3, lat: 31.3 },
      ],
    }
    workspace.setJourneySpine({ route, legs: [{ distanceM: 4800 }, { distanceM: 3200 }] })
    expect(workspace.el.querySelector('.ui-trip-spine').classList.contains('hidden')).toBe(true)

    workspace.setJourneySpine({
      route,
      legs: [{ distanceM: 4800 }, { distanceM: 3200 }],
      selection: { kind: 'segment', fromId: 'b', toId: 'c' },
    })
    const days = workspace.el.querySelectorAll('.ui-trip-spine-day')
    expect(days).toHaveLength(1)
    expect(days[0].textContent).toContain('盆景滩 → 终点')
    expect(days[0].textContent).toContain('3.2 km')
    workspace.el.querySelector('.ui-trip-spine-title').click()
    expect(onSpineExpand).toHaveBeenCalledOnce()
    workspace.el.querySelector('.ui-trip-spine-close').click()
    expect(onSpineDismiss).toHaveBeenCalledOnce()
  })

  it('routes layout reset through the shared utility menu', () => {
    const onMoreAction = vi.fn()
    const workspace = createPlannerWorkspace({ onMoreAction })
    workspace.el.querySelector('[data-more-action="reset-layout"]').click()
    expect(onMoreAction).toHaveBeenCalledWith('reset-layout')
  })
})
