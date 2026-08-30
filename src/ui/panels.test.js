// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createLibraryPanel, createPlanningPanel, createProfileCard } from './panels.js'

describe('planning panel route contract', () => {
  it('shows two textual route choices only when alternatives are available', () => {
    const onRouteAlternative = vi.fn()
    const panel = createPlanningPanel({ onRouteAlternative })
    panel.setRouteAlternatives([
      { distanceM: 12000, durationS: 1800 },
      { distanceM: 14000, durationS: 2100 },
    ], 1)
    const choices = [...panel.el.querySelectorAll('.pp-route-alternative')]
    expect(choices).toHaveLength(2)
    expect(choices[1].textContent).toContain('方案 2（当前）')
    expect(choices[1].textContent).toContain('14.0 km')
    choices[0].click()
    expect(onRouteAlternative).toHaveBeenCalledWith(0)
    panel.setRouteAlternatives([{ distanceM: 12000, durationS: 1800 }])
    expect(panel.el.querySelector('.pp-route-alternatives').classList.contains('hidden')).toBe(true)
  })
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

  it('keeps waypoint elevation truthful while background enrichment loads, fails, and recovers', () => {
    const panel = createPlanningPanel({})
    const route = {
      name: '异步高程', mode: 'straight', dayEnds: [],
      waypoints: [{ id: 'a', name: 'A', lon: 1, lat: 2, ele: 0 }, { id: 'b', name: 'B', lon: 2, lat: 3, ele: 0 }],
    }
    const update = (waypointElevation) => panel.update(route, { distanceM: 6100 }, null, null, 'foot', null, waypointElevation)

    update({ status: 'loading', values: {} })
    expect(panel.el.textContent).toContain('高程待补齐')
    expect(panel.el.textContent).not.toContain('· 0m')

    update({ status: 'unavailable', values: {} })
    expect(panel.el.textContent).toContain('高程暂不可用')

    update({ status: 'ready', values: { a: 1180, b: 1360 } })
    expect(panel.el.textContent).toContain('1180m')
    expect(panel.el.textContent).toContain('1360m')
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
    arc: vi.fn(), beginPath: vi.fn(), clearRect: vi.fn(), fill: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), stroke: vi.fn(),
  })

  it('shows elevation range only in Analyze and supports keyboard-native folding', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const card = createProfileCard()
    const analysis = {
      status: 'ready',
      points: [
        { lon: 100, lat: 30, ele: 1180, cumDistM: 0 },
        { lon: 101, lat: 31, ele: 1360, cumDistM: 4200 },
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
    expect(card.el.textContent).toContain('坡度不可用：有效水平距离或高程覆盖不足')

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
    ['outside-coverage', '路线地形尚未补齐'],
    ['route-terrain-loading', '正在准备路线分析'],
    ['route-terrain-unavailable', '路线地形暂不可用'],
    ['route-terrain-budget', '路线较长，暂时无法补齐完整地形'],
    ['route-terrain-cancelled', '路线已变化，地形补齐已取消'],
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
    expect(card.el.querySelector('canvas').getAttribute('role')).toBeNull()
    expect(card.el.querySelector('.profile-details-toggle').hidden).toBe(true)
    expect(card.el.querySelector('.profile-details').hidden).toBe(true)
  })

  it('offers retry and return-to-Plan only for recoverable corridor states without technical counts', () => {
    const onRetry = vi.fn()
    const onReturnPlan = vi.fn()
    const card = createProfileCard()
    card.setStage('analyze')
    card.setCallbacks({ onRetry, onReturnPlan })

    const recovery = card.el.querySelector('.profile-recovery')
    const returnPlan = card.el.querySelector('.profile-return-plan')
    for (const status of ['dem-unavailable', 'outside-coverage', 'route-terrain-unavailable', 'route-terrain-budget', 'route-terrain-cancelled']) {
      card.update({ status, points: [], profile: null })
      expect(recovery.hidden).toBe(false)
      expect(returnPlan.hidden).toBe(false)
      expect(card.el.textContent).not.toMatch(/\b(?:DEM|tile|tiles|window)\b/i)
      expect(card.el.textContent).not.toMatch(/\d+\s*(?:个|块)/)
    }
    recovery.click()
    returnPlan.click()
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onReturnPlan).toHaveBeenCalledOnce()

    for (const status of ['incomplete', 'route-terrain-loading']) {
      card.update({ status, points: [], profile: null })
      expect(recovery.hidden).toBe(true)
      expect(returnPlan.hidden).toBe(true)
    }
  })

  it('uses a finite first-point cursor and fixed endpoint x for a zero-length profile', () => {
    const ctx = canvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    const onCursorDistance = vi.fn()
    const card = createProfileCard()
    const analysis = {
      status: 'ready',
      points: [
        { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
        { lon: 100, lat: 30, ele: 1100, cumDistM: 0 },
      ],
      profile: { distanceM: 0, minElevationM: 1000, maxElevationM: 1100 },
    }
    card.update(analysis)
    card.setStage('analyze')
    card.setCallbacks({ onCursorDistance })
    card.setCursorDistance(0)
    const canvas = card.el.querySelector('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, width: 596 })

    expect(canvas.getAttribute('aria-valuenow')).toBe('0')
    expect(canvas.getAttribute('aria-valuetext')).toContain('0.0 km')
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 300 }))
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(onCursorDistance).toHaveBeenLastCalledWith(0)
    expect(ctx.moveTo).toHaveBeenCalledWith(12, expect.any(Number))
    expect(ctx.lineTo).toHaveBeenCalledWith(12, expect.any(Number))
    expect(() => card.setCursorDistance(0)).not.toThrow()
  })

  it('does not invent a cursor before the shared owner synchronizes one', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const card = createProfileCard()
    const analysis = {
      status: 'ready',
      points: [
        { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
        { lon: 101, lat: 30, ele: 1100, cumDistM: 1000 },
      ],
      profile: { distanceM: 1000, minElevationM: 1000, maxElevationM: 1100 },
    }
    card.update(analysis)
    card.setStage('analyze')
    const canvas = card.el.querySelector('canvas')
    expect(canvas.getAttribute('aria-valuenow')).toBeNull()
    card.setCursorDistance(0)
    expect(canvas.getAttribute('aria-valuenow')).toBe('0')
    expect(canvas.getAttribute('aria-valuetext')).toContain('0.0 km')
  })

  it('shares a focusable cursor through pointer, touch, and sampled keyboard steps', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const onCursorDistance = vi.fn()
    const card = createProfileCard()
    const analysis = {
      status: 'ready',
      points: [
        { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
        { lon: 101, lat: 30, ele: 1200, cumDistM: 1000 },
        { lon: 101, lat: 31, ele: 1400, cumDistM: 2000 },
      ],
      profile: { distanceM: 2000, minElevationM: 1000, maxElevationM: 1400 },
    }
    card.setStage('analyze')
    card.setCallbacks({ onCursorDistance })
    card.update(analysis)
    const canvas = card.el.querySelector('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, width: 596 })

    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 304 }))
    expect(onCursorDistance).toHaveBeenLastCalledWith(expect.closeTo(1021, 0))
    card.setCursorDistance(1000)
    expect(canvas.getAttribute('role')).toBe('slider')
    expect(canvas.getAttribute('aria-valuetext')).toContain('1.0 km')
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(onCursorDistance).toHaveBeenLastCalledWith(2000)
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(onCursorDistance).toHaveBeenLastCalledWith(0)

    const touchLeave = new Event('pointerleave')
    Object.defineProperty(touchLeave, 'pointerType', { value: 'touch' })
    canvas.dispatchEvent(touchLeave)
    expect(onCursorDistance).not.toHaveBeenLastCalledWith(null)
    canvas.dispatchEvent(new Event('pointerleave'))
    expect(onCursorDistance).toHaveBeenLastCalledWith(null)
  })

  it('locks and clears Analyze segment callbacks from the Profile without changing cursor ownership', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const onSegmentDistance = vi.fn()
    const onSegmentStep = vi.fn()
    const onSegmentClear = vi.fn()
    const card = createProfileCard()
    card.setStage('analyze')
    card.setCallbacks({ onSegmentDistance, onSegmentStep, onSegmentClear })
    card.update({ status: 'ready', points: [{ lon: 100, lat: 30, ele: 1000, cumDistM: 0 }, { lon: 101, lat: 30, ele: 1100, cumDistM: 1000 }, { lon: 102, lat: 30, ele: 1200, cumDistM: 2000 }], profile: { distanceM: 2000, minElevationM: 1000, maxElevationM: 1200 } })
    const canvas = card.el.querySelector('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, width: 596 })
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 304 }))
    expect(onSegmentDistance).toHaveBeenLastCalledWith(expect.closeTo(1021, 0))
    card.setCursorDistance(1000)
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSegmentDistance).toHaveBeenLastCalledWith(1000)
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(onSegmentStep).toHaveBeenLastCalledWith(1)
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onSegmentClear).toHaveBeenCalledOnce()
  })

  it('keeps aggregate grade metrics in a disclosed route-details layer', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const card = createProfileCard()
    const analysis = {
      status: 'ready',
      points: [
        { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
        { lon: 101, lat: 30, ele: 1100, cumDistM: 1000 },
        { lon: 102, lat: 30, ele: 1017, cumDistM: 2000 },
      ],
      profile: { distanceM: 2000, minElevationM: 1000, maxElevationM: 1100 },
      grade: {
        status: 'ready',
        metersPerPixel: 30,
        windowM: 200,
        averageAbsPct: 9.2,
        maxUphillPct: 10,
        maxDownhillPct: -8.3,
        samples: [
          { distanceM: 0, gradePct: 10 },
          { distanceM: 1000, gradePct: 10 },
          { distanceM: 2000, gradePct: -8.3 },
        ],
      },
    }

    card.update(analysis)
    card.setStage('analyze')
    card.setCursorDistance(1000)

    expect(card.el.textContent).toContain('平均绝对坡度 9.2%')
    expect(card.el.textContent).toContain('最大上坡 +10.0%')
    expect(card.el.textContent).toContain('最大下坡 −8.3%')
    expect(card.el.querySelector('.profile-details').hidden).toBe(true)
    expect(card.el.querySelector('.profile-details-toggle').getAttribute('aria-expanded')).toBe('false')
    card.el.querySelector('.profile-details-toggle').click()
    expect(card.el.querySelector('.profile-details').hidden).toBe(false)
    expect(card.el.querySelector('.profile-details-toggle').getAttribute('aria-expanded')).toBe('true')
    expect(card.el.textContent).not.toContain('DEM 30 m/像元')
    expect(card.el.querySelector('canvas').getAttribute('aria-valuetext')).toContain('上坡 +10.0%')
    card.setStage('plan')
    expect(card.el.classList.contains('hidden')).toBe(true)
  })

  it('clears and hides route details across unavailable states before restoring a folded ready layer', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const card = createProfileCard()
    const ready = {
      status: 'ready',
      points: [
        { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
        { lon: 101, lat: 30, ele: 1100, cumDistM: 1000 },
      ],
      profile: { distanceM: 1000, minElevationM: 1000, maxElevationM: 1100 },
      grade: { status: 'ready', averageAbsPct: 10, maxUphillPct: 10, maxDownhillPct: -5, samples: [] },
    }
    card.setStage('analyze')
    card.update(ready)
    card.el.querySelector('.profile-details-toggle').click()
    expect(card.el.querySelector('.profile-details').hidden).toBe(false)

    card.update({ status: 'dem-unavailable', points: [], profile: null })
    expect(card.el.querySelector('.profile-details-toggle').hidden).toBe(true)
    expect(card.el.querySelector('.profile-details-toggle').disabled).toBe(true)
    expect(card.el.querySelector('.profile-details').hidden).toBe(true)
    expect(card.el.querySelector('.profile-details').textContent).toBe('')

    card.update(ready)
    expect(card.el.querySelector('.profile-details-toggle').hidden).toBe(false)
    expect(card.el.querySelector('.profile-details-toggle').disabled).toBe(false)
    expect(card.el.querySelector('.profile-details').hidden).toBe(true)
    expect(card.el.querySelector('.profile-details-toggle').getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps the Analyze shell available while terrain falls back to 2D', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const onRetryTerrain = vi.fn(() => card.setTerrainState('ready'))
    const onReturnPlan = vi.fn()
    const card = createProfileCard()
    card.setCallbacks({ onRetryTerrain, onReturnPlan })
    card.setStage('analyze')
    card.setTerrainState('fallback')

    expect(card.el.dataset.terrainState).toBe('fallback')
    expect(card.el.textContent).toContain('正以 2D 保持路线')
    card.el.querySelector('.profile-terrain-actions button').click()
    expect(onRetryTerrain).toHaveBeenCalledOnce()
    expect(card.el.dataset.terrainState).toBe('ready')
    expect(card.el.querySelector('.profile-terrain-notice').hidden).toBe(true)

    card.setTerrainState('fallback')
    card.el.querySelector('.profile-terrain-actions button + button').click()
    expect(onReturnPlan).toHaveBeenCalledOnce()
  })

  it('keeps resilience loading, stale, failed, and fallback recovery inside Profile', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const onRetry = vi.fn()
    const onReturnPlan = vi.fn()
    const card = createProfileCard()
    const ready = {
      status: 'ready',
      points: [{ lon: 100, lat: 30, ele: 1000, cumDistM: 0 }, { lon: 101, lat: 30, ele: 1100, cumDistM: 1000 }],
      profile: { distanceM: 1000, minElevationM: 1000, maxElevationM: 1100 },
    }
    card.setStage('analyze')
    card.setCallbacks({ onRetry, onReturnPlan })

    card.setTerrainState('fallback')
    card.setResilience({ status: 'preparing' })
    card.update({ status: 'route-terrain-loading' })
    expect(card.el.textContent).toContain('正在准备路线分析')
    expect(card.el.querySelector('.profile-recovery:not(.profile-return-plan)').hidden).toBe(true)
    expect(card.el.querySelector('.profile-return-plan').hidden).toBe(false)
    expect(card.el.dataset.terrainState).toBe('fallback')
    expect(card.el.querySelector('.profile-terrain-notice').hidden).toBe(false)
    expect(card.el.querySelector('.profile-terrain-actions').hidden).toBe(false)

    card.setResilience({ status: 'stale' })
    card.update({ status: 'route-terrain-loading' })
    expect(card.el.textContent).toContain('路线已变化，需要重新分析')
    card.el.querySelector('.profile-recovery:not(.profile-return-plan)').click()
    expect(onRetry).toHaveBeenCalledOnce()

    card.setResilience({ status: 'failed', reason: 'outside-coverage' })
    card.update({ status: 'outside-coverage' })
    expect(card.el.textContent).toContain('路线地形尚未补齐')
    expect(card.el.querySelector('.profile-recovery:not(.profile-return-plan)').textContent).toBe('补齐路线地形')
    expect(card.el.textContent).not.toContain('检查网络')
    expect(card.el.textContent).not.toContain('DEM')

    card.setResilience({ status: 'failed', reason: 'route-terrain-budget' })
    card.update({ status: 'route-terrain-budget' })
    expect(card.el.textContent).toContain('路线较长，暂时无法补齐完整地形')
    expect(card.el.textContent).not.toContain('检查网络')

    card.setResilience({ status: 'failed', reason: 'route-terrain-cancelled' })
    card.update({ status: 'route-terrain-cancelled' })
    expect(card.el.textContent).toContain('路线已变化，分析已取消')

    card.setResilience({ status: 'fallback-ready' })
    card.update(ready)
    expect(card.el.querySelector('canvas').classList.contains('hidden')).toBe(false)
    expect(card.el.textContent).toContain('3D 地形暂不可用，正以 2D 保持路线')
    card.el.querySelector('.profile-return-plan').click()
    expect(onReturnPlan).toHaveBeenCalledOnce()
  })

  it('keeps an available elevation profile truthful when its grade is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const card = createProfileCard()
    card.setStage('analyze')
    card.update({
      status: 'ready',
      points: [
        { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
        { lon: 101, lat: 30, ele: 1010, cumDistM: 40 },
      ],
      profile: { distanceM: 40, minElevationM: 1000, maxElevationM: 1010 },
      grade: { status: 'insufficient-distance', samples: [] },
    })

    expect(card.el.textContent).toContain('最低 1,000 m')
    expect(card.el.textContent).toContain('坡度不可用：有效水平距离或高程覆盖不足')
    expect(card.el.textContent).not.toContain('平均绝对坡度')
  })

  it('offers Adjust this section only from an Analyze selected-segment detail layer', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const onAdjustSegment = vi.fn()
    const card = createProfileCard()
    card.setCallbacks({ onAdjustSegment })
    card.setStage('analyze')
    card.update({
      status: 'ready',
      points: [{ lon: 100, lat: 30, ele: 1000, cumDistM: 0 }, { lon: 101, lat: 30, ele: 1100, cumDistM: 1000 }],
      profile: { distanceM: 1000, minElevationM: 1000, maxElevationM: 1100 },
      grade: { status: 'insufficient-distance', samples: [] },
    })
    card.setSelectedSegment({ index: 0, from: { name: '甲' }, to: { name: '乙' }, startM: 0, endM: 1000 })
    card.el.querySelector('.profile-details-toggle').click()
    const adjust = card.el.querySelector('.profile-adjust-segment')
    expect(adjust).not.toBeNull()
    adjust.click()
    expect(onAdjustSegment).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }))
  })

  it('places a real before/current comparison after the selected segment metrics and announces completion', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext())
    const card = createProfileCard()
    card.setStage('analyze')
    card.update({
      status: 'ready',
      points: [{ lon: 100, lat: 30, ele: 1000, cumDistM: 0 }, { lon: 101, lat: 30, ele: 1100, cumDistM: 1000 }],
      profile: { distanceM: 1000, minElevationM: 1000, maxElevationM: 1100 },
    })
    card.setSelectedSegment({ index: 0, selection: { kind: 'segment', fromId: 'a', toId: 'b' }, from: { name: '甲' }, to: { name: '乙' }, startM: 0, endM: 1000 })
    card.setSegmentComparison({
      status: 'ready',
      before: { distanceM: 1000, elevationDeltaM: 100, netGradePct: 10, durationS: 600 },
      current: { distanceM: 1200, elevationDeltaM: 120, netGradePct: 10, durationS: null },
      change: { distanceM: 200, elevationDeltaM: 20, netGradePct: 0, durationS: null },
    })
    card.el.querySelector('.profile-details-toggle').click()

    const comparison = card.el.querySelector('.profile-segment-comparison')
    expect(comparison.textContent).toContain('调整前 / 当前 / 变化')
    expect(comparison.textContent).toContain('区间 · 1.0 km · 1.2 km · 增加 +0.2 km')
    expect(comparison.textContent).toContain('净坡度 · 10.0 % · 10.0 % · 无变化')
    expect(comparison.textContent).not.toContain('时长')
    expect(card.el.querySelector('.profile-comparison-live').textContent).toBe('调整前与当前已可比较。')
    expect(comparison.compareDocumentPosition(card.el.querySelector('.profile-adjust-segment')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    card.setSegmentComparison({
      status: 'ready',
      before: { distanceM: 1000, elevationDeltaM: 100, netGradePct: 10, durationS: 600 },
      current: { distanceM: 1004, elevationDeltaM: 100.4, netGradePct: 10.04, durationS: 604 },
      change: { distanceM: 4, elevationDeltaM: 0.4, netGradePct: 0.04, durationS: 4 },
    })
    const thresholdComparison = card.el.querySelector('.profile-segment-comparison').textContent
    expect(thresholdComparison).toContain('区间 · 1.0 km · 1.0 km · 增加 <0.1 km')
    expect(thresholdComparison).toContain('高程变化 · 100 m · 100 m · 增加 <1 m')
    expect(thresholdComparison).toContain('净坡度 · 10.0 % · 10.0 % · 增加 <0.1 %')
    expect(thresholdComparison).toContain('时长 · 10 分钟 · 10 分钟 · 增加 <1 分钟')
  })
})
