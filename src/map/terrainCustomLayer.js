import * as THREE from 'three'
import { MercatorCoordinate } from 'maplibre-gl'
import { TERRAIN_SIZE, worldToLonLat } from '../lib/geo.js'

const TERRAIN_LAYER_ID = 'trip-three-terrain'

export function terrainModelMatrix({ geo, dem, baseAltitude = dem?.meanM ?? 0 }) {
  if (!geo || !dem || !Number.isFinite(dem.extentMeters) || dem.extentMeters <= 0) return null

  const half = TERRAIN_SIZE / 2
  const nwLngLat = worldToLonLat(geo, -half, -half)
  const seLngLat = worldToLonLat(geo, half, half)
  const nw = MercatorCoordinate.fromLngLat(nwLngLat, baseAltitude)
  const se = MercatorCoordinate.fromLngLat(seLngLat, baseAltitude)
  const center = MercatorCoordinate.fromLngLat(worldToLonLat(geo, 0, 0), baseAltitude)
  const sceneUnitsPerMeter = TERRAIN_SIZE / dem.extentMeters
  const verticalScale = center.meterInMercatorCoordinateUnits() / sceneUnitsPerMeter

  // Terrain axes are east/up/south (x/y/z). MapLibre's mercator axes are
  // east/south/up, so the model boundary swaps terrain y/z while preserving
  // the exact DEM pixel-center footprint used by geo.js.
  return new THREE.Matrix4().set(
    (se.x - nw.x) / TERRAIN_SIZE, 0, 0, center.x,
    0, 0, (se.y - nw.y) / TERRAIN_SIZE, center.y,
    0, verticalScale, 0, center.z,
    0, 0, 0, 1,
  )
}

export function createTerrainCustomLayer({
  getTerrainContext,
  createRenderer = (options) => new THREE.WebGLRenderer(options),
} = {}) {
  let failureHandler = null

  const layer = {
    id: TERRAIN_LAYER_ID,
    type: 'custom',
    renderingMode: '3d',
    enabled: false,
    available: false,
    failed: null,
    map: null,
    renderer: null,
    camera: null,
    scene: null,
    terrainProxy: null,
    _canvas: null,
    _onContextLost: null,
    _stats: { frames: 0, totalMs: 0, maxMs: 0 },
    _prewarmHandle: null,
    _prewarmState: 'idle',
    _prewarmMs: 0,

    setFailureHandler(handler) {
      failureHandler = typeof handler === 'function' ? handler : null
    },

    setEnabled(on) {
      this.enabled = !!on && !this.failed
      if (this.enabled) this.map?.triggerRepaint()
      return this.enabled
    },

    getStats() {
      const { frames, totalMs, maxMs } = this._stats
      return {
        frames,
        averageMs: frames ? totalMs / frames : 0,
        maxMs,
        prewarmState: this._prewarmState,
        prewarmMs: this._prewarmMs,
      }
    },

    _fail(error) {
      if (this.failed) return
      this.failed = error instanceof Error ? error : new Error(String(error))
      this.enabled = false
      this.available = false
      failureHandler?.(this.failed)
    },

    _detachCanvasEvents() {
      if (this._canvas && this._onContextLost) {
        this._canvas.removeEventListener('webglcontextlost', this._onContextLost)
      }
      this._canvas = null
      this._onContextLost = null
    },

    onAdd(map, gl) {
      this._detachCanvasEvents()
      this.map = map
      this.failed = null
      this._stats = { frames: 0, totalMs: 0, maxMs: 0 }
      this._prewarmState = 'idle'
      this._prewarmMs = 0
      try {
        this.camera = new THREE.Camera()
        this.scene = new THREE.Scene()
        this.scene.add(new THREE.HemisphereLight(0xe8eef2, 0x59604f, 2.2))
        const sun = new THREE.DirectionalLight(0xffffff, 3.4)
        sun.position.set(-18, 26, 12)
        this.scene.add(sun)

        this.renderer = createRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true,
        })
        this.renderer.autoClear = false
        this.renderer.shadowMap.enabled = false
        this._canvas = map.getCanvas()
        this._onContextLost = (event) => {
          event.preventDefault?.()
          this._fail(new Error('WebGL context lost'))
        }
        this._canvas.addEventListener('webglcontextlost', this._onContextLost)
        this.available = true
      } catch (error) {
        this._fail(error)
      }
    },

    _syncTerrainProxy(terrain) {
      const source = terrain?.mesh
      if (!source?.geometry || !source?.material || !this.scene) return null
      if (!this.terrainProxy) {
        this.terrainProxy = new THREE.Mesh(source.geometry, source.material)
        this.terrainProxy.frustumCulled = false
        this.terrainProxy.castShadow = false
        this.terrainProxy.receiveShadow = false
        this.scene.add(this.terrainProxy)
      } else {
        // Geometry and textures are owned and disposed by Terrain. The proxy
        // only follows the latest references so DEM rebuilds cannot go stale.
        this.terrainProxy.geometry = source.geometry
        this.terrainProxy.material = source.material
      }
      this.terrainProxy.visible = source.visible
      return this.terrainProxy
    },

    _schedulePrewarm(args) {
      if (this._prewarmState !== 'idle' || !this.available || !this.renderer?.compileAsync) return
      const matrix = args?.defaultProjectionData?.mainMatrix
      if (!matrix) return
      this._prewarmState = 'scheduled'
      const run = async () => {
        this._prewarmHandle = null
        if (this.enabled || !this.available || this.failed || !this.renderer) { this._prewarmState = 'idle'; return }
        const context = getTerrainContext?.()
        const model = terrainModelMatrix(context ?? {})
        if (!model || !this._syncTerrainProxy(context?.terrain)) { this._prewarmState = 'idle'; return }
        try {
          const started = performance.now()
          const mapProjection = new THREE.Matrix4().fromArray(matrix)
          this.camera.projectionMatrix.copy(mapProjection).multiply(model)
          this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert()
          await this.renderer.compileAsync(this.scene, this.camera)
          const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false })
          try {
            this.renderer.resetState()
            this.renderer.setRenderTarget(target)
            this.renderer.render(this.scene, this.camera)
          } finally {
            this.renderer.setRenderTarget(null)
            this.renderer.resetState()
            target.dispose()
          }
          this._prewarmMs = performance.now() - started
          this._prewarmState = 'ready'
        } catch {
          // Prewarming is an optimization only. The normal render path remains
          // authoritative and will surface a real rendering failure.
          this._prewarmState = 'idle'
        }
      }
      const idle = globalThis.requestIdleCallback
      this._prewarmHandle = idle ? idle(run, { timeout: 1200 }) : setTimeout(run, 240)
    },

    render(gl, args) {
      if (!this.enabled) { this._schedulePrewarm(args); return }
      if (!this.available || this.failed || !this.renderer) return
      const context = getTerrainContext?.()
      const model = terrainModelMatrix(context ?? {})
      if (!model || !this._syncTerrainProxy(context?.terrain)) return

      const started = performance.now()
      try {
        const mapProjection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix)
        this.camera.projectionMatrix.copy(mapProjection).multiply(model)
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert()
        this.renderer.resetState()
        this.renderer.render(this.scene, this.camera)
        const elapsed = performance.now() - started
        this._stats.frames++
        this._stats.totalMs += elapsed
        this._stats.maxMs = Math.max(this._stats.maxMs, elapsed)
        this.map?.triggerRepaint()
      } catch (error) {
        this._fail(error)
      }
    },

    onRemove() {
      if (this._prewarmHandle != null) {
        if (globalThis.cancelIdleCallback) globalThis.cancelIdleCallback(this._prewarmHandle)
        else clearTimeout(this._prewarmHandle)
      }
      this._prewarmHandle = null
      this._detachCanvasEvents()
      if (this.terrainProxy && this.scene) this.scene.remove(this.terrainProxy)
      this.terrainProxy = null
      this.renderer?.dispose?.()
      this.renderer = null
      this.camera = null
      this.scene = null
      this.map = null
      this.available = false
    },
  }

  return layer
}
