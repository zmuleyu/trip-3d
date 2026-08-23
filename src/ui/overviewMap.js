import {
  AttributionControl,
  Map as MapLibreMap,
  ScaleControl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { iconSvg } from './icons.js'

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const ACCENT = '#ff4d00'
const SOURCE_IDS = {
  coverage: 'trip-terrain-coverage',
  route: 'trip-planned-route',
  waypoints: 'trip-route-waypoints',
}

const EMPTY_FEATURE_COLLECTION = Object.freeze({ type: 'FeatureCollection', features: [] })

function featureCollection(features = []) {
  return { type: 'FeatureCollection', features }
}

function footprintFeature(viewport) {
  if (!viewport) return null
  const { minLon, minLat, maxLon, maxLat } = viewport
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ]],
    },
  }
}

function routeCoordinates(route, points) {
  const path = points?.length >= 2 ? points : route?.waypoints
  return (path ?? []).map((point) => [point.lon, point.lat])
}

function routeFeature(route, points) {
  const coordinates = routeCoordinates(route, points)
  if (coordinates.length < 2) return null
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates },
  }
}

function waypointFeatures(route, selectedWaypointId) {
  const waypoints = route?.waypoints ?? []
  return waypoints.map((waypoint, index) => ({
    type: 'Feature',
    properties: {
      waypointId: waypoint.id,
      kind: index === 0 ? 'start' : index === waypoints.length - 1 ? 'end' : 'middle',
      label: index === 0 ? 'A' : index === waypoints.length - 1 ? 'B' : String(index + 1),
      selected: waypoint.id === selectedWaypointId,
    },
    geometry: { type: 'Point', coordinates: [waypoint.lon, waypoint.lat] },
  }))
}

function routeKey(route, points) {
  const waypoints = route?.waypoints ?? []
  const path = routeCoordinates(route, points)
  const extent = path.length >= 2
    ? `${path.length}:${path[0][0].toFixed(5)},${path[0][1].toFixed(5)}:${path.at(-1)[0].toFixed(5)},${path.at(-1)[1].toFixed(5)}`
    : ''
  return `${waypoints.map((point) => `${point.lon.toFixed(5)},${point.lat.toFixed(5)}`).join('|')}::${extent}`
}

function boundsForCoordinates(coordinates) {
  if (!coordinates.length) return null
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of coordinates) {
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }
  return [[minLon, minLat], [maxLon, maxLat]]
}

function tuneBaseStyle(map) {
  const layers = map.getStyle()?.layers ?? []
  const hideSymbols = /poi|housenumber|airport|aeroway|transit|neighbourhood|suburb/i
  for (const layer of layers) {
    const semanticName = `${layer.id} ${layer['source-layer'] ?? ''}`
    try {
      if (layer.type === 'symbol' && hideSymbols.test(semanticName)) {
        map.setLayoutProperty(layer.id, 'visibility', 'none')
        continue
      }
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#f4f0e6')
      if (layer.type === 'fill' && /water/.test(semanticName)) map.setPaintProperty(layer.id, 'fill-color', '#dce5e2')
      if (layer.type === 'fill' && /park|wood|grass|landcover/.test(semanticName)) map.setPaintProperty(layer.id, 'fill-color', '#e5e7dc')
      if (layer.type === 'fill' && /building|residential/.test(semanticName)) map.setPaintProperty(layer.id, 'fill-color', '#e8e4dc')
      if (layer.type === 'line' && /motorway|highway|road|street|bridge|tunnel/.test(semanticName)) {
        map.setPaintProperty(layer.id, 'line-color', '#9a9b95')
      }
      if (layer.type === 'symbol') {
        map.setPaintProperty(layer.id, 'text-color', '#4c5150')
        map.setPaintProperty(layer.id, 'text-halo-color', '#f4f0e6')
      }
    } catch {
      // Some upstream layers use property sets that do not accept these paint
      // overrides. Keeping the remaining Positron layer is the safe fallback.
    }
  }
}

function addPlannerLayers(map) {
  if (map.getSource(SOURCE_IDS.coverage)) return
  map.addSource(SOURCE_IDS.coverage, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION })
  map.addSource(SOURCE_IDS.route, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION })
  map.addSource(SOURCE_IDS.waypoints, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION })

  map.addLayer({
    id: 'trip-waypoint-selection',
    type: 'circle',
    source: SOURCE_IDS.waypoints,
    filter: ['==', ['get', 'selected'], true],
    paint: {
      'circle-radius': 15,
      'circle-color': ACCENT,
      'circle-opacity': 0.94,
    },
  })
  map.addLayer({
    id: 'trip-terrain-coverage-fill',
    type: 'fill',
    source: SOURCE_IDS.coverage,
    paint: { 'fill-color': '#17191b', 'fill-opacity': 0.035 },
  })
  map.addLayer({
    id: 'trip-terrain-coverage-line',
    type: 'line',
    source: SOURCE_IDS.coverage,
    paint: {
      'line-color': '#17191b',
      'line-opacity': 0.56,
      'line-width': 1.25,
      'line-dasharray': [4, 3],
    },
  })
  map.addLayer({
    id: 'trip-route-casing',
    type: 'line',
    source: SOURCE_IDS.route,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.94, 'line-width': 7 },
  })
  map.addLayer({
    id: 'trip-route-line',
    type: 'line',
    source: SOURCE_IDS.route,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ACCENT, 'line-width': 3.5 },
  })
  map.addLayer({
    id: 'trip-waypoint-circles',
    type: 'circle',
    source: SOURCE_IDS.waypoints,
    paint: {
      'circle-radius': 10,
      'circle-color': [
        'match', ['get', 'kind'],
        'start', '#24845c',
        'end', '#c9362b',
        '#17191b',
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2.5,
    },
  })
  map.addLayer({
    id: 'trip-waypoint-labels',
    type: 'symbol',
    source: SOURCE_IDS.waypoints,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 9,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#ffffff' },
  })
}

export function createOverviewMap({ onJump, onPlanAdd, onWaypointSelect, onWaypointMoveStart, onWaypointMove, onWaypointMoveEnd, onWaypointMoveCancel } = {}) {
  const el = document.createElement('div')
  el.className = 'ui-overview hidden'

  const mapSurface = document.createElement('div')
  mapSurface.className = 'ui-overview-map'

  const mapContext = document.createElement('div')
  mapContext.className = 'ui-map-context'
  const mapContextTitle = document.createElement('b')
  mapContextTitle.textContent = '2D 路线地图'
  const mapContextHint = document.createElement('span')
  mapContextHint.id = 'ui-map-instructions'
  mapContext.append(mapContextTitle, mapContextHint)

  const controls = document.createElement('div')
  controls.className = 'ui-map-controls'
  const zoomIn = document.createElement('button')
  zoomIn.type = 'button'
  zoomIn.setAttribute('aria-label', '放大地图')
  zoomIn.innerHTML = iconSvg('zoomIn')
  const zoomOut = document.createElement('button')
  zoomOut.type = 'button'
  zoomOut.setAttribute('aria-label', '缩小地图')
  zoomOut.innerHTML = iconSvg('zoomOut')
  const fit = document.createElement('button')
  fit.type = 'button'
  fit.className = 'ui-map-fit'
  fit.setAttribute('aria-label', '显示地形范围')
  fit.innerHTML = `${iconSvg('fit')}<span>地形范围</span>`
  controls.append(zoomIn, zoomOut, fit)

  const emptyHint = document.createElement('div')
  emptyHint.className = 'ui-map-empty'
  emptyHint.innerHTML = `${iconSvg('pin')}<div><b>在虚线范围内设置起点</b><span>点击可规划区域，开始创建路线</span></div>`

  const footprintLegend = document.createElement('div')
  footprintLegend.className = 'ui-map-footprint-legend'
  footprintLegend.innerHTML = '<i></i><span>虚线范围：3D 地形覆盖</span>'

  const mapError = document.createElement('div')
  mapError.className = 'ui-map-error hidden'
  mapError.textContent = '底图暂时不可用；路线数据仍已保留'

  el.append(mapSurface, mapContext, controls, emptyHint, footprintLegend, mapError)

  const map = new MapLibreMap({
    container: mapSurface,
    style: OPENFREEMAP_STYLE,
    center: [0, 0],
    zoom: 3,
    minZoom: 3,
    maxZoom: 14,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  })
  // OpenFreeMap's TileJSON supplies OpenFreeMap, OpenMapTiles, and
  // OpenStreetMap attribution; the native control keeps it in sync.
  map.addControl(new AttributionControl({ compact: false }), 'bottom-left')
  map.addControl(new ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right')

  let lastRoute = null
  let lastPoints = null
  let viewportLonLat = null
  let plannerMode = false
  let styleReady = false
  let hasCamera = false
  let lastFitKey = ''
  let attributionControlContainer = null
  let attributionMapParent = null
  let selectedWaypointId = null
  let waypointDrag = null
  let suppressNextMapClick = false
  let suppressMapClickTimer = null

  function syncAttributionHost() {
    const control = attributionControlContainer ?? mapSurface.querySelector('.maplibregl-ctrl-bottom-left')
    if (!control) return
    attributionControlContainer = control
    attributionMapParent ??= control.parentElement
    const floatAboveMobileSheet = plannerMode && globalThis.matchMedia?.('(max-width: 720px)').matches
    const target = floatAboveMobileSheet ? document.body : attributionMapParent
    if (target && control.parentElement !== target) target.append(control)
    control.classList.toggle('ui-map-attribution-floating', floatAboveMobileSheet)
  }

  function syncPlannerData() {
    if (!styleReady) return
    const footprint = footprintFeature(viewportLonLat)
    const route = routeFeature(lastRoute, lastPoints)
    map.getSource(SOURCE_IDS.coverage)?.setData(footprint ? featureCollection([footprint]) : EMPTY_FEATURE_COLLECTION)
    map.getSource(SOURCE_IDS.route)?.setData(route ? featureCollection([route]) : EMPTY_FEATURE_COLLECTION)
    map.getSource(SOURCE_IDS.waypoints)?.setData(featureCollection(waypointFeatures(lastRoute, selectedWaypointId)))
  }

  function updateChrome() {
    const count = lastRoute?.waypoints?.length ?? 0
    mapContextHint.textContent = count === 0
      ? '在虚线范围内设置起点'
      : count === 1
        ? '继续点击，添加终点'
        : `${count} 个途经点 · 点击继续添加`
    emptyHint.classList.toggle('hidden', !plannerMode || count > 0)
    const hasRoute = count >= 2
    fit.querySelector('span').textContent = hasRoute ? '完整路线' : '地形范围'
    fit.setAttribute('aria-label', hasRoute ? '显示完整路线' : '显示地形范围')
    const zoom = map.getZoom()
    zoomIn.disabled = zoom >= 14
    zoomOut.disabled = zoom <= 3
  }

  function fitPadding() {
    const mobilePlanner = plannerMode && globalThis.matchMedia?.('(max-width: 720px)').matches
    if (!mobilePlanner) return plannerMode ? 72 : 28
    const height = Math.max(0, mapSurface.getBoundingClientRect().height)
    const usableHeight = Math.min(height, Math.max(240, window.innerHeight * 0.4))
    return { top: 80, right: 40, bottom: Math.max(80, height - usableHeight + 80), left: 40 }
  }

  function fitCurrent() {
    const waypoints = lastRoute?.waypoints ?? []
    const coordinates = waypoints.length >= 2
      ? routeCoordinates(lastRoute, lastPoints)
      : viewportLonLat
        ? [[viewportLonLat.minLon, viewportLonLat.minLat], [viewportLonLat.maxLon, viewportLonLat.maxLat]]
        : []
    const bounds = boundsForCoordinates(coordinates)
    if (!bounds) return
    const [[minLon, minLat], [maxLon, maxLat]] = bounds
    if (minLon === maxLon && minLat === maxLat) {
      map.jumpTo({ center: [minLon, minLat], zoom: Math.min(13, Math.max(10, map.getZoom())) })
    } else {
      map.fitBounds(bounds, { padding: fitPadding(), maxZoom: 13, duration: 0 })
    }
    hasCamera = true
    updateChrome()
  }

  function resize() {
    syncAttributionHost()
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    map.resize()
    if (plannerMode) fitCurrent()
  }

  function decorateCanvas() {
    const canvas = map.getCanvas()
    canvas.tabIndex = 0
    canvas.setAttribute('aria-label', '二维路线地图')
    canvas.setAttribute('aria-describedby', 'ui-map-instructions')
  }

  map.on('load', () => {
    styleReady = true
    mapError.classList.add('hidden')
    tuneBaseStyle(map)
    addPlannerLayers(map)
    syncPlannerData()
    decorateCanvas()
    resize()
    if (!hasCamera) fitCurrent()
  })
  map.on('error', () => {
    if (!styleReady) mapError.classList.remove('hidden')
  })
  map.on('zoom', updateChrome)
  function waypointFeature(event) {
    const fromEvent = event.features?.find((feature) => feature.layer?.source === SOURCE_IDS.waypoints || feature.properties?.waypointId)
    if (fromEvent) return fromEvent
    if (!event.point) return null
    return map.queryRenderedFeatures(event.point, { layers: ['trip-waypoint-circles'] })
      .find((feature) => feature.properties?.waypointId) ?? null
  }

  function startWaypointDrag(event) {
    if (!plannerMode || event.originalEvent?.button > 0) return
    const feature = waypointFeature(event)
    const waypointId = feature?.properties?.waypointId
    if (!waypointId) return
    event.preventDefault?.()
    onWaypointSelect?.(waypointId)
    onWaypointMoveStart?.(waypointId)
    waypointDrag = {
      waypointId,
      startPoint: event.point,
      startLngLat: event.lngLat,
      moved: false,
      accepted: false,
    }
    map.dragPan.disable()
    map.getCanvas().style.cursor = 'grabbing'
  }

  function moveWaypointDrag(event) {
    if (!waypointDrag || !event.lngLat) return
    const movedPx = event.point && waypointDrag.startPoint
      ? Math.hypot(event.point.x - waypointDrag.startPoint.x, event.point.y - waypointDrag.startPoint.y)
      : Math.hypot(event.lngLat.lng - waypointDrag.startLngLat.lng, event.lngLat.lat - waypointDrag.startLngLat.lat) * 1e6
    if (!waypointDrag.moved && movedPx < 5) return
    waypointDrag.moved = true
    const accepted = onWaypointMove?.(waypointDrag.waypointId, event.lngLat.lng, event.lngLat.lat) === true
    waypointDrag.accepted ||= accepted
  }

  function endWaypointDrag() {
    if (!waypointDrag) return
    const { waypointId, moved, accepted } = waypointDrag
    waypointDrag = null
    map.dragPan.enable()
    map.getCanvas().style.cursor = ''
    if (moved && accepted) onWaypointMoveEnd?.(waypointId)
    else onWaypointMoveCancel?.(waypointId)
    if (moved) {
      // A MapLibre click synthesized by this pointer release belongs to this drag
      // only. The next task clears the guard when no such click is dispatched.
      suppressNextMapClick = true
      clearTimeout(suppressMapClickTimer)
      suppressMapClickTimer = setTimeout(() => {
        suppressNextMapClick = false
        suppressMapClickTimer = null
      }, 0)
    }
  }

  function cancelWaypointDrag() {
    if (!waypointDrag) return
    const { waypointId, moved, accepted, startLngLat } = waypointDrag
    waypointDrag = null
    map.dragPan.enable()
    map.getCanvas().style.cursor = ''
    onWaypointMoveCancel?.(waypointId, startLngLat?.lng, startLngLat?.lat)
  }

  map.on('mousedown', 'trip-waypoint-circles', startWaypointDrag)
  map.on('touchstart', 'trip-waypoint-circles', startWaypointDrag)
  map.on('mousemove', moveWaypointDrag)
  map.on('touchmove', moveWaypointDrag)
  map.on('mouseup', endWaypointDrag)
  map.on('touchend', endWaypointDrag)
  map.on('touchcancel', cancelWaypointDrag)
  map.on('mouseenter', 'trip-waypoint-circles', () => { map.getCanvas().style.cursor = 'grab' })
  map.on('mouseleave', 'trip-waypoint-circles', () => {
    if (!waypointDrag) map.getCanvas().style.cursor = ''
  })
  map.on('click', (event) => {
    const feature = waypointFeature(event)
    if (feature) {
      suppressNextMapClick = false
      clearTimeout(suppressMapClickTimer)
      suppressMapClickTimer = null
      onWaypointSelect?.(feature.properties.waypointId)
      return
    }
    if (suppressNextMapClick) {
      suppressNextMapClick = false
      clearTimeout(suppressMapClickTimer)
      suppressMapClickTimer = null
      return
    }
    const { lng, lat } = event.lngLat
    if (plannerMode && onPlanAdd) onPlanAdd(lng, lat)
    else onJump?.(lng, lat)
  })

  zoomIn.onclick = () => map.zoomIn({ duration: 160 })
  zoomOut.onclick = () => map.zoomOut({ duration: 160 })
  fit.onclick = fitCurrent

  return {
    el,
    get view() {
      if (!hasCamera) return null
      const center = map.getCenter()
      return { z: map.getZoom(), lon: center.lng, lat: center.lat }
    },
    setPlannerMode(on) {
      plannerMode = !!on
      el.classList.toggle('planner', plannerMode)
      if (plannerMode) el.classList.remove('hidden')
      updateChrome()
      requestAnimationFrame(resize)
    },
    resize,
    fit: fitCurrent,
    focusPlanner() { map.getCanvas().focus() },
    setSelectedWaypoint(id) {
      selectedWaypointId = id ?? null
      syncPlannerData()
    },
    update(route, points, viewport, { fit = true } = {}) {
      lastRoute = route
      lastPoints = points
      viewportLonLat = viewport
      const waypoints = route?.waypoints ?? []
      if (waypoints.length < 2 && !plannerMode) {
        el.classList.add('hidden')
        return
      }
      el.classList.remove('hidden')
      syncPlannerData()
      const footprintKey = viewport ? `${viewport.minLon.toFixed(4)},${viewport.minLat.toFixed(4)},${viewport.maxLon.toFixed(4)},${viewport.maxLat.toFixed(4)}` : ''
      const nextFitKey = waypoints.length >= 2 ? `route:${routeKey(route, points)}` : `terrain:${footprintKey}`
      if (fit && (!hasCamera || nextFitKey !== lastFitKey)) {
        lastFitKey = nextFitKey
        fitCurrent()
      } else {
        updateChrome()
      }
    },
    updateViewport(viewport) {
      viewportLonLat = viewport
      syncPlannerData()
      if ((lastRoute?.waypoints?.length ?? 0) < 2) {
        lastFitKey = ''
        fitCurrent()
      }
    },
  }
}
