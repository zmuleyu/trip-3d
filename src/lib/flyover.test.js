import { describe, it, expect } from 'vitest'
import { resamplePath, flyoverDuration, cameraFrame } from './flyover.js'

const PTS = Array.from({ length: 11 }, (_, i) => ({ x: i * 2, z: 0 })) // 20 world units straight line

describe('resamplePath', () => {
  it('uniform arc-length spacing, endpoints preserved', () => {
    const r = resamplePath(PTS, 5)
    expect(r).toHaveLength(5)
    expect(r[0].x).toBeCloseTo(0)
    expect(r[4].x).toBeCloseTo(20)
    const gaps = r.slice(1).map((p, i) => Math.hypot(p.x - r[i].x, p.z - r[i].z))
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 5)
  })
  it('fewer than 2 points → empty', () => {
    expect(resamplePath([{ x: 0, z: 0 }], 10)).toEqual([])
  })
})

describe('flyoverDuration', () => {
  it('distance / speed, clamped to [min, max]', () => {
    expect(flyoverDuration(4600, { mPerSec: 400, minS: 12, maxS: 60 })).toBeCloseTo(12) // 11.5 → min clamp
    expect(flyoverDuration(20000, { mPerSec: 400, minS: 12, maxS: 60 })).toBeCloseTo(50)
    expect(flyoverDuration(100000, { mPerSec: 400, minS: 12, maxS: 60 })).toBe(60)
  })
})

describe('cameraFrame', () => {
  const ground = (x, z) => 1.5 // fake terrain height
  it('camera above ground along path, target ahead with slight lift', () => {
    const path = resamplePath(PTS, 10)
    const f = cameraFrame(path, 4, ground, { height: 2.5, lookAhead: 2, targetLift: 0.4 })
    expect(f.pos.y).toBeCloseTo(ground(path[4].x, path[4].z) + 2.5)
    expect(f.pos.x).toBeCloseTo(path[4].x)
    expect(f.target.x).toBeCloseTo(path[6].x)
    expect(f.target.y).toBeCloseTo(ground(path[6].x, path[6].z) + 0.4)
  })
  it('look-ahead clamps at path end (no out-of-range)', () => {
    const path = resamplePath(PTS, 10)
    const f = cameraFrame(path, 9, ground, { height: 2.5, lookAhead: 3, targetLift: 0.4 })
    expect(f.target.x).toBeCloseTo(path[9].x)
  })
})
