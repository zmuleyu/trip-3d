// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const maplibre = vi.hoisted(() => {
  const instances = []

  class MapMock {
    constructor(options) {
      this.options = options
      this.handlers = new Map()
      this.sources = new Map()
      this.layers = []
      this.controls = []
      this.zoom = options.zoom
      this.center = { lng: options.center[0], lat: options.center[1] }
      this.canvas = document.createElement('canvas')
      options.container.appendChild(this.canvas)
      this.resizeCalls = 0
      this.fitCalls = []
      this.pitch = 0
      this.bearing = 0
      instances.push(this)
    }

    addControl(control, position) {
      this.controls.push({ control, position })
      if (position === 'bottom-left') {
        this.attributionElement = document.createElement('div')
        this.attributionElement.className = 'maplibregl-ctrl-bottom-left'
        this.attributionParent = this.options.container
        this.attributionParent.appendChild(this.attributionElement)
      }
      return this
    }
    on(event, layerOrHandler, maybeHandler) {
      const handler = typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler
      const handlers = this.handlers.get(event) ?? []
      handlers.push(handler)
      this.handlers.set(event, handlers)
      return this
    }
    emit(event, payload = {}) { for (const handler of this.handlers.get(event) ?? []) handler(payload) }
    getCanvas() { return this.canvas }
    dragPan = { disable: vi.fn(), enable: vi.fn() }
    queryRenderedFeatures(point, { layers } = {}) {
      return this.renderedFeatures?.filter((feature) => !layers || layers.includes(feature.layer?.id)) ?? []
    }
    getCenter() { return this.center }
    getZoom() { return this.zoom }
    getPitch() { return this.pitch }
    getBearing() { return this.bearing }
    dragRotate = { disable: vi.fn(), enable: vi.fn() }
    touchPitch = { disable: vi.fn(), enable: vi.fn() }
    getStyle() {
      return {
        layers: [
          { id: 'background', type: 'background' },
          { id: 'water', type: 'fill', 'source-layer': 'water' },
          { id: 'poi-label', type: 'symbol', 'source-layer': 'poi' },
          { id: 'road-label', type: 'symbol', 'source-layer': 'transportation_name' },
        ],
      }
    }
    setPaintProperty() {}
    setLayoutProperty() {}
    addSource(id, definition) {
      const source = {
        data: definition.data,
        setData: vi.fn((data) => { source.data = data }),
      }
      this.sources.set(id, source)
    }
    getSource(id) { return this.sources.get(id) }
    addLayer(layer) { this.layers.push(layer) }
    getLayer(id) { return this.layers.find((layer) => layer.id === id) }
    setStyle() { this.sources.clear(); this.layers = []; this.emit('style.load') }
    resize() { this.resizeCalls++ }
    fitBounds(bounds, options) {
      this.fitCalls.push({ bounds, options })
      this.center = {
        lng: (bounds[0][0] + bounds[1][0]) / 2,
        lat: (bounds[0][1] + bounds[1][1]) / 2,
      }
      this.zoom = 11
      this.pitch = options.pitch ?? this.pitch
      this.bearing = options.bearing ?? this.bearing
      this.emit('zoom')
    }
    jumpTo({ center, zoom, pitch, bearing }) {
      if (center) this.center = { lng: center[0], lat: center[1] }
      if (zoom != null) this.zoom = zoom
      if (pitch != null) this.pitch = pitch
      if (bearing != null) this.bearing = bearing
      this.emit('zoom')
    }
    zoomIn() { this.zoom = Math.min(this.options.maxZoom, this.zoom + 1); this.emit('zoom') }
    zoomOut() { this.zoom = Math.max(this.options.minZoom, this.zoom - 1); this.emit('zoom') }
  }

  class AttributionControlMock { constructor(options) { this.options = options } }
  class ScaleControlMock { constructor(options) { this.options = options } }

  return { instances, MapMock, AttributionControlMock, ScaleControlMock }
})

vi.mock('maplibre-gl', () => ({
  Map: maplibre.MapMock,
  AttributionControl: maplibre.AttributionControlMock,
  ScaleControl: maplibre.ScaleControlMock,
}))

import { createOverviewMap } from './overviewMap.js'

const VIEWPORT = { minLon: 112.9, minLat: 41.1, maxLon: 113.5, maxLat: 41.7 }

beforeEach(() => {
  document.body.innerHTML = ''
  maplibre.instances.length = 0
  vi.stubGlobal('requestAnimationFrame', (callback) => { callback(); return 1 })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})

function setup(options) {
  const overview = createOverviewMap(options)
  document.body.appendChild(overview.el)
  overview.el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 820, height: 560, right: 820, bottom: 560, x: 0, y: 0, toJSON() {} })
  const instance = maplibre.instances[0]
  instance.options.container.getBoundingClientRect = overview.el.getBoundingClientRect
  instance.emit('load')
  return { overview, instance }
}

describe('overview MapLibre planner map', () => {
  it('creates exactly one MapLibre map with the OpenFreeMap style and required attribution', () => {
    const { overview, instance } = setup()
    overview.setPlannerMode(true)

    expect(maplibre.instances).toHaveLength(1)
    expect(instance.options.style).toBe('https://tiles.openfreemap.org/styles/positron')
    expect(instance.options.dragRotate).toBe(false)
    expect(instance.options.touchPitch).toBe(false)
    expect(instance.options.canvasContextAttributes).toEqual({ antialias: true })
    expect(instance.controls[0].control.options.compact).toBe(false)
    expect(instance.canvas.getAttribute('aria-label')).toBe('二维路线地图')
  })

  it('uses the same map and canvas for immediate 2D/3D planner views', () => {
    const terrainLayer = {
      id: 'trip-three-terrain',
      type: 'custom',
      failed: null,
      setFailureHandler: vi.fn(),
      setEnabled: vi.fn(() => true),
      getStats: vi.fn(() => ({ frames: 4, averageMs: 2, maxMs: 3 })),
    }
    const { overview, instance } = setup({ terrainLayer })
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    instance.jumpTo({ center: [113.12, 41.31], zoom: 12.4 })
    const canvas = instance.getCanvas()
    const center = { ...instance.getCenter() }
    const zoom = instance.getZoom()

    expect(overview.setPlannerView('3d')).toBe(true)
    expect(maplibre.instances).toHaveLength(1)
    expect(instance.getCanvas()).toBe(canvas)
    expect(instance.getPitch()).toBe(55)
    expect(instance.getBearing()).toBe(-28)
    expect(terrainLayer.setEnabled).toHaveBeenLastCalledWith(true)

    expect(overview.setPlannerView('2d')).toBe(true)
    expect(instance.getPitch()).toBe(0)
    expect(instance.getBearing()).toBe(0)
    expect(instance.getCenter()).toEqual(center)
    expect(instance.getZoom()).toBe(zoom)
    expect(terrainLayer.setEnabled).toHaveBeenLastCalledWith(false)
  })

  it('returns to an operable 2D route map when the terrain layer fails', () => {
    let fail
    const onTerrainUnavailable = vi.fn()
    const terrainLayer = {
      id: 'trip-three-terrain',
      type: 'custom',
      failed: null,
      setFailureHandler: vi.fn((handler) => { fail = handler }),
      setEnabled: vi.fn(() => true),
    }
    const { overview, instance } = setup({ terrainLayer, onTerrainUnavailable })
    overview.setPlannerMode(true)
    overview.setPlannerView('3d')
    const error = new Error('shared context failed')
    terrainLayer.failed = error
    fail(error)

    expect(overview.plannerView).toBe('2d')
    expect(instance.getPitch()).toBe(0)
    expect(instance.getBearing()).toBe(0)
    expect(overview.el.querySelector('.ui-map-error').classList.contains('hidden')).toBe(false)
    expect(onTerrainUnavailable).toHaveBeenCalledWith(error)
  })

  it('keeps the empty planner visible and sends map clicks to waypoint planning', () => {
    const onPlanAdd = vi.fn()
    const onJump = vi.fn()
    const { overview, instance } = setup({ onPlanAdd, onJump })

    overview.setPlannerMode(true)
    overview.update({ waypoints: [] }, null, VIEWPORT)
    instance.emit('click', { lngLat: { lng: 113.2, lat: 41.4 } })

    expect(overview.el.classList.contains('planner')).toBe(true)
    expect(overview.el.classList.contains('hidden')).toBe(false)
    expect(overview.el.querySelector('.ui-map-empty').classList.contains('hidden')).toBe(false)
    expect(onPlanAdd).toHaveBeenCalledWith(113.2, 41.4)
    expect(onJump).not.toHaveBeenCalled()
  })

  it('lifts the native attribution control above a mobile planning sheet and restores it outside planner mode', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { overview, instance } = setup()

    overview.setPlannerMode(true)
    expect(instance.attributionElement.parentElement).toBe(document.body)
    expect(instance.attributionElement.classList.contains('ui-map-attribution-floating')).toBe(true)

    overview.setPlannerMode(false)
    expect(instance.attributionElement.parentElement).toBe(instance.attributionParent)
    expect(instance.attributionElement.classList.contains('ui-map-attribution-floating')).toBe(false)
  })

  it('renders one waypoint, a full snapped route, A/B/intermediate points, and DEM coverage', () => {
    const { overview, instance } = setup()
    overview.setPlannerMode(true)

    overview.update({ waypoints: [{ lon: 113, lat: 41.2 }] }, null, VIEWPORT)
    let waypointData = instance.getSource('trip-route-waypoints').data
    expect(waypointData.features.map((feature) => feature.properties.label)).toEqual(['A'])
    expect(instance.getSource('trip-planned-route').data.features).toHaveLength(0)

    const route = { waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'm', lon: 113.1, lat: 41.3 }, { id: 'b', lon: 113.2, lat: 41.4 }] }
    const snapped = [{ lon: 112.98, lat: 41.18 }, { lon: 113.08, lat: 41.38 }, { lon: 113.24, lat: 41.43 }]
    overview.update(route, snapped, VIEWPORT)

    waypointData = instance.getSource('trip-route-waypoints').data
    expect(waypointData.features.map((feature) => feature.properties.label)).toEqual(['A', '2', 'B'])
    expect(waypointData.features.map((feature) => feature.properties.waypointId)).toEqual(['a', 'm', 'b'])
    expect(instance.getSource('trip-planned-route').data.features[0].geometry.coordinates).toEqual([
      [112.98, 41.18], [113.08, 41.38], [113.24, 41.43],
    ])
    expect(instance.getSource('trip-terrain-coverage').data.features[0].geometry.type).toBe('Polygon')
    expect(instance.fitCalls.at(-1).bounds).toEqual([[112.98, 41.18], [113.24, 41.43]])
    expect(overview.el.querySelector('.ui-map-fit span').textContent).toBe('完整路线')
  })

  it('selects and drags a waypoint without suppressing the next blank-map click', async () => {
    const onPlanAdd = vi.fn()
    let overview
    const onWaypointSelect = vi.fn((id) => overview.setSelectedWaypoint(id))
    const onWaypointMove = vi.fn(() => true)
    const onWaypointMoveEnd = vi.fn()
    const setupResult = setup({ onPlanAdd, onWaypointSelect, onWaypointMove, onWaypointMoveEnd })
    overview = setupResult.overview
    const { instance } = setupResult
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    const marker = { layer: { id: 'trip-waypoint-circles', source: 'trip-route-waypoints' }, properties: { waypointId: 'a' } }

    instance.emit('mousedown', { features: [marker], point: { x: 10, y: 10 }, lngLat: { lng: 113, lat: 41.2 }, preventDefault: vi.fn() })
    instance.emit('mousemove', { point: { x: 22, y: 10 }, lngLat: { lng: 113.04, lat: 41.24 } })
    instance.emit('mousemove', { point: { x: 36, y: 14 }, lngLat: { lng: 113.08, lat: 41.28 } })
    instance.emit('mouseup')

    expect(onWaypointSelect).toHaveBeenCalledWith('a')
    expect(onWaypointMove.mock.calls).toEqual([
      ['a', 113.04, 41.24],
      ['a', 113.08, 41.28],
    ])
    expect(onWaypointMoveEnd).toHaveBeenCalledWith('a')
    expect(onPlanAdd).not.toHaveBeenCalled()
    expect(instance.dragPan.disable).toHaveBeenCalledOnce()
    expect(instance.dragPan.enable).toHaveBeenCalledOnce()

    expect(instance.getSource('trip-route-waypoints').data.features.map((feature) => feature.properties.selected)).toEqual([true, false])
    await new Promise((resolve) => setTimeout(resolve, 0))
    instance.emit('click', { lngLat: { lng: 113.3, lat: 41.5 } })
    expect(onPlanAdd).toHaveBeenCalledWith(113.3, 41.5)
  })

  it('restores map panning and discards a preview when a touch drag is cancelled', () => {
    const onWaypointMove = vi.fn(() => true)
    const onWaypointMoveEnd = vi.fn()
    const onWaypointMoveCancel = vi.fn()
    const { overview, instance } = setup({ onWaypointMove, onWaypointMoveEnd, onWaypointMoveCancel })
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    const marker = { layer: { id: 'trip-waypoint-circles', source: 'trip-route-waypoints' }, properties: { waypointId: 'a' } }

    instance.emit('touchstart', { features: [marker], point: { x: 10, y: 10 }, lngLat: { lng: 113, lat: 41.2 }, preventDefault: vi.fn() })
    instance.emit('touchmove', { point: { x: 24, y: 12 }, lngLat: { lng: 113.04, lat: 41.24 } })
    instance.emit('touchcancel')

    expect(instance.dragPan.enable).toHaveBeenCalledOnce()
    expect(onWaypointMoveEnd).not.toHaveBeenCalled()
    expect(onWaypointMoveCancel).toHaveBeenCalledWith('a', 113, 41.2)
  })

  it('preserves zoom, fit, focus, resize, and non-planner jump controls', () => {
    const onJump = vi.fn()
    const { overview, instance } = setup({ onJump })
    overview.setPlannerMode(true)
    overview.update({ waypoints: [] }, null, VIEWPORT)

    const before = overview.view.z
    overview.el.querySelector('[aria-label="放大地图"]').click()
    expect(overview.view.z).toBe(before + 1)
    overview.el.querySelector('[aria-label="显示地形范围"]').click()
    expect(instance.fitCalls.length).toBeGreaterThan(1)
    overview.resize()
    expect(instance.resizeCalls).toBeGreaterThan(0)
    overview.focusPlanner()
    expect(document.activeElement).toBe(instance.canvas)

    overview.setPlannerMode(false)
    instance.emit('click', { lngLat: { lng: 113.3, lat: 41.5 } })
    expect(onJump).toHaveBeenCalledWith(113.3, 41.5)
  })
})
