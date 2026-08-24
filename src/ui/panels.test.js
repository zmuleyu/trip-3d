// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createLibraryPanel, createPlanningPanel } from './panels.js'

describe('planning panel route contract', () => {
  it('uses an explicit straight/foot/car mode control', () => {
    const onRouteMode = vi.fn()
    const panel = createPlanningPanel({ onRouteMode })
    const buttons = [...panel.el.querySelectorAll('.pp-route-mode button')]
    expect(buttons.map((b) => b.dataset.mode)).toEqual(['straight', 'foot', 'car'])
    buttons[2].click()
    expect(onRouteMode).toHaveBeenCalledWith('car')
  })

  it('keeps one command-bar search instead of duplicating search in the drawer', () => {
    const panel = createPlanningPanel({})
    const names = [...panel.el.querySelectorAll('input[type="text"], input:not([type])')].map((input) => input.getAttribute('aria-label'))
    expect(names).toEqual(expect.arrayContaining(['高德分享链接', '线路名称']))
    expect(names).not.toContain('搜索地点')
    expect(panel.el.querySelector('.pp-search')).toBeNull()
    expect(names.every(Boolean)).toBe(true)
  })

  it('does not show the old driving heuristic for a straight route', () => {
    const panel = createPlanningPanel({})
    const route = {
      name: '直线示意', mode: 'straight', dayEnds: [],
      waypoints: [{ id: 'a', name: 'A', lon: 1, lat: 2, ele: 10 }, { id: 'b', name: 'B', lon: 2, lat: 3, ele: 20 }],
    }
    panel.update(route, { distanceM: 6100, ascentM: 10, descentM: 0, maxEle: 20, driveMinutes: 10 }, [
      { from: 'A', to: 'B', distanceM: 6100, driveMinutes: 10, real: false },
    ])
    expect(panel.el.textContent).toContain('直线示意不估时')
    expect(panel.el.querySelector('.pp-plan-summary').textContent).toContain('直线示意不估时 —')
  })

  it('keeps distance but omits DEM-derived elevation fields while coverage is blocked', () => {
    const panel = createPlanningPanel({})
    const route = {
      name: '超覆盖', mode: 'straight', dayEnds: [],
      waypoints: [{ id: 'a', name: 'A', lon: 1, lat: 2, ele: 10 }, { id: 'b', name: 'B', lon: 2, lat: 3, ele: 20 }],
    }
    panel.update(route, { distanceM: 57700, ascentM: null, descentM: null, maxEle: null }, [
      { from: 'A', to: 'B', distanceM: 57700, real: false },
    ])
    expect(panel.el.textContent).toContain('57.7 km')
    expect(panel.el.textContent).not.toContain('nullm')
  })
})

describe('route library recovery', () => {
  it('offers a direct planning action when the local library is empty', () => {
    const onPlan = vi.fn()
    const panel = createLibraryPanel({ onPlan })
    panel.setItems([])
    const empty = panel.el.querySelector('.ui-empty')
    expect(empty.textContent).toContain('线路库为空')
    empty.querySelector('button').click()
    expect(onPlan).toHaveBeenCalledOnce()
  })
})
