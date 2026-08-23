// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOverviewMap } from './overviewMap.js'

const ctx = {
  clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillText: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn(), setTransform: vi.fn(), save: vi.fn(), restore: vi.fn(),
  set fillStyle(_) {}, set strokeStyle(_) {}, set lineWidth(_) {}, set lineJoin(_) {}, set lineCap(_) {}, set font(_) {}, set textAlign(_) {}, set textBaseline(_) {},
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

describe('overview map planner mode', () => {
  it('stays visible without a route and sends clicks to 2D waypoint planning', () => {
    const onPlanAdd = vi.fn()
    const onJump = vi.fn()
    const map = createOverviewMap({ onPlanAdd, onJump })
    document.body.appendChild(map.el)
    const canvas = map.el.querySelector('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150, x: 0, y: 0, toJSON() {} })
    map.setPlannerMode(true)
    map.update({ waypoints: [] }, null, { minLon: 112.9, minLat: 41.1, maxLon: 113.5, maxLat: 41.7 })
    expect(map.el.classList.contains('planner')).toBe(true)
    expect(map.el.classList.contains('hidden')).toBe(false)
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 75, button: 0, bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 100, clientY: 75, button: 0, bubbles: true }))
    expect(onPlanAdd).toHaveBeenCalledOnce()
    expect(onJump).not.toHaveBeenCalled()
  })

  it('resizes its canvas to the planner surface', () => {
    const map = createOverviewMap()
    map.el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 820, height: 560, right: 820, bottom: 560, x: 0, y: 0, toJSON() {} })
    map.resize()
    const canvas = map.el.querySelector('canvas')
    expect(canvas.width).toBe(820)
    expect(canvas.height).toBe(560)
  })

  it('provides familiar map controls, route-aware copy, and zoom state', () => {
    const map = createOverviewMap()
    document.body.appendChild(map.el)
    map.el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 820, height: 560, right: 820, bottom: 560, x: 0, y: 0, toJSON() {} })
    map.setPlannerMode(true)
    map.resize()
    map.update({ waypoints: [] }, null, { minLon: 112.9, minLat: 41.1, maxLon: 113.5, maxLat: 41.7 })
    expect(map.el.querySelector('.ui-map-empty').classList.contains('hidden')).toBe(false)
    expect(map.el.querySelector('.ui-map-context').textContent).toContain('在虚线范围内设置起点')
    const before = map.view.z
    map.el.querySelector('[aria-label="放大地图"]').click()
    expect(map.view.z).toBe(before + 1)
    map.update({ waypoints: [{ lon: 113, lat: 41.2 }, { lon: 113.2, lat: 41.4 }] }, null, { minLon: 112.9, minLat: 41.1, maxLon: 113.5, maxLat: 41.7 })
    expect(map.el.querySelector('.ui-map-empty').classList.contains('hidden')).toBe(true)
    expect(map.el.querySelector('.ui-map-fit span').textContent).toBe('完整路线')
  })
})
