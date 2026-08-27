import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { RouteLayer } from './RouteLayer.js'

describe('RouteLayer.clear', () => {
  it('removes and disposes legacy route visuals without changing route state outside the layer', () => {
    const layer = new RouteLayer(() => 0, () => null, () => () => 0)
    const geometry = { dispose: vi.fn() }
    const map = { dispose: vi.fn() }
    const material = { map, dispose: vi.fn() }
    const visual = new THREE.Object3D()
    visual.geometry = geometry
    visual.material = material
    layer.group.add(visual)
    layer.crosshair = visual

    layer.clear()

    expect(layer.group.children).toEqual([])
    expect(layer.crosshair).toBeNull()
    expect(geometry.dispose).toHaveBeenCalledOnce()
    expect(map.dispose).toHaveBeenCalledOnce()
    expect(material.dispose).toHaveBeenCalledOnce()
  })
})
