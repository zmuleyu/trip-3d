import { describe, expect, it } from 'vitest'
import { routeProviderStatus } from './routeStatus.js'

describe('route provider status', () => {
  it('uses a plain calculating, available, and straight-line fallback contract', () => {
    expect(routeProviderStatus({ state: 'calculating' })).toContain('OSM/FOSSGIS 公共路由')
    expect(routeProviderStatus({ routed: 2, total: 2 })).toBe('OSM/FOSSGIS 公共路由 · 路网覆盖 2/2 段')
    expect(routeProviderStatus({ routed: 1, total: 2 })).toContain('部分路段为直线示意 · 无时长')
    expect(routeProviderStatus({ state: 'unavailable' })).toBe('公共路由暂不可用 · 当前为直线示意 · 无时长')
  })
})
