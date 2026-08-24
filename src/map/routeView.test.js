import { describe, expect, it } from 'vitest'
import { ROUTE_VIEW_NEUTRAL_BEARING, routeCameraBearing } from './routeView.js'

describe('routeCameraBearing', () => {
  it('uses a stable neutral orientation for empty, one-point, and degenerate routes', () => {
    expect(routeCameraBearing([])).toBe(ROUTE_VIEW_NEUTRAL_BEARING)
    expect(routeCameraBearing([[113, 41]])).toBe(ROUTE_VIEW_NEUTRAL_BEARING)
    expect(routeCameraBearing([[113, 41], [113, 41], [113, 41]])).toBe(ROUTE_VIEW_NEUTRAL_BEARING)
  })

  it('orients a normal route from its first valid segment toward the horizon', () => {
    expect(routeCameraBearing([[113, 41], [113, 42]])).toBeCloseTo(0, 8)
    expect(routeCameraBearing([[113, 41], [114, 41]])).toBeCloseTo(-90, 8)
  })

  it('uses the shortest longitude path across the antimeridian without changing route coordinates', () => {
    const route = [[179.8, 12], [-179.8, 12]]
    expect(routeCameraBearing(route)).toBeCloseTo(-90, 6)
    expect(route).toEqual([[179.8, 12], [-179.8, 12]])
  })
})
