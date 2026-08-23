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
    on(event, handler) {
      const handlers = this.handlers.get(event) ?? []
      handlers.push(handler)
      this.handlers.set(event, handlers)
      return this
    }
    emit(event, payload = {}) { for (const handler of this.handlers.get(event) ?? []) handler(payload) }
    getCanvas() { return this.canvas }
    getCenter() { return this.center }
    getZoom() { return this.zoom }
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
    resize() { this.resizeCalls++ }
    fitBounds(bounds, options) {
      this.fitCalls.push({ bounds, options })
      this.center = {
        lng: (bounds[0][0] + bounds[1][0]) / 2,
        lat: (bounds[0][1] + bounds[1][1]) / 2,
      }
      this.zoom = 11
      this.emit('zoom')
    }
    jumpTo({ center, zoom }) {
      this.center = { lng: center[0], lat: center[1] }
      this.zoom = zoom
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
    expect(instance.controls[0].control.options.compact).toBe(false)
    expect(instance.canvas.getAttribute('aria-label')).toBe('二维路线地图')
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

    const route = { waypoints: [{ lon: 113, lat: 41.2 }, { lon: 113.1, lat: 41.3 }, { lon: 113.2, lat: 41.4 }] }
    const snapped = [{ lon: 112.98, lat: 41.18 }, { lon: 113.08, lat: 41.38 }, { lon: 113.24, lat: 41.43 }]
    overview.update(route, snapped, VIEWPORT)

    waypointData = instance.getSource('trip-route-waypoints').data
    expect(waypointData.features.map((feature) => feature.properties.label)).toEqual(['A', '2', 'B'])
    expect(instance.getSource('trip-planned-route').data.features[0].geometry.coordinates).toEqual([
      [112.98, 41.18], [113.08, 41.38], [113.24, 41.43],
    ])
    expect(instance.getSource('trip-terrain-coverage').data.features[0].geometry.type).toBe('Polygon')
    expect(instance.fitCalls.at(-1).bounds).toEqual([[112.98, 41.18], [113.24, 41.43]])
    expect(overview.el.querySelector('.ui-map-fit span').textContent).toBe('完整路线')
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
