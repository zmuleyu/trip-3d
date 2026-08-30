// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createRouteOverview } from './routeOverview.js'

const segment = {
  index: 1,
  selection: { kind: 'segment', fromId: 'b', toId: 'c' },
  from: { name: '山口' }, to: { name: '出口' }, distanceM: 2100, elevationDeltaM: -360,
}

describe('Route Overview inspector', () => {
  it('keeps fact rows semantic and sends selection to the A2 owner', () => {
    const onSelect = vi.fn()
    const overview = createRouteOverview({ onSelect })
    overview.update({ ready: true, selected: null, longest: segment, elevation: segment, availability: '高程与坡度可用；路线时长不可用；3D 分析可用' })
    const rows = overview.el.querySelectorAll('button.route-overview-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('第 2 段 · 山口 → 出口')
    rows[0].click()
    expect(onSelect).toHaveBeenCalledWith(segment.selection)
    expect(overview.el.textContent).toContain('选择地图或剖面中的路段查看详情')

    overview.update({ ready: true, selected: segment, longest: segment, elevation: segment, availability: '高程与坡度可用；路线时长不可用；3D 分析可用' })
    expect(overview.el.querySelector('.route-overview-selection').textContent).toContain('第 2 段 · 山口 → 出口')
    expect(overview.el.querySelector('button.route-overview-row').classList.contains('is-selected')).toBe(true)
  })

  it('removes facts for resilience recovery states', () => {
    const overview = createRouteOverview()
    overview.update({ ready: false, message: '路线分析已过期。恢复操作在高程剖面中。' })
    expect(overview.el.querySelectorAll('.route-overview-row')).toHaveLength(0)
    expect(overview.el.textContent).toContain('恢复操作在高程剖面中')
  })
})
