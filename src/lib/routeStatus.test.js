import { describe, expect, it } from 'vitest'
import { routeProviderStatus } from './routeStatus.js'

describe('route provider status', () => {
  it('uses a plain calculating, available, and straight-line fallback contract', () => {
    expect(routeProviderStatus({ state: 'calculating' })).toBe('正在计算路线…')
    expect(routeProviderStatus({ routed: 2, total: 2 })).toBe('路线可用：路网覆盖 2/2 段')
    expect(routeProviderStatus({ routed: 1, total: 2 })).toContain('当前为直线示意，无时长')
    expect(routeProviderStatus({ state: 'unavailable' })).toContain('可切换“直线”继续或稍后重试')
  })
})
