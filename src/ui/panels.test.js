// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createLibraryPanel, createPlanningPanel, createProfileCard } from './panels.js'

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

  it('orders naming, point sequence, disclosed editing, and one save action', () => {
    const panel = createPlanningPanel({})
    const text = panel.el.textContent
    expect(text.indexOf('命名')).toBeLessThan(text.indexOf('加点'))
    expect(text.indexOf('加点')).toBeLessThan(text.indexOf('编辑与导入'))
    expect(text).toContain('保存线路')
    expect(panel.el.querySelector('.pp-journey-list')).toBeNull()
    expect(panel.el.querySelector('.pp-plan')).toBeNull()
  })

  it('keeps live waypoints without a duplicated route summary', () => {
    const panel = createPlanningPanel({})
    const route = {
      name: '直线示意', mode: 'straight', dayEnds: [],
      waypoints: [{ id: 'a', name: 'A', lon: 1, lat: 2, ele: 10 }, { id: 'b', name: 'B', lon: 2, lat: 3, ele: 20 }],
    }
    panel.update(route, { distanceM: 6100, ascentM: 10, descentM: 0, maxEle: 20, driveMinutes: 10 }, [
      { from: 'A', to: 'B', distanceM: 6100, driveMinutes: 10, real: false },
    ])
    expect(panel.el.textContent).toContain('起点')
    expect(panel.el.textContent).toContain('终点')
    expect(panel.el.textContent).toContain('增加途经点')
    expect(panel.el.querySelector('.pp-plan-summary')).toBeNull()
  })

  it('does not render an elevation card in the planning inspector', () => {
    const panel = createPlanningPanel({})
    const route = {
      name: '超覆盖', mode: 'straight', dayEnds: [],
      waypoints: [{ id: 'a', name: 'A', lon: 1, lat: 2, ele: 10 }, { id: 'b', name: 'B', lon: 2, lat: 3, ele: 20 }],
    }
    panel.update(route, { distanceM: 57700, ascentM: null, descentM: null, maxEle: null }, [
      { from: 'A', to: 'B', distanceM: 57700, real: false },
    ])
    expect(panel.el.querySelector('.pp-plan')).toBeNull()
    expect(panel.el.querySelector('.ui-profile')).toBeNull()
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

  it('distinguishes an unsaved current route from an empty saved library', () => {
    const onSaveCurrent = vi.fn()
    const panel = createLibraryPanel({
      getCurrent: () => ({ name: '双桥沟草稿', waypoints: [{}, {}] }),
      onSaveCurrent,
    })
    panel.setItems([])
    const empty = panel.el.querySelector('.ui-empty')
    expect(empty.textContent).toContain('尚未保存到本机路线库')
    const save = [...empty.querySelectorAll('button')].find((button) => button.textContent === '保存当前路线')
    save.click()
    expect(onSaveCurrent).toHaveBeenCalledOnce()
  })
})

describe('Analyze elevation profile', () => {
  const canvasContext = () => ({
    beginPath: vi.fn(), clearRect: vi.fn(), fillText: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), stroke: vi.fn(),
  })

  it('shows raw DEM range only in Analyze and supports keyboard-native folding', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const card = createProfileCard()
    const analysis = {
      status: 'ready',
      points: [
        { ele: 1180, cumDistM: 0 },
        { ele: 1360, cumDistM: 4200 },
      ],
      profile: { distanceM: 4200, minElevationM: 1180, maxElevationM: 1360 },
      stats: { distanceM: 4200, minEle: 1180, maxEle: 1360 },
    }

    card.update(analysis)
    expect(card.el.classList.contains('hidden')).toBe(true)
    card.setStage('analyze')
    expect(card.el.classList.contains('hidden')).toBe(false)
    expect(card.el.textContent).toContain('最低 1,180 m')
    expect(card.el.textContent).toContain('最高 1,360 m')
    expect(card.el.textContent).toContain('Terrarium')

    const toggle = card.el.querySelector('.head')
    expect(toggle.tagName).toBe('BUTTON')
    toggle.click()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(card.el.classList.contains('folded')).toBe(true)

    card.setStage('plan')
    expect(card.el.classList.contains('hidden')).toBe(true)
  })

  it.each([
    ['dem-unavailable', '高程数据暂不可用'],
    ['outside-coverage', '扩展地形范围后重试'],
    ['incomplete', '至少添加起点和终点'],
  ])('renders a truthful %s state without zero or inferred values', (status, message) => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const card = createProfileCard()
    card.setStage('analyze')
    card.update({ status, points: [], profile: null, stats: null })

    expect(card.el.classList.contains('hidden')).toBe(false)
    expect(card.el.dataset.status).toBe(status)
    expect(card.el.textContent).toContain(message)
    expect(card.el.textContent).not.toContain('0 m')
  })
})
