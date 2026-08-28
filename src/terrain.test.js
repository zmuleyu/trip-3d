import { describe, expect, it, vi } from 'vitest'
import { Terrain } from './terrain.js'

describe('retained output terrain resources', () => {
  it('builds the fixed roughness texture once across DEM rebuilds', () => {
    const target = {
      material: { roughnessMap: null },
      rebuildRoughness: vi.fn(function rebuild() { this.material.roughnessMap = {} }),
    }

    expect(Terrain.prototype.ensureRoughness.call(target, {})).toBe(true)
    expect(Terrain.prototype.ensureRoughness.call(target, {})).toBe(false)
    expect(target.rebuildRoughness).toHaveBeenCalledOnce()
  })
})
