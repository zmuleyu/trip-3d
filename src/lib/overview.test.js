import { describe, it, expect } from 'vitest'
import { lonLatToTileXY, tileXYToLonLat, pickOverviewView, projectToView, viewFromPoints } from './overview.js'

describe('slippy tile math', () => {
  it('lonLatToTileXY: known values (Beijing z12)', () => {
    const t = lonLatToTileXY(116.397, 39.909, 12)
    // standard slippy: (116.397+180)/360*4096 = 3372.34 → x 3372; y 1552
    expect(Math.floor(t.x)).toBe(3372)
    expect(Math.floor(t.y)).toBe(1552)
  })
  it('tileXYToLonLat round-trips tile corners', () => {
    const t = lonLatToTileXY(113.14, 41.59, 10)
    const ll = tileXYToLonLat(Math.floor(t.x), Math.floor(t.y), 10)
    const t2 = lonLatToTileXY(ll.lon, ll.lat, 10)
    expect(Math.floor(t2.x)).toBe(Math.floor(t.x))
    expect(Math.floor(t2.y)).toBe(Math.floor(t.y))
  })
})

describe('pickOverviewView (bbox → zoom so tiles ≤ budget)', () => {
  it('wide loop (4.3°) picks low zoom within tile budget', () => {
    const v = pickOverviewView({ minLon: 112.0, minLat: 39.7, maxLon: 116.4, maxLat: 43.9 }, 16)
    const tiles = (v.x1 - v.x0 + 1) * (v.y1 - v.y0 + 1)
    expect(tiles).toBeLessThanOrEqual(16)
    expect(v.z).toBeLessThanOrEqual(10)
  })
  it('small local route picks higher zoom', () => {
    const v = pickOverviewView({ minLon: -110.15, minLat: 36.95, maxLon: -110.05, maxLat: 37.0 }, 16)
    expect(v.z).toBeGreaterThanOrEqual(11)
  })
  it('degenerate single point does not blow up (min span guard)', () => {
    const v = pickOverviewView({ minLon: 116.3, minLat: 39.77, maxLon: 116.3, maxLat: 39.77 }, 16)
    expect(Number.isFinite(v.z)).toBe(true)
    expect(v.z).toBeLessThanOrEqual(15)
  })
})

describe('viewFromPoints + projectToView', () => {
  it('projects route points into inset pixel space with padding', () => {
    const pts = [{ lon: 112.0, lat: 39.7 }, { lon: 116.4, lat: 43.9 }]
    const view = viewFromPoints(pts, 200, 150)
    const a = projectToView(112.0, 39.7, view)
    const b = projectToView(116.4, 43.9, view)
    expect(a.x).toBeGreaterThanOrEqual(0)
    expect(a.x).toBeLessThanOrEqual(200)
    expect(b.x).toBeGreaterThan(a.x)
    expect(b.y).toBeLessThan(a.y) // north is up (smaller y)
  })
})
