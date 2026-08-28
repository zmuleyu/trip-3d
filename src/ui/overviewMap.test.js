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
      this.easeCalls = []
      this.terrainCalls = []
      this.terrain = null
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
    touchZoomRotate = { enable: vi.fn() }
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
    setPaintProperty = vi.fn()
    setLayoutProperty = vi.fn()
    addSource(id, definition) {
      const source = {
        ...definition,
        data: definition.data,
        setData: vi.fn((data) => { source.data = data }),
      }
      this.sources.set(id, source)
    }
    getSource(id) { return this.sources.get(id) }
    setTerrain(options) {
      if (this.terrainError) throw this.terrainError
      this.terrain = options
      this.terrainCalls.push(options)
    }
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
    stop = vi.fn()
    easeTo(options) {
      this.easeCalls.push(options)
      this.jumpTo(options)
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
  it('keeps only unselected route alternatives in a subdued MapLibre source', () => {
    const { overview, instance } = setup()
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT, {
      alternatives: [
        { id: 'primary', geometry: [[113, 41.2], [113.2, 41.4]] },
        { id: 'alternate', geometry: [[113, 41.2], [113.1, 41.35], [113.2, 41.4]] },
      ],
      selectedAlternative: 0,
    })
    expect(instance.getSource('trip-route-alternatives').data.features).toEqual([
      expect.objectContaining({ properties: expect.objectContaining({ alternativeId: 'alternate', label: '方案 2' }) }),
    ])
  })
  it('creates exactly one MapLibre map with the OpenFreeMap style and required attribution', () => {
    const { overview, instance } = setup()
    overview.setPlannerMode(true)

    expect(maplibre.instances).toHaveLength(1)
    expect(instance.options.style).toBe('https://tiles.openfreemap.org/styles/positron')
    expect(instance.options.dragRotate).toBe(false)
    expect(instance.options.touchPitch).toBe(false)
    expect(instance.options.canvasContextAttributes).toEqual({ antialias: true })
    expect(instance.controls[0].control.options.compact).toBe(false)
    expect(instance.canvas.getAttribute('aria-label')).toBe('路线规划地图')
    expect(instance.getSource('trip-native-terrain')).toBeUndefined()
    expect(instance.getSource('trip-terrain-hillshade')).toMatchObject({
      type: 'raster-dem',
      encoding: 'terrarium',
    })
    expect(instance.getLayer('trip-terrain-relief')).toMatchObject({
      type: 'hillshade',
      source: 'trip-terrain-hillshade',
    })
    expect(instance.terrain).toBeNull()
  })

  it('merges global actions, layers, zoom, and fit into one right map dock', () => {
    const onDockAction = vi.fn()
    const { overview } = setup({ onDockAction })
    overview.setPlannerMode(true)
    const dock = overview.el.querySelector('.ui-map-dock')
    expect(dock.querySelectorAll('button')).toHaveLength(5)
    dock.querySelector('.ui-map-global-actions').click()
    dock.querySelector('.ui-map-layers-toggle').click()
    expect(onDockAction).toHaveBeenNthCalledWith(1, 'more', true)
    expect(onDockAction).toHaveBeenNthCalledWith(2, 'layers', true)
  })

  it('uses measured shared safe areas for route fit', () => {
    const getFitPadding = vi.fn(() => ({ top: 108, right: 430, bottom: 142, left: 96 }))
    const { overview, instance } = setup({ getFitPadding })
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    overview.fit()
    expect(instance.fitCalls.at(-1).options.padding).toEqual({ top: 108, right: 430, bottom: 142, left: 96 })
  })

  it('keeps one transient Analyze cursor source and routes map hover/tap back without editing or jumping', () => {
    const onAnalysisCursor = vi.fn()
    const onJump = vi.fn()
    const { overview, instance } = setup({ onAnalysisCursor, onJump })
    const route = { waypoints: [{ id: 'a', lon: 100, lat: 30 }, { id: 'b', lon: 101, lat: 30 }] }
    const points = [
      { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
      { lon: 101, lat: 30, ele: 1200, cumDistM: 1000 },
    ]
    overview.setPlannerMode(true, { editing: false })
    overview.update(route, points, VIEWPORT)
    overview.setPlannerView('3d')
    overview.setAnalysisCursor({ points, distanceM: 500 })
    expect(instance.getSource('trip-analysis-cursor').data.features).toHaveLength(1)
    expect(instance.layers.filter((layer) => layer.id === 'trip-analysis-cursor')).toHaveLength(1)
    const repeated = [
      { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
      { lon: 100, lat: 30, ele: 1100, cumDistM: 0 },
    ]
    overview.setAnalysisCursor({ points: repeated, distanceM: 0 })
    expect(instance.getSource('trip-analysis-cursor').data.features[0].geometry.coordinates).toEqual([100, 30])
    overview.setAnalysisCursor({ points, distanceM: 500 })

    const routeFeature = { layer: { source: 'trip-planned-route' } }
    instance.emit('mousemove', { features: [routeFeature], lngLat: { lng: 100.25, lat: 30 } })
    expect(onAnalysisCursor).toHaveBeenLastCalledWith(expect.closeTo(250, 4))
    expect(instance.dragPan.disable).not.toHaveBeenCalled()
    instance.emit('click', { features: [routeFeature], lngLat: { lng: 100.75, lat: 30 } })
    expect(onAnalysisCursor).toHaveBeenLastCalledWith(expect.closeTo(750, 4))
    expect(onJump).not.toHaveBeenCalled()

    instance.canvas.dispatchEvent(new Event('pointerleave'))
    expect(onAnalysisCursor).toHaveBeenLastCalledWith(null)
    overview.setPlannerView('2d')
    expect(instance.getSource('trip-analysis-cursor').data.features).toHaveLength(0)
  })

  it('keeps weather, waypoint, and drag-suppression click priority before a queried route cursor', () => {
    const onAnalysisCursor = vi.fn()
    const onWaypointSelect = vi.fn()
    const onJump = vi.fn()
    const { overview, instance } = setup({ onAnalysisCursor, onWaypointSelect, onJump })
    const route = { waypoints: [{ id: 'a', lon: 100, lat: 30 }, { id: 'b', lon: 101, lat: 30 }] }
    const points = [
      { lon: 100, lat: 30, ele: 1000, cumDistM: 0 },
      { lon: 101, lat: 30, ele: 1200, cumDistM: 1000 },
    ]
    const routeFeature = { layer: { id: 'trip-route-line', source: 'trip-planned-route' } }
    const waypointFeature = { layer: { id: 'trip-waypoint-circles', source: 'trip-route-waypoints' }, properties: { waypointId: 'a' } }
    overview.setPlannerMode(true, { editing: false })
    overview.update(route, points, VIEWPORT)
    overview.setPlannerView('3d')
    overview.setAnalysisCursor({ points, distanceM: 500 })

    instance.renderedFeatures = [waypointFeature, routeFeature]
    instance.emit('click', { point: { x: 20, y: 20 }, lngLat: { lng: 100.25, lat: 30 } })
    expect(onWaypointSelect).toHaveBeenCalledWith('a')
    expect(onAnalysisCursor).not.toHaveBeenCalled()

    instance.renderedFeatures = [routeFeature]
    instance.emit('click', { point: { x: 20, y: 20 }, lngLat: { lng: 100.75, lat: 30 } })
    expect(onAnalysisCursor).toHaveBeenCalledWith(expect.closeTo(750, 4))
    expect(onJump).not.toHaveBeenCalled()

    overview.setPlannerView('2d')
    instance.emit('click', { point: { x: 20, y: 20 }, lngLat: { lng: 100.75, lat: 30 } })
    expect(onJump).toHaveBeenCalledWith(100.75, 30)
  })

  it('recovers a failed initial style into the same usable 2D route map', () => {
    const onTerrainUnavailable = vi.fn()
    const overview = createOverviewMap({ onTerrainUnavailable })
    document.body.appendChild(overview.el)
    overview.el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 820, height: 560, right: 820, bottom: 560, x: 0, y: 0, toJSON() {} })
    const instance = maplibre.instances[0]
    instance.options.container.getBoundingClientRect = overview.el.getBoundingClientRect
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)

    instance.emit('error', { error: new Error('style initialization failed') })

    expect(maplibre.instances).toHaveLength(1)
    expect(overview.plannerView).toBe('2d')
    expect(instance.terrain).toBeNull()
    expect(instance.getSource('trip-route-waypoints').data.features.map((feature) => feature.properties.waypointId)).toEqual(['a', 'b'])
    expect(overview.el.querySelector('.ui-map-error').textContent).toContain('已保留路线规划')
    expect(onTerrainUnavailable).toHaveBeenCalledWith(expect.objectContaining({ message: 'style initialization failed' }))
  })

  it('uses the same map, route, selection, and camera context across Plan → Analyze → Plan', () => {
    const route = { waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }
    const { overview, instance } = setup({ terrainExaggeration: 1.8 })
    overview.setPlannerMode(true)
    overview.update(route, null, VIEWPORT)
    overview.setSelectedWaypoint('a')
    instance.jumpTo({ center: [113.12, 41.31], zoom: 12.4, bearing: 27 })
    const canvas = instance.getCanvas()
    const center = { ...instance.getCenter() }
    const zoom = instance.getZoom()
    const bearing = instance.getBearing()
    const routeIds = instance.getSource('trip-route-waypoints').data.features.map((feature) => feature.properties.waypointId)

    expect(overview.setPlannerView('3d')).toBe(true)
    expect(maplibre.instances).toHaveLength(1)
    expect(instance.getCanvas()).toBe(canvas)
    expect(instance.getPitch()).toBe(55)
    expect(instance.getBearing()).toBe(bearing)
    expect(instance.getCenter()).toEqual(center)
    expect(instance.getZoom()).toBe(zoom)
    expect(instance.getSource('trip-native-terrain')).toMatchObject({
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      encoding: 'terrarium',
    })
    expect(instance.terrain).toEqual({ source: 'trip-native-terrain', exaggeration: 1.8 })
    expect(instance.layers.some((layer) => layer.type === 'custom')).toBe(false)
    expect(instance.getLayer('trip-route-corridor')).toMatchObject({ source: 'trip-planned-route' })
    expect(instance.setPaintProperty).toHaveBeenCalledWith('trip-route-corridor', 'line-width', 18)

    // This is a programmatic camera correction, so it has no originalEvent
    // and terrain readiness may restore the stage anchor.
    instance.jumpTo({ center: [114, 42], zoom: 9, bearing: 12 })
    instance.emit('sourcedata', { sourceId: 'trip-native-terrain', isSourceLoaded: true })
    expect(instance.getCenter()).toEqual(center)
    expect(instance.getZoom()).toBe(zoom)
    expect(instance.getBearing()).toBe(bearing)
    expect(instance.getPitch()).toBe(55)
    overview.setPlannerMode(true, { editing: false })
    expect(instance.getCenter()).toEqual(center)
    expect(instance.getZoom()).toBe(zoom)
    expect(instance.getBearing()).toBe(bearing)

    expect(overview.setPlannerView('2d')).toBe(true)
    expect(instance.getPitch()).toBe(0)
    expect(instance.getBearing()).toBe(bearing)
    expect(instance.getCenter()).toEqual(center)
    expect(instance.getZoom()).toBe(zoom)
    expect(instance.terrain).toBeNull()
    expect(instance.getSource('trip-route-waypoints').data.features.map((feature) => feature.properties.waypointId)).toEqual(routeIds)
    expect(instance.getSource('trip-route-waypoints').data.features[0].properties.selected).toBe(true)
    expect(instance.stop).toHaveBeenCalledTimes(4)
    expect(instance.easeCalls).toHaveLength(2)
    expect(instance.easeCalls[0]).toMatchObject({ pitch: 55, freezeElevation: true })
    expect(instance.easeCalls.at(-1)).toMatchObject({ pitch: 0, duration: 650, essential: false })
  })

  it('keeps a real user camera move made before terrain readiness', () => {
    const { overview, instance } = setup()
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    overview.setPlannerView('3d')

    instance.emit('dragstart', { originalEvent: { type: 'pointerdown' } })
    instance.jumpTo({ center: [114, 42], zoom: 9, bearing: 12 })
    instance.emit('sourcedata', { sourceId: 'trip-native-terrain', isSourceLoaded: true })

    expect(instance.getCenter()).toEqual({ lng: 114, lat: 42 })
    expect(instance.getZoom()).toBe(9)
    expect(instance.getBearing()).toBe(12)
    expect(instance.getPitch()).toBe(55)
  })

  it('retargets rapid toggles to the latest view and uses the mobile transition duration', () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query === '(max-width: 1023px)' }))
    const { overview, instance } = setup()
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 179.8, lat: 12 }, { id: 'b', lon: -179.8, lat: 12 }] }, null, VIEWPORT)

    overview.setPlannerView('3d')
    overview.setPlannerView('2d')
    overview.setPlannerView('3d')

    expect(instance.stop).toHaveBeenCalledTimes(4)
    expect(instance.easeCalls.map((call) => call.duration)).toEqual([380, 380, 380])
    expect(instance.easeCalls.at(-1)).toMatchObject({ pitch: 46 })
    expect(instance.getPitch()).toBe(46)
    expect(instance.getBearing()).toBe(0)
    expect(instance.dragPan.enable).not.toHaveBeenCalled()
  })

  it('fits mobile Analyze without reserving space for the Plan bottom sheet', () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query === '(max-width: 1023px)' }))
    const { overview, instance } = setup()
    overview.setPlannerMode(true, { editing: false })
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    overview.setPlannerView('3d')
    overview.fit()

    expect(instance.fitCalls.at(-1).options.padding).toEqual({ top: 96, right: 48, bottom: 88, left: 48 })
    expect(instance.fitCalls.at(-1).options.freezeElevation).toBe(true)
  })

  it('keeps mobile Plan route endpoints clear of the right-side zoom instrument', () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query === '(max-width: 1023px)' }))
    const { overview, instance } = setup()
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    overview.fit()

    expect(instance.fitCalls.at(-1).options.padding).toMatchObject({ top: 120, right: 72, left: 56 })
  })

  it('switches immediately for reduced-motion users without changing the map instance', () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }))
    const { overview, instance } = setup()
    overview.setPlannerMode(true)
    const canvas = instance.getCanvas()

    overview.setPlannerView('3d')
    overview.setPlannerView('2d')

    expect(maplibre.instances).toHaveLength(1)
    expect(instance.getCanvas()).toBe(canvas)
    expect(instance.easeCalls).toHaveLength(0)
    expect(instance.getPitch()).toBe(0)
    expect(instance.getBearing()).toBe(0)
  })

  it('returns to an operable 2D route map when native terrain fails and clears only that error after retry', () => {
    const onTerrainUnavailable = vi.fn()
    const { overview, instance } = setup({ onTerrainUnavailable })
    const route = { waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }
    overview.setPlannerMode(true)
    overview.update(route, null, VIEWPORT)
    overview.setSelectedWaypoint('a')
    const error = new Error('native terrain initialization failed')
    instance.terrainError = error

    expect(overview.setPlannerView('3d')).toBe(false)

    expect(overview.plannerView).toBe('2d')
    expect(instance.getPitch()).toBe(0)
    expect(instance.getBearing()).toBe(0)
    expect(instance.getSource('trip-route-waypoints').data.features.map((feature) => feature.properties.waypointId)).toEqual(['a', 'b'])
    expect(instance.getSource('trip-route-waypoints').data.features[0].properties.selected).toBe(true)
    expect(overview.el.querySelector('.ui-map-error').classList.contains('hidden')).toBe(false)
    expect(onTerrainUnavailable).toHaveBeenCalledWith(error)

    instance.terrainError = null
    expect(overview.setPlannerView('3d')).toBe(true)
    expect(overview.plannerView).toBe('3d')
    expect(instance.terrain).toEqual({ source: 'trip-native-terrain', exaggeration: 1.6 })
    expect(overview.el.querySelector('.ui-map-error').classList.contains('hidden')).toBe(true)
  })

  it('falls back to the same 2D route after a native terrain WebGL context loss', () => {
    const onTerrainUnavailable = vi.fn()
    const { overview, instance } = setup({ onTerrainUnavailable })
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    overview.setSelectedWaypoint('b')
    overview.setPlannerView('3d')

    instance.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))

    expect(overview.plannerView).toBe('2d')
    expect(instance.terrain).toBeNull()
    expect(instance.getPitch()).toBe(0)
    expect(instance.getSource('trip-route-waypoints').data.features.map((feature) => feature.properties.waypointId)).toEqual(['a', 'b'])
    expect(instance.getSource('trip-route-waypoints').data.features[1].properties.selected).toBe(true)
    expect(onTerrainUnavailable).toHaveBeenCalledWith(expect.objectContaining({ message: 'WebGL context lost' }))
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

  it('renders one waypoint and a full snapped route without a coverage overlay', () => {
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
    expect(instance.getSource('trip-terrain-coverage')).toBeUndefined()
    expect(instance.fitCalls.at(-1).bounds).toEqual([[112.98, 41.18], [113.24, 41.43]])
    expect(overview.el.querySelector('.ui-map-fit span').textContent).toBe('完整路线')
  })

  it('keeps the selection ring below canonical waypoint markers and labels', () => {
    const { overview, instance } = setup()
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    overview.setSelectedWaypoint('a')

    const layers = instance.layers
    const indexOf = (id) => layers.findIndex((layer) => layer.id === id)
    expect(indexOf('trip-weather-markers')).toBeLessThan(indexOf('trip-waypoint-selection'))
    expect(indexOf('trip-waypoint-selection')).toBeLessThan(indexOf('trip-waypoint-circles'))
    expect(indexOf('trip-waypoint-circles')).toBeLessThan(indexOf('trip-waypoint-labels'))
    expect(layers[indexOf('trip-waypoint-selection')].paint).toMatchObject({
      'circle-radius': 17,
      'circle-color': 'rgba(255,77,0,0)',
      'circle-stroke-color': '#ff4d00',
      'circle-stroke-width': 2.5,
    })
    expect(instance.getSource('trip-route-waypoints').data.features[0].properties).toMatchObject({ label: 'A', selected: true })
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

  it('waits for hysteresis, cancels for a second touch, and restores map gestures', () => {
    const onWaypointMoveStart = vi.fn()
    const onWaypointMove = vi.fn(() => true)
    const onWaypointMoveCancel = vi.fn()
    const { overview, instance } = setup({ onWaypointMoveStart, onWaypointMove, onWaypointMoveCancel })
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    const marker = { layer: { id: 'trip-waypoint-circles', source: 'trip-route-waypoints' }, properties: { waypointId: 'a' } }

    instance.emit('touchstart', { features: [marker], point: { x: 10, y: 10 }, lngLat: { lng: 113, lat: 41.2 }, originalEvent: { touches: [{}] } })
    instance.emit('touchmove', { point: { x: 18, y: 10 }, lngLat: { lng: 113.01, lat: 41.21 }, originalEvent: { touches: [{}] } })
    expect(onWaypointMoveStart).not.toHaveBeenCalled()
    expect(onWaypointMove).not.toHaveBeenCalled()
    expect(instance.dragPan.disable).not.toHaveBeenCalled()

    instance.emit('touchmove', { point: { x: 22, y: 10 }, lngLat: { lng: 113.02, lat: 41.22 }, originalEvent: { touches: [{}] } })
    expect(onWaypointMoveStart).toHaveBeenCalledWith('a')
    expect(onWaypointMove).toHaveBeenCalledWith('a', 113.02, 41.22)
    instance.emit('touchstart', { originalEvent: { touches: [{}, {}] } })
    expect(onWaypointMoveCancel).toHaveBeenCalledWith('a', 113, 41.2)
    expect(instance.dragPan.enable).toHaveBeenCalledOnce()
    expect(instance.touchZoomRotate.enable).toHaveBeenCalledOnce()
  })

  it('suppresses only the drag release click, then accepts the next blank-map tap', () => {
    const onPlanAdd = vi.fn()
    const { overview, instance } = setup({ onPlanAdd, onWaypointMove: vi.fn(() => true) })
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    const marker = { layer: { id: 'trip-waypoint-circles', source: 'trip-route-waypoints' }, properties: { waypointId: 'a' } }
    instance.emit('mousedown', { features: [marker], point: { x: 10, y: 10 }, lngLat: { lng: 113, lat: 41.2 } })
    instance.emit('mousemove', { point: { x: 24, y: 10 }, lngLat: { lng: 113.04, lat: 41.24 } })
    instance.emit('mouseup')
    instance.emit('click', { point: { x: 24, y: 10 }, lngLat: { lng: 113.04, lat: 41.24 } })
    expect(onPlanAdd).not.toHaveBeenCalled()
    instance.emit('click', { point: { x: 80, y: 40 }, lngLat: { lng: 113.3, lat: 41.5 } })
    expect(onPlanAdd).toHaveBeenCalledWith(113.3, 41.5)
  })

  it('cancels an active preview on Escape, blur, and stage changes', () => {
    const onWaypointMoveCancel = vi.fn()
    const { overview, instance } = setup({ onWaypointMove: vi.fn(() => true), onWaypointMoveCancel })
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    const marker = { layer: { id: 'trip-waypoint-circles', source: 'trip-route-waypoints' }, properties: { waypointId: 'a' } }
    const start = () => {
      instance.emit('mousedown', { features: [marker], point: { x: 10, y: 10 }, lngLat: { lng: 113, lat: 41.2 } })
      instance.emit('mousemove', { point: { x: 24, y: 10 }, lngLat: { lng: 113.04, lat: 41.24 } })
    }
    start()
    instance.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    start()
    globalThis.dispatchEvent(new Event('blur'))
    start()
    overview.setPlannerView('3d')
    expect(onWaypointMoveCancel).toHaveBeenCalledTimes(3)
    expect(instance.dragPan.enable).toHaveBeenCalledTimes(3)
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

  it('keeps Analyze waypoint selection readable while disabling all edit events', () => {
    const onPlanAdd = vi.fn()
    const onJump = vi.fn()
    const onWaypointSelect = vi.fn()
    const onWaypointMoveStart = vi.fn()
    const onWaypointMove = vi.fn(() => true)
    const onWaypointMoveEnd = vi.fn()
    const { overview, instance } = setup({
      onPlanAdd,
      onJump,
      onWaypointSelect,
      onWaypointMoveStart,
      onWaypointMove,
      onWaypointMoveEnd,
    })
    overview.setPlannerMode(true, { editing: false })
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)
    overview.setPlannerView('3d')
    const marker = { layer: { id: 'trip-waypoint-circles', source: 'trip-route-waypoints' }, properties: { waypointId: 'a' } }

    instance.emit('mousedown', { features: [marker], point: { x: 10, y: 10 }, lngLat: { lng: 113, lat: 41.2 }, preventDefault: vi.fn() })
    instance.emit('mousemove', { point: { x: 30, y: 20 }, lngLat: { lng: 113.04, lat: 41.24 } })
    instance.emit('mouseup')

    expect(onWaypointMoveStart).not.toHaveBeenCalled()
    expect(onWaypointMove).not.toHaveBeenCalled()
    expect(onWaypointMoveEnd).not.toHaveBeenCalled()
    expect(instance.dragPan.disable).not.toHaveBeenCalled()

    instance.emit('click', { features: [marker], lngLat: { lng: 113, lat: 41.2 } })
    expect(onWaypointSelect).toHaveBeenCalledWith('a')
    instance.emit('click', { lngLat: { lng: 113.3, lat: 41.5 } })
    expect(onPlanAdd).not.toHaveBeenCalled()
    expect(onJump).not.toHaveBeenCalled()
    expect(overview.el.querySelector('.ui-map-context').textContent).toContain('路线只读')
    expect(instance.canvas.getAttribute('aria-label')).toBe('地形分析地图')
  })

  it('preserves zoom, fit, focus, resize, and non-planner jump controls', () => {
    const onJump = vi.fn()
    const { overview, instance } = setup({ onJump })
    overview.setPlannerMode(true)
    overview.update({ waypoints: [{ id: 'a', lon: 113, lat: 41.2 }, { id: 'b', lon: 113.2, lat: 41.4 }] }, null, VIEWPORT)

    const before = overview.view.z
    overview.el.querySelector('[aria-label="放大地图"]').click()
    expect(overview.view.z).toBe(before + 1)
    overview.el.querySelector('[aria-label="显示完整路线"]').click()
    expect(instance.fitCalls.length).toBeGreaterThan(1)
    overview.resize()
    expect(instance.resizeCalls).toBeGreaterThan(0)
    overview.focusPlanner()
    expect(document.activeElement).toBe(instance.canvas)

    overview.setPlannerMode(false)
    instance.emit('click', { lngLat: { lng: 113.3, lat: 41.5 } })
    expect(onJump).toHaveBeenCalledWith(113.3, 41.5)
  })

  it('keeps admin and only fresh weather in shared MapLibre sources', () => {
    const { overview, instance } = setup()
    overview.setAdminOverlay({
      enabled: true,
      selected: { adcode: 110000 },
      rings: [{ adcode: 110000, name: '北京', level: 'province', ring: [[116.1, 39.8], [116.2, 39.9]] }],
    })
    overview.setWeatherOverlay({
      routeRevision: 3,
      weatherRevision: 3,
      result: {
        rep: [{ lon: 116.1, lat: 39.8, role: '起点' }],
        agg: [{ points: [{ point: { lon: 116.1, lat: 39.8 }, precipMm: 0, windMax: 10, tempMin: 3, weatherCode: 0 }] }],
      },
    })

    expect(instance.getSource('trip-admin-boundaries').data.features[0].properties.selected).toBe(true)
    expect(instance.getSource('trip-route-weather').data.features).toHaveLength(1)

    overview.setWeatherOverlay({ routeRevision: 4, weatherRevision: 3, result: { rep: [{ lon: 116.1, lat: 39.8 }] } })
    expect(instance.getSource('trip-route-weather').data.features).toEqual([])
  })

  it('opens weather from local marker properties and does not forward the click to planning', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', (query) => ({ matches: query === '(hover: hover) and (pointer: fine)' }))
    const onPlanAdd = vi.fn()
    const onWeatherDetails = vi.fn()
    const { overview, instance } = setup({ onPlanAdd, onWeatherDetails })
    overview.setPlannerMode(true)
    overview.setWeatherMode(true, { hoverCards: true, pinCards: true })
    const marker = {
      layer: { id: 'trip-weather-markers' },
      properties: {
        role: '木骡子', date: '2026-08-24', tempMin: 2, tempMax: 18,
        precipMm: 5.2, windMax: 18, weatherCode: 71, source: 'forecast',
      },
    }

    instance.emit('mouseenter', { features: [marker], point: { x: 320, y: 220 } })
    vi.advanceTimersByTime(100)
    expect(overview.el.querySelector('.ui-weather-card').classList.contains('hidden')).toBe(false)
    expect(overview.el.querySelector('[data-weather="temperature"]').textContent).toBe('2–18°C')

    instance.emit('click', { features: [marker], point: { x: 320, y: 220 }, lngLat: { lng: 113, lat: 31 } })
    expect(onPlanAdd).not.toHaveBeenCalled()
    overview.el.querySelector('[data-weather-action]').click()
    expect(onWeatherDetails).toHaveBeenCalledWith(expect.objectContaining({ role: '木骡子' }))
    vi.useRealTimers()
  })

  it('opens the same weather card from a keyboard-accessible weather list', () => {
    const { overview } = setup()
    overview.setPlannerMode(true)
    overview.setWeatherOverlay({
      routeRevision: 2,
      weatherRevision: 2,
      result: {
        source: 'forecast',
        rep: [{ lon: 116.1, lat: 39.8, role: '木骡子' }],
        agg: [{ points: [{
          point: { lon: 116.1, lat: 39.8 }, date: '2026-08-24', tempMin: 2, tempMax: 18,
          precipMm: 5.2, windMax: 18, weatherCode: 71,
        }] }],
      },
    })
    overview.setWeatherMode(true)
    expect(overview.focusWeatherPoint('木骡子', { pinned: true })).toBe(true)
    expect(overview.el.querySelector('.ui-weather-card').classList.contains('hidden')).toBe(false)
    expect(overview.el.querySelector('[data-weather="role"]').textContent).toBe('木骡子')
  })
})
