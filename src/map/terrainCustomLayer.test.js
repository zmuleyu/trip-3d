import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { MercatorCoordinate } from 'maplibre-gl'
import { makeGeoContext, worldToLonLat, TERRAIN_SIZE } from '../lib/geo.js'
import { createTerrainCustomLayer, terrainModelMatrix } from './terrainCustomLayer.js'

function demFixture() {
  return {
    lat: 41.3,
    lon: 113.2,
    zoom: 10,
    size: 768,
    extentMeters: 84000,
    meanM: 1320,
  }
}

describe('MapLibre Three terrain custom layer', () => {
  it('maps the exact DEM footprint corners and base altitude into mercator space', () => {
    const dem = demFixture()
    const geo = makeGeoContext(dem)
    const matrix = terrainModelMatrix({ geo, dem })
    const half = TERRAIN_SIZE / 2
    const nw = new THREE.Vector3(-half, 0, -half).applyMatrix4(matrix)
    const se = new THREE.Vector3(half, 0, half).applyMatrix4(matrix)
    const base = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix)
    const expectedNw = MercatorCoordinate.fromLngLat(worldToLonLat(geo, -half, -half))
    const expectedSe = MercatorCoordinate.fromLngLat(worldToLonLat(geo, half, half))
    const expectedBase = MercatorCoordinate.fromLngLat(worldToLonLat(geo, 0, 0), dem.meanM)

    expect(nw.x).toBeCloseTo(expectedNw.x, 12)
    expect(nw.y).toBeCloseTo(expectedNw.y, 12)
    expect(se.x).toBeCloseTo(expectedSe.x, 12)
    expect(se.y).toBeCloseTo(expectedSe.y, 12)
    expect(base.x).toBeCloseTo(expectedBase.x, 12)
    expect(base.y).toBeCloseTo(expectedBase.y, 12)
    expect(base.z).toBeCloseTo(expectedBase.z, 12)
  })

  it('keeps geometry vertical exaggeration visible in mercator space', () => {
    const dem = demFixture()
    const geo = makeGeoContext(dem)
    const matrix = terrainModelMatrix({ geo, dem })
    const sceneUnitsPerMeter = TERRAIN_SIZE / dem.extentMeters
    const reliefMeters = 240
    const base = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix)
    const oneX = new THREE.Vector3(0, reliefMeters * sceneUnitsPerMeter, 0).applyMatrix4(matrix)
    const threeX = new THREE.Vector3(0, reliefMeters * sceneUnitsPerMeter * 3, 0).applyMatrix4(matrix)
    const expectedBase = MercatorCoordinate.fromLngLat(worldToLonLat(geo, 0, 0), dem.meanM)
    const expectedOneX = MercatorCoordinate.fromLngLat(worldToLonLat(geo, 0, 0), dem.meanM + reliefMeters)

    expect(oneX.z - base.z).toBeCloseTo(expectedOneX.z - expectedBase.z, 12)
    expect((threeX.z - base.z) / (oneX.z - base.z)).toBeCloseTo(3, 12)
  })

  it('produces a finite model matrix for the real DEM fixture', () => {
    const dem = demFixture()
    const matrix = terrainModelMatrix({ geo: makeGeoContext(dem), dem })

    expect(matrix).toBeTruthy()
    expect(matrix.elements.every(Number.isFinite)).toBe(true)
  })

  it('uses the MapLibre canvas/context and follows rebuilt terrain resources without reparenting', () => {
    const canvas = new EventTarget()
    const gl = {}
    const renderer = {
      autoClear: true,
      shadowMap: { enabled: true },
      resetState: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    }
    const createRenderer = vi.fn(() => renderer)
    const map = { getCanvas: () => canvas, triggerRepaint: vi.fn() }
    const dem = demFixture()
    const geo = makeGeoContext(dem)
    const material = new THREE.MeshStandardMaterial()
    const firstGeometry = new THREE.PlaneGeometry(1, 1)
    const terrain = { mesh: new THREE.Mesh(firstGeometry, material) }
    const context = { terrain, geo, dem }
    const layer = createTerrainCustomLayer({ getTerrainContext: () => context, createRenderer })

    layer.onAdd(map, gl)
    layer.setEnabled(true)
    layer.render(gl, { defaultProjectionData: { mainMatrix: new THREE.Matrix4().identity().elements } })

    expect(createRenderer).toHaveBeenCalledWith({ canvas, context: gl, antialias: true })
    expect(renderer.autoClear).toBe(false)
    expect(renderer.resetState).toHaveBeenCalledOnce()
    const renderedScene = renderer.render.mock.calls[0][0]
    const proxy = renderedScene.children.find((child) => child.isMesh)
    expect(proxy).toBeTruthy()
    expect(proxy).not.toBe(terrain.mesh)
    expect(proxy.parent).toBe(renderedScene)
    expect(terrain.mesh.parent).toBeNull()
    expect(proxy.geometry).toBe(firstGeometry)
    expect(proxy.material).toBe(material)

    const rebuiltGeometry = new THREE.PlaneGeometry(2, 2)
    terrain.mesh.geometry = rebuiltGeometry
    layer.render(gl, { defaultProjectionData: { mainMatrix: new THREE.Matrix4().identity().elements } })
    expect(proxy.geometry).toBe(rebuiltGeometry)
    expect(layer.getStats().frames).toBe(2)
  })

  it('fails closed when the shared WebGL context is lost', () => {
    const canvas = new EventTarget()
    const renderer = { autoClear: true, shadowMap: {}, resetState() {}, render() {}, dispose() {} }
    const failure = vi.fn()
    const layer = createTerrainCustomLayer({ createRenderer: () => renderer })
    layer.setFailureHandler(failure)
    layer.onAdd({ getCanvas: () => canvas, triggerRepaint() {} }, {})
    layer.setEnabled(true)

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))

    expect(layer.enabled).toBe(false)
    expect(layer.available).toBe(false)
    expect(layer.failed?.message).toBe('WebGL context lost')
    expect(failure).toHaveBeenCalledOnce()
  })
})
