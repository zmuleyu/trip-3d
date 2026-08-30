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

  it('keeps More history controls on the same action seam and reflects availability', () => {
    const onMoreAction = vi.fn()
    const workspace = createPlannerWorkspace({ onMoreAction })
    workspace.setHistoryState({ canUndo: true, canRedo: false })
    const undo = workspace.el.querySelector('[data-more-action="undo"]')
    const redo = workspace.el.querySelector('[data-more-action="redo"]')
    expect(undo.disabled).toBe(false)
    expect(redo.disabled).toBe(true)
    expect(undo.textContent).toContain('Ctrl/⌘ Z')
    expect(redo.textContent).toContain('Ctrl/⌘ ⇧ Z')
    undo.click()
    expect(onMoreAction).toHaveBeenCalledWith('undo')
  })

  it('keeps local save state visible from More when the route summary is absent', () => {
    const workspace = createPlannerWorkspace()
    workspace.updateTrip({ name: '川西线路', saveStatus: 'dirty' })
    const saveStatus = workspace.el.querySelector('[data-more-save-status]')
    expect(saveStatus.hidden).toBe(false)
    expect(saveStatus.textContent).toBe('未保存更改')
    workspace.updateTrip({ name: '川西线路', saveStatus: 'saved' })
    expect(saveStatus.textContent).toBe('已保存到本机')
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
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-label')).toBe('打开图层工具')

    workspace.setLayersOpen(true)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const lowerPointerHandler = vi.fn()
    const lowerClickHandler = vi.fn()
    document.addEventListener('pointerdown', lowerPointerHandler)
    document.addEventListener('click', lowerClickHandler)
    const down = new Event('pointerdown', { bubbles: true, cancelable: true })
    Object.defineProperty(down, 'pointerId', { value: 7 })
    outside.dispatchEvent(down)
    expect(document.body.classList.contains('planner-layers-open')).toBe(false)
    expect(down.defaultPrevented).toBe(true)
    expect(lowerPointerHandler).not.toHaveBeenCalled()
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    outside.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(lowerClickHandler).not.toHaveBeenCalled()

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

  it('offers explicit waypoint operations with keyboard-safe inline rename', () => {
    const onWaypointAction = vi.fn()
    const workspace = createPlannerWorkspace({ onWaypointAction })
    document.body.appendChild(workspace.el)
    const route = { waypoints: [
      { id: 'a', name: '起点', lon: 102.1, lat: 31.1 },
      { id: 'b', name: '营地', lon: 102.2, lat: 31.2 },
      { id: 'c', name: '终点', lon: 102.3, lat: 31.3 },
    ] }
    workspace.setJourneySpine({ route, selection: { kind: 'waypoint', waypointId: 'b' } })
    const actions = workspace.el.querySelector('.ui-waypoint-actions')
    expect(actions?.textContent).toContain('途经点操作')
    expect(workspace.el.querySelector('.ui-trip-spine').classList.contains('waypoint-selected')).toBe(true)
    expect(workspace.el.querySelector('.ui-trip-spine-title').getAttribute('aria-label')).toBe('查看地点详情')
    expect(workspace.el.querySelector('.ui-trip-spine-day > b')).toBeNull()
    expect(workspace.el.querySelector('.ui-trip-spine-day > small')).toBeNull()
    const rename = [...actions.querySelectorAll('button')].find((button) => button.textContent === '重命名')
    rename.click()
    const input = actions.querySelector('input')
    expect(document.activeElement).toBe(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(rename)
    rename.click()
    input.value = '新营地'
    actions.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(onWaypointAction).toHaveBeenCalledWith({ action: 'rename', waypointId: 'b', name: '新营地' })
    expect(workspace.focusWaypointAction('rename')).toBe(true)
    expect(document.activeElement).toBe(rename)
    ;[...actions.querySelectorAll('button')].find((button) => button.textContent === '在后方插入').click()
    ;[...actions.querySelectorAll('button')].find((button) => button.textContent === '删除').click()
    expect(onWaypointAction).toHaveBeenCalledWith({ action: 'insert-after', waypointId: 'b' })
    expect(onWaypointAction).toHaveBeenCalledWith({ action: 'remove', waypointId: 'b' })
  })

  it('routes layout reset through the shared utility menu', () => {
    const onMoreAction = vi.fn()
    const workspace = createPlannerWorkspace({ onMoreAction })
    workspace.el.querySelector('[data-more-action="reset-layout"]').click()
    expect(onMoreAction).toHaveBeenCalledWith('reset-layout')
  })

  it('names the Plan continuation as re-analysis when geometry made analysis stale', () => {
    const workspace = createPlannerWorkspace()
    workspace.setAnalyzeAvailable(true)
    workspace.setAnalysisFreshness({ stale: true })
    const analyze = workspace.el.querySelector('[data-stage="analyze"]')
    expect(analyze.textContent).toBe('重新分析')
    expect(analyze.getAttribute('aria-label')).toContain('路线已变更')
  })

  it('keeps fresh available Analyze copy actionable and reserves the missing-route copy for disabled state', () => {
    const workspace = createPlannerWorkspace()
    const analyze = workspace.el.querySelector('[data-stage="analyze"]')
    workspace.setAnalyzeAvailable(true)
    workspace.setAnalysisFreshness({ stale: false })
    expect(analyze.textContent).toBe('分析')
    expect(analyze.getAttribute('aria-label')).toBe('分析当前路线地形')
    workspace.setAnalyzeAvailable(false, '至少添加起点和终点')
    expect(analyze.getAttribute('aria-label')).toContain('至少添加起点和终点')
  })
})
