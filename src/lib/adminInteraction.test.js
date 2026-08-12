import { describe, it, expect } from 'vitest'
import { ADMIN_LEVELS, filterAdminRings, adminBreadcrumb, adminEmptyMessage, adminNeedsReload, findDeepestAdminRegion, createAdminInteractionState } from './adminInteraction.js'

const rings = [
  { level: 'province', name: '内蒙古自治区' },
  { level: 'city', name: '乌兰察布市' },
  { level: 'district', name: '察哈尔右翼后旗' },
]

describe('admin interaction model', () => {
  it('filters explicit levels and keeps all rings in auto mode', () => {
    expect(filterAdminRings(rings, ADMIN_LEVELS.AUTO)).toHaveLength(3)
    expect(filterAdminRings(rings, ADMIN_LEVELS.PROVINCE).map((r) => r.name)).toEqual(['内蒙古自治区'])
    expect(filterAdminRings(rings, ADMIN_LEVELS.CITY).map((r) => r.name)).toEqual(['乌兰察布市'])
    expect(filterAdminRings(rings, ADMIN_LEVELS.DISTRICT).map((r) => r.name)).toEqual(['察哈尔右翼后旗'])
  })

  it('builds a deduplicated province-city-district breadcrumb', () => {
    expect(adminBreadcrumb({ province: '内蒙古自治区', city: '乌兰察布市', district: '察哈尔右翼后旗' }))
      .toEqual(['内蒙古自治区', '乌兰察布市', '察哈尔右翼后旗'])
    expect(adminBreadcrumb({ province: '北京市', city: '北京市', district: '海淀区' }))
      .toEqual(['北京市', '海淀区'])
  })

  it('explains a zero-segment viewport with the deepest known area', () => {
    expect(adminEmptyMessage(['内蒙古自治区', '乌兰察布市', '察哈尔右翼后旗']))
      .toContain('当前视图完全位于察哈尔右翼后旗内')
    expect(adminEmptyMessage([])).toContain('当前视图未穿过行政边界')
  })

  it('enters inspect mode only while enabled and Escape exits it', () => {
    const state = createAdminInteractionState()
    expect(state.enterInspect()).toBe(false)
    state.setEnabled(true)
    expect(state.enterInspect()).toBe(true)
    expect(state.inspecting).toBe(true)
    expect(state.handleKey('Escape')).toBe(true)
    expect(state.inspecting).toBe(false)
  })

  it('turning the layer off clears inspect and selection state', () => {
    const state = createAdminInteractionState()
    state.setEnabled(true)
    state.enterInspect()
    state.select({ name: '察哈尔右翼后旗' })
    state.setEnabled(false)
    expect(state.inspecting).toBe(false)
    expect(state.selected).toBe(null)
  })

  it('picks the deepest containing administrative region', () => {
    const square = (size) => [[-size, -size], [size, -size], [size, size], [-size, size], [-size, -size]]
    const regions = [
      { level: 'province', name: '省', ring: square(3) },
      { level: 'city', name: '市', ring: square(2) },
      { level: 'district', name: '县', ring: square(1) },
    ]
    expect(findDeepestAdminRegion(regions, 0, 0)?.name).toBe('县')
    expect(findDeepestAdminRegion(regions, 1.5, 0)?.name).toBe('市')
    expect(findDeepestAdminRegion(regions, 4, 0)).toBe(null)
  })

  it('reloads an enabled layer after the terrain key changes', () => {
    expect(adminNeedsReload({ enabled: true, loadedKey: 'a', currentKey: 'b' })).toBe(true)
    expect(adminNeedsReload({ enabled: true, loadedKey: 'a', currentKey: 'a' })).toBe(false)
    expect(adminNeedsReload({ enabled: false, loadedKey: 'a', currentKey: 'b' })).toBe(false)
  })
})
