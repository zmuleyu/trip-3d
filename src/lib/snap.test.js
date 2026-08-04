import { describe, it, expect } from 'vitest'
import { joinGeometries, snapCacheKey } from './snap.js'

describe('joinGeometries', () => {
  it('concatenates segments dropping duplicate seam points', () => {
    const segs = [
      [[0, 0], [1, 1], [2, 2]],
      [[2, 2], [3, 3]],
      [[3, 3], [4, 4], [5, 5]],
    ]
    expect(joinGeometries(segs)).toEqual([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]])
  })
  it('empty/single segment passthrough', () => {
    expect(joinGeometries([])).toEqual([])
    expect(joinGeometries([[[0, 0], [1, 1]]])).toEqual([[0, 0], [1, 1]])
  })
})

describe('snapCacheKey', () => {
  it('includes provider/profile and direction matters', () => {
    const a = { lon: 102.83, lat: 31.05 }
    const b = { lon: 102.9, lat: 31.02 }
    expect(snapCacheKey('osrm', 'foot', a, b)).not.toBe(snapCacheKey('osrm', 'foot', b, a))
    expect(snapCacheKey('osrm', 'foot', a, b)).not.toBe(snapCacheKey('osrm', 'hiking', a, b))
    expect(snapCacheKey('osrm', 'foot', a, b)).not.toBe(snapCacheKey('amap', 'foot', a, b))
  })
})
