import {
  AttributionControl,
  Map as MapLibreMap,
  ScaleControl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { iconSvg } from './icons.js'
import { adminOverlayGeoJSON, weatherOverlayGeoJSON } from '../map/overlayAdapters.js'
import { TERRARIUM_TILE_SIZE, TERRARIUM_TILE_URL_TEMPLATE } from '../dem.js'
import { analysisPointsReady, nearestAnalysisDistance, sampleAnalysisAtDistance } from '../lib/analysisCursor.js'

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const FALLBACK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'planner-fallback-background', type: 'background', paint: { 'background-color': '#f4f0e6' } }],
}
const ACCENT = '#ff4d00'
const TERRAIN_PITCH = 55
const MOBILE_TERRAIN_PITCH = 46
const DESKTOP_TRANSITION_MS = 650
const MOBILE_TRANSITION_MS = 380
const BASE_LABELS_TO_HIDE = /poi|housenumber|airport|aeroway|transit|neighbourhood|suburb/i
const SOURCE_IDS = {
  terrain: 'trip-native-terrain',
  admin: 'trip-admin-boundaries',
  route: 'trip-planned-route',
  weather: 'trip-route-weather',
  waypoints: 'trip-route-waypoints',
  cursor: 'trip-analysis-cursor',
}

const EMPTY_FEATURE_COLLECTION = Object.freeze({ type: 'FeatureCollection', features: [] })

function featureCollection(features = []) {
  return { type: 'FeatureCollection', features }
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
  for (const layer of layers) {
    const semanticName = `${layer.id} ${layer['source-layer'] ?? ''}`
    try {
      if (layer.type === 'symbol' && BASE_LABELS_TO_HIDE.test(semanticName)) {
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
  if (map.getSource(SOURCE_IDS.route)) return
  map.addSource(SOURCE_IDS.admin, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION })
  map.addSource(SOURCE_IDS.route, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION })
  map.addSource(SOURCE_IDS.weather, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION })
  map.addSource(SOURCE_IDS.waypoints, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION })
  map.addSource(SOURCE_IDS.cursor, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION })

  map.addLayer({
    id: 'trip-admin-boundary-line',
    type: 'line',
    source: SOURCE_IDS.admin,
    paint: {
      'line-color': ['case', ['get', 'selected'], ACCENT, '#17191b'],
      'line-opacity': ['case', ['get', 'selected'], 0.94, 0.58],
      'line-width': ['case', ['get', 'selected'], 3, 1.2],
    },
  })
  map.addLayer({
    id: 'trip-route-corridor',
    type: 'line',
    source: SOURCE_IDS.route,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#17191b',
      'line-opacity': 0,
      'line-width': 0,
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
    id: 'trip-analysis-cursor',
    type: 'circle',
    source: SOURCE_IDS.cursor,
    paint: {
      'circle-radius': 6,
      'circle-color': '#ff4d00',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'trip-weather-markers',
    type: 'circle',
    source: SOURCE_IDS.weather,
    layout: { visibility: 'none' },
    paint: {
      // Representative points deliberately sit beneath waypoint ownership. A
      // larger, restrained halo keeps fresh weather visible without another
      // dense label system or a competing click target.
      'circle-radius': 15,
      'circle-color': ['match', ['get', 'risk'], 'high', ACCENT, 'medium', '#c97817', 'low', '#355f50', '#f4f0e6'],
      'circle-stroke-color': '#17191b',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.72,
    },
  })
  map.addLayer({
    id: 'trip-weather-labels',
    type: 'symbol',
    source: SOURCE_IDS.weather,
    layout: {
      visibility: 'none',
      'text-field': ['get', 'tempLabel'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 1.9],
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(23,25,27,.78)',
      'text-halo-width': 2,
    },
  })
  map.addLayer({
    id: 'trip-waypoint-selection',
    type: 'circle',
    source: SOURCE_IDS.waypoints,
    filter: ['==', ['get', 'selected'], true],
    paint: {
      // A transparent center makes this a true focus ring: the waypoint's
      // canonical identity and its A/B label remain readable above it.
      'circle-radius': 17,
      'circle-color': 'rgba(255,77,0,0)',
      'circle-stroke-color': ACCENT,
      'circle-stroke-width': 2.5,
      'circle-opacity': 0.96,
    },
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

export function createOverviewMap({
  terrainExaggeration = 1.6, onTerrainUnavailable, onJump, onPlanAdd, onWaypointSelect,
  onWaypointMoveStart, onWaypointMove, onWaypointMoveEnd, onWaypointMoveCancel,
  onWeatherDetails, onAnalysisCursor,
} = {}) {
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
  fit.className = 'ui-map-fit hidden'
  fit.setAttribute('aria-label', '显示完整路线')
  fit.innerHTML = `${iconSvg('fit')}<span>完整路线</span>`
  controls.append(zoomIn, zoomOut, fit)

  const emptyHint = document.createElement('div')
  emptyHint.className = 'ui-map-empty'
  emptyHint.setAttribute('role', 'status')
  emptyHint.innerHTML = `${iconSvg('pin')}<div><b>单击地图设置起点</b><span>随后继续添加途经点</span></div>`

  let onboardingDismissed = false
  try { onboardingDismissed = sessionStorage.getItem('trip3d.planningGuide.dismissed') === '1' } catch { /* optional session preference */ }
  const onboarding = document.createElement('div')
  onboarding.className = 'ui-map-onboarding'
  onboarding.setAttribute('aria-label', '路线规划步骤')
  onboarding.innerHTML = `
    <ol>
      <li data-guide-step="start"><span>1</span>设置起点</li>
      <li data-guide-step="via"><span>2</span>添加途经点</li>
      <li data-guide-step="confirm"><span>3</span>确认路线</li>
    </ol>
    <button type="button">跳过引导</button>`
  onboarding.querySelector('button').onclick = () => {
    onboardingDismissed = true
    onboarding.classList.add('hidden')
    emptyHint.classList.add('hidden')
    try { sessionStorage.setItem('trip3d.planningGuide.dismissed', '1') } catch { /* optional session preference */ }
  }

  const mapError = document.createElement('div')
  mapError.className = 'ui-map-error hidden'
  mapError.textContent = '底图暂时不可用；路线数据仍已保留'

  const weatherCard = document.createElement('section')
  weatherCard.className = 'ui-weather-card hidden'
  weatherCard.setAttribute('aria-live', 'polite')
  weatherCard.setAttribute('aria-label', '地点天气')
  weatherCard.innerHTML = `
    <header><div><b data-weather="role">地点</b><span data-weather="date"></span></div><button type="button" aria-label="关闭天气卡">×</button></header>
    <div class="ui-weather-current"><strong data-weather="temperature">—</strong><span data-weather="condition">天气数据</span></div>
    <dl><div><dt>降水</dt><dd data-weather="precipitation">—</dd></div><div><dt>风速</dt><dd data-weather="wind">—</dd></div></dl>
    <footer><span data-weather="source">预报</span><button type="button" data-weather-action>逐小时预报</button></footer>`

  el.append(mapSurface, mapContext, controls, emptyHint, onboarding, mapError, weatherCard)

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
    canvasContextAttributes: { antialias: true },
  })
  // OpenFreeMap's TileJSON supplies OpenFreeMap, OpenMapTiles, and
  // OpenStreetMap attribution; the native control keeps it in sync.
  map.addControl(new AttributionControl({ compact: false }), 'bottom-left')
  map.addControl(new ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right')

  let lastRoute = null
  let lastPoints = null
  let viewportLonLat = null
  let plannerMode = false
  let editingMode = false
  let plannerView = '2d'
  let styleReady = false
  let fallback2d = false
  let fallbackRequested = false
  let nativeTerrainActive = false
  let nativeTerrainFailure = null
  let nativeTerrainCameraAnchor = null
  let nativeTerrainCameraSyncPending = false
  let currentTerrainExaggeration = Number.isFinite(Number(terrainExaggeration)) ? Number(terrainExaggeration) : 1.6
  let hasCamera = false
  let lastFitKey = ''
  let attributionControlContainer = null
  let attributionMapParent = null
  let selectedWaypointId = null
  let analysisCursor = { points: null, distanceM: null }
  let adminOverlay = { enabled: false, rings: [], selected: null }
  let weatherOverlay = { routeRevision: -1, weatherRevision: -1, result: null }
  let weatherData = EMPTY_FEATURE_COLLECTION
  let weatherMode = false
  let weatherPreferences = { hoverCards: true, pinCards: true, temperatureLabels: 'auto', transparency: 'system' }
  let weatherPinned = false
  let weatherFeatureCurrent = null
  let weatherOpenTimer = null
  let weatherCloseTimer = null
  let waypointDrag = null
  let suppressNextMapClick = false
  let suppressMapClickTimer = null
  let mapErrorKind = null
  const baseLabelVisibility = new Map()

  function setMapError(message, kind = 'terrain') {
    mapError.textContent = message
    mapError.classList.remove('hidden')
    mapErrorKind = kind
  }

  function clearTerrainError() {
    if (mapErrorKind !== 'terrain') return
    mapError.classList.add('hidden')
    mapErrorKind = null
  }

  function cancelPendingTerrainCameraForUser(event) {
    if (!event?.originalEvent) return
    nativeTerrainCameraAnchor = null
    nativeTerrainCameraSyncPending = false
  }

  function hasReducedMotion() {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  }

  function terrainPitch() {
    return globalThis.matchMedia?.('(max-width: 720px)').matches ? MOBILE_TERRAIN_PITCH : TERRAIN_PITCH
  }

  function setRouteVisualTreatment(terrain3d) {
    if (!styleReady) return
    try {
      const corridor = map.getLayer('trip-route-corridor')
      if (corridor) {
        map.setPaintProperty('trip-route-corridor', 'line-opacity', terrain3d ? 0.23 : 0)
        map.setPaintProperty('trip-route-corridor', 'line-width', terrain3d ? 18 : 0)
      }
      const casing = map.getLayer('trip-route-casing')
      if (casing) map.setPaintProperty('trip-route-casing', 'line-width', terrain3d ? 9 : 7)
      const routeLine = map.getLayer('trip-route-line')
      if (routeLine) map.setPaintProperty('trip-route-line', 'line-width', terrain3d ? 4.5 : 3.5)

      for (const layer of map.getStyle()?.layers ?? []) {
        if (layer.type !== 'symbol' || layer.id.startsWith('trip-')) continue
        const semanticName = `${layer.id} ${layer['source-layer'] ?? ''}`
        if (BASE_LABELS_TO_HIDE.test(semanticName)) continue
        if (!baseLabelVisibility.has(layer.id)) baseLabelVisibility.set(layer.id, layer.layout?.visibility ?? 'visible')
        try {
          map.setLayoutProperty(layer.id, 'visibility', terrain3d ? 'none' : baseLabelVisibility.get(layer.id))
        } catch {
          // Upstream styles may replace a layer between style events. The route
          // remains readable even when a label cannot be retuned.
        }
      }
    } catch {
      // MapLibre may temporarily release its style during context recovery.
      // The route data remains intact and the next style event reapplies it.
    }
  }

  function moveCameraForView(terrain3d, { animate = true } = {}) {
    const camera = {
      pitch: terrain3d ? terrainPitch() : 0,
    }
    map.stop?.()
    if (!animate || hasReducedMotion()) {
      map.jumpTo(camera)
      return
    }
    const mobile = globalThis.matchMedia?.('(max-width: 720px)').matches
    map.easeTo({
      ...camera,
      duration: mobile ? MOBILE_TRANSITION_MS : DESKTOP_TRANSITION_MS,
      easing: (t) => 1 - ((1 - t) ** 3),
      essential: false,
      freezeElevation: terrain3d,
    })
  }

  function disableNativeTerrain() {
    nativeTerrainCameraAnchor = null
    nativeTerrainCameraSyncPending = false
    if (!nativeTerrainActive) return true
    try {
      map.setTerrain(null)
      nativeTerrainActive = false
      return true
    } catch (error) {
      nativeTerrainActive = false
      nativeTerrainFailure = error instanceof Error ? error : new Error(String(error))
      return false
    }
  }

  function enableNativeTerrain() {
    if (!styleReady || fallback2d || typeof map.setTerrain !== 'function') {
      nativeTerrainFailure = new Error('MapLibre native terrain is unavailable')
      return false
    }
    try {
      const wasActive = nativeTerrainActive
      if (!wasActive) {
        const center = map.getCenter()
        nativeTerrainCameraAnchor = {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
        }
        nativeTerrainCameraSyncPending = true
      }
      const sourceAlreadyExists = !!map.getSource(SOURCE_IDS.terrain)
      if (!sourceAlreadyExists) {
        map.addSource(SOURCE_IDS.terrain, {
          type: 'raster-dem',
          tiles: [TERRARIUM_TILE_URL_TEMPLATE],
          tileSize: TERRARIUM_TILE_SIZE,
          encoding: 'terrarium',
          attribution: 'Terrain Tiles / Mapzen / Tilezen',
        })
      }
      map.setTerrain({ source: SOURCE_IDS.terrain, exaggeration: currentTerrainExaggeration })
      nativeTerrainActive = true
      nativeTerrainFailure = null
      clearTerrainError()
      return true
    } catch (error) {
      try { map.setTerrain(null) } catch { /* style/context recovery may already be unavailable */ }
      nativeTerrainActive = false
      nativeTerrainFailure = error instanceof Error ? error : new Error(String(error))
      return false
    }
  }

  function syncNativeTerrainCamera(event) {
    if (!nativeTerrainActive || !nativeTerrainCameraSyncPending || !nativeTerrainCameraAnchor) return
    const sourceLoaded = event?.isSourceLoaded === true || map.isSourceLoaded?.(SOURCE_IDS.terrain) === true
    if (!sourceLoaded) return
    const anchor = nativeTerrainCameraAnchor
    nativeTerrainCameraSyncPending = false
    map.jumpTo({
      center: anchor.center,
      zoom: anchor.zoom,
      bearing: anchor.bearing,
      pitch: terrainPitch(),
    })
  }

  function setInteractionForView({ animate = true } = {}) {
    const terrain3d = plannerMode && plannerView === '3d'
    el.classList.toggle('view-3d', terrain3d)
    if (terrain3d) {
      map.dragRotate?.enable?.()
      map.touchPitch?.enable?.()
    } else {
      map.dragRotate?.disable?.()
      map.touchPitch?.disable?.()
    }
    if (!terrain3d) disableNativeTerrain()
    setRouteVisualTreatment(terrain3d)
    moveCameraForView(terrain3d, { animate })
  }

  function degradeTo2d(error, message = '地形分析暂时不可用；已保留路线规划', errorKind = 'terrain') {
    plannerView = '2d'
    disableNativeTerrain()
    setInteractionForView({ animate: false })
    setMapError(message, errorKind)
    updateChrome()
    onTerrainUnavailable?.(error instanceof Error ? error : new Error(message))
  }

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
    const route = routeFeature(lastRoute, lastPoints)
    map.getSource(SOURCE_IDS.admin)?.setData(adminOverlayGeoJSON(adminOverlay))
    map.getSource(SOURCE_IDS.route)?.setData(route ? featureCollection([route]) : EMPTY_FEATURE_COLLECTION)
    weatherData = weatherOverlayGeoJSON(weatherOverlay)
    map.getSource(SOURCE_IDS.weather)?.setData(weatherData)
    map.getSource(SOURCE_IDS.waypoints)?.setData(featureCollection(waypointFeatures(lastRoute, selectedWaypointId)))
    const sample = plannerMode && plannerView === '3d'
      ? sampleAnalysisAtDistance(analysisCursor.points, analysisCursor.distanceM)
      : null
    const cursorData = sample
      ? featureCollection([{ type: 'Feature', properties: { distanceM: sample.distanceM, ele: sample.ele }, geometry: { type: 'Point', coordinates: [sample.lon, sample.lat] } }])
      : EMPTY_FEATURE_COLLECTION
    map.getSource(SOURCE_IDS.cursor)?.setData(cursorData)
  }

  const weatherCondition = (code) => {
    if (!Number.isFinite(Number(code))) return '天气数据'
    const value = Number(code)
    if (value === 0) return '晴'
    if (value <= 3) return '多云'
    if (value <= 48) return '雾'
    if (value <= 67) return '雨'
    if (value <= 77) return '雪'
    if (value <= 82) return '阵雨'
    if (value <= 86) return '阵雪'
    return '雷暴'
  }

  function weatherFeatureAt(event) {
    return event?.features?.find?.((feature) => feature.layer?.id === 'trip-weather-markers')
      ?? map.queryRenderedFeatures?.(event?.point, { layers: ['trip-weather-markers'] })?.[0]
      ?? null
  }

  function closeWeatherCard({ force = false } = {}) {
    clearTimeout(weatherOpenTimer)
    clearTimeout(weatherCloseTimer)
    if (weatherPinned && !force) return
    weatherPinned = false
    weatherFeatureCurrent = null
    weatherCard.classList.add('hidden')
    weatherCard.classList.remove('pinned')
  }

  function positionWeatherCard(point) {
    const rect = el.getBoundingClientRect()
    const x = Number.isFinite(point?.x) ? point.x : rect.width / 2
    const y = Number.isFinite(point?.y) ? point.y : rect.height / 2
    weatherCard.style.setProperty('--weather-x', `${Math.max(12, Math.min(rect.width - 282, x + 14))}px`)
    weatherCard.style.setProperty('--weather-y', `${Math.max(70, Math.min(rect.height - 216, y - 44))}px`)
  }

  function openWeatherCard(feature, point, { pinned = false } = {}) {
    if (!weatherMode || !feature?.properties) return
    clearTimeout(weatherOpenTimer)
    clearTimeout(weatherCloseTimer)
    weatherFeatureCurrent = feature
    weatherPinned = pinned && weatherPreferences.pinCards
    const p = feature.properties
    weatherCard.querySelector('[data-weather="role"]').textContent = p.role || '路线天气点'
    weatherCard.querySelector('[data-weather="date"]').textContent = p.date || ''
    const min = Number(p.tempMin)
    const max = Number(p.tempMax)
    weatherCard.querySelector('[data-weather="temperature"]').textContent = Number.isFinite(min) && Number.isFinite(max)
      ? `${Math.round(min)}–${Math.round(max)}°C` : '—'
    weatherCard.querySelector('[data-weather="condition"]').textContent = weatherCondition(p.weatherCode)
    weatherCard.querySelector('[data-weather="precipitation"]').textContent = Number.isFinite(Number(p.precipMm)) ? `${Number(p.precipMm).toFixed(1)} mm` : '未知'
    weatherCard.querySelector('[data-weather="wind"]').textContent = Number.isFinite(Number(p.windMax)) ? `${Math.round(Number(p.windMax))} km/h` : '未知'
    weatherCard.querySelector('[data-weather="source"]').textContent = p.source === 'archive' ? '历史同期参考' : '天气预报'
    weatherCard.dataset.material = weatherPreferences.transparency
    weatherCard.classList.toggle('pinned', weatherPinned)
    positionWeatherCard(point)
    weatherCard.classList.remove('hidden')
  }

  function scheduleWeatherOpen(feature, point) {
    if (!weatherPreferences.hoverCards || globalThis.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches === false) return
    clearTimeout(weatherOpenTimer)
    clearTimeout(weatherCloseTimer)
    weatherOpenTimer = setTimeout(() => openWeatherCard(feature, point), 100)
  }

  function scheduleWeatherClose() {
    clearTimeout(weatherOpenTimer)
    clearTimeout(weatherCloseTimer)
    if (weatherPinned) return
    weatherCloseTimer = setTimeout(() => closeWeatherCard(), 150)
  }

  function syncWeatherLayerVisibility() {
    if (!styleReady) return
    const visibility = weatherMode ? 'visible' : 'none'
    if (map.getLayer('trip-weather-markers')) map.setLayoutProperty('trip-weather-markers', 'visibility', visibility)
    const showLabels = weatherMode && weatherPreferences.temperatureLabels !== 'off'
    if (map.getLayer('trip-weather-labels')) map.setLayoutProperty('trip-weather-labels', 'visibility', showLabels ? 'visible' : 'none')
    if (!weatherMode) closeWeatherCard({ force: true })
  }

  function updateChrome() {
    const count = lastRoute?.waypoints?.length ?? 0
    const terrain3d = plannerMode && plannerView === '3d'
    mapContextTitle.textContent = terrain3d ? '分析地形' : '规划路线'
    mapContextHint.textContent = terrain3d && !editingMode
      ? '路线只读 · 返回规划后可继续编辑'
      : count === 0
        ? editingMode ? '单击地图设置起点' : '选择“开始规划”后设置起点'
        : count === 1
          ? '继续点击，添加终点'
          : `${count} 个途经点 · 点击继续添加`
    const guideVisible = plannerMode && editingMode && !terrain3d && count < 2 && !onboardingDismissed
    emptyHint.classList.toggle('hidden', !guideVisible)
    emptyHint.dataset.step = count === 0 ? 'start' : 'via'
    emptyHint.querySelector('b').textContent = count === 0 ? '单击地图设置起点' : '继续单击，添加途经点'
    emptyHint.querySelector('span').textContent = count === 0 ? '随后继续添加途经点' : '可拖动标记调整位置 · Esc 取消'
    onboarding.classList.toggle('hidden', !guideVisible)
    onboarding.querySelectorAll('[data-guide-step]').forEach((item) => {
      const step = item.dataset.guideStep
      item.classList.toggle('active', step === (count === 0 ? 'start' : count === 1 ? 'via' : 'confirm'))
      item.classList.toggle('done', step === 'start' && count > 0)
    })
    const hasRoute = count >= 2
    fit.classList.toggle('hidden', !hasRoute)
    const zoom = map.getZoom()
    zoomIn.disabled = zoom >= 14
    zoomOut.disabled = zoom <= 3
  }

  function fitPadding() {
    const mobilePlanner = plannerMode && globalThis.matchMedia?.('(max-width: 720px)').matches
    if (mobilePlanner && plannerView === '3d' && !editingMode) {
      return { top: 96, right: 48, bottom: 88, left: 48 }
    }
    if (!mobilePlanner) {
      if (!plannerMode) return 28
      const inspectorOpen = !!document.querySelector('.ui-panel:not(.hidden):not(.collapsed), .ui-settings.open')
      return { top: 188, right: inspectorOpen ? 412 : 124, bottom: 166, left: 112 }
    }
    const height = Math.max(0, mapSurface.getBoundingClientRect().height)
    const usableHeight = Math.min(height, Math.max(240, window.innerHeight * 0.4))
    return { top: 120, right: 56, bottom: Math.max(80, height - usableHeight + 80), left: 56 }
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
    const camera = plannerMode && plannerView === '3d'
      ? { pitch: terrainPitch(), bearing: map.getBearing() }
      : { pitch: 0, bearing: map.getBearing() }
    if (minLon === maxLon && minLat === maxLat) {
      map.jumpTo({ center: [minLon, minLat], zoom: Math.min(13, Math.max(10, map.getZoom())), ...camera })
    } else {
      map.fitBounds(bounds, {
        padding: fitPadding(),
        maxZoom: 13,
        duration: 0,
        freezeElevation: nativeTerrainActive,
        ...camera,
      })
    }
    hasCamera = true
    updateChrome()
  }

  function resize({ fit = true } = {}) {
    syncAttributionHost()
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    map.resize()
    if (plannerMode && fit) fitCurrent()
  }

  function decorateCanvas() {
    const canvas = map.getCanvas()
    canvas.tabIndex = 0
    canvas.setAttribute('aria-label', plannerView === '3d' ? '地形分析地图' : '路线规划地图')
    canvas.setAttribute('aria-describedby', 'ui-map-instructions')
  }

  function installPlannerStyle() {
    if (map.getSource(SOURCE_IDS.route)) return
    styleReady = true
    tuneBaseStyle(map)
    addPlannerLayers(map)
    if (plannerMode && plannerView === '3d' && !enableNativeTerrain()) {
      degradeTo2d(nativeTerrainFailure)
    }
    syncWeatherLayerVisibility()
    setRouteVisualTreatment(plannerMode && plannerView === '3d')
    syncPlannerData()
    decorateCanvas()
    resize()
    if (!hasCamera) fitCurrent()
  }

  map.on('style.load', installPlannerStyle)
  map.on('load', installPlannerStyle)
  map.on('sourcedata', (event) => {
    if (event?.sourceId === SOURCE_IDS.terrain) syncNativeTerrainCamera(event)
  })
  map.on('dragstart', cancelPendingTerrainCameraForUser)
  map.on('zoomstart', cancelPendingTerrainCameraForUser)
  map.on('rotatestart', cancelPendingTerrainCameraForUser)
  map.on('pitchstart', cancelPendingTerrainCameraForUser)
  map.on('error', (event) => {
    if (nativeTerrainActive && event?.sourceId === SOURCE_IDS.terrain) {
      degradeTo2d(event?.error)
      return
    }
    if (styleReady || fallbackRequested) return
    fallbackRequested = true
    fallback2d = true
    degradeTo2d(event?.error, '底图暂时不可用；已保留路线规划', 'style')
    try {
      map.setStyle(FALLBACK_STYLE)
    } catch {
      // The canvas and route state remain interactive even if style recovery
      // itself fails; the visible error is the truthful terminal state.
    }
  })
  map.getCanvas().addEventListener('webglcontextlost', (event) => {
    if (!nativeTerrainActive) return
    event.preventDefault?.()
    degradeTo2d(new Error('WebGL context lost'))
  })
  map.on('zoom', updateChrome)
  function waypointFeature(event) {
    const fromEvent = event.features?.find((feature) => feature.layer?.source === SOURCE_IDS.waypoints || feature.properties?.waypointId)
    if (fromEvent) return fromEvent
    if (!event.point) return null
    return map.queryRenderedFeatures(event.point, { layers: ['trip-waypoint-circles'] })
      .find((feature) => feature.properties?.waypointId) ?? null
  }

  function routeFeatureAt(event) {
    const fromEvent = event.features?.find((feature) => feature.layer?.source === SOURCE_IDS.route)
    if (fromEvent) return fromEvent
    if (!event.point) return null
    return map.queryRenderedFeatures(event.point, { layers: ['trip-route-line'] })
      .find((feature) => feature.layer?.source === SOURCE_IDS.route) ?? null
  }

  function requestAnalysisCursor(event) {
    if (!plannerMode || plannerView !== '3d' || editingMode || !analysisPointsReady(analysisCursor.points)) return false
    if (!routeFeatureAt(event) || !event.lngLat) return false
    const distanceM = nearestAnalysisDistance(analysisCursor.points, event.lngLat.lng, event.lngLat.lat)
    if (!Number.isFinite(distanceM)) return false
    onAnalysisCursor?.(distanceM)
    return true
  }

  function startWaypointDrag(event) {
    if (!plannerMode || !editingMode || event.originalEvent?.button > 0) return
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

  function movePlanningGuide(event) {
    if (!editingMode || onboardingDismissed || (lastRoute?.waypoints?.length ?? 0) >= 2 || !event.point) return
    const rect = mapSurface.getBoundingClientRect()
    const x = Math.max(92, Math.min(rect.width - 92, event.point.x + 18))
    const y = Math.max(116, Math.min(rect.height - 116, event.point.y - 18))
    emptyHint.style.setProperty('--guide-x', `${x}px`)
    emptyHint.style.setProperty('--guide-y', `${y}px`)
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
  map.on('mousemove', movePlanningGuide)
  map.on('mousemove', requestAnalysisCursor)
  map.on('touchmove', moveWaypointDrag)
  map.on('mouseup', endWaypointDrag)
  map.on('touchend', endWaypointDrag)
  map.on('touchcancel', cancelWaypointDrag)
  map.on('mouseenter', 'trip-waypoint-circles', () => { map.getCanvas().style.cursor = editingMode ? 'grab' : 'pointer' })
  map.on('mouseleave', 'trip-waypoint-circles', () => {
    if (!waypointDrag) map.getCanvas().style.cursor = ''
  })
  map.on('mouseenter', 'trip-weather-markers', (event) => {
    if (!weatherMode) return
    map.getCanvas().style.cursor = 'pointer'
    scheduleWeatherOpen(weatherFeatureAt(event), event.point)
  })
  map.on('mouseleave', 'trip-weather-markers', () => {
    if (!waypointDrag) map.getCanvas().style.cursor = ''
    scheduleWeatherClose()
  })
  weatherCard.addEventListener('mouseenter', () => clearTimeout(weatherCloseTimer))
  weatherCard.addEventListener('mouseleave', scheduleWeatherClose)
  weatherCard.querySelector('header button').onclick = () => closeWeatherCard({ force: true })
  weatherCard.querySelector('[data-weather-action]').onclick = () => onWeatherDetails?.(weatherFeatureCurrent?.properties ?? null)
  map.getCanvas().addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !weatherCard.classList.contains('hidden')) {
      event.stopPropagation()
      closeWeatherCard({ force: true })
    }
  })
  map.on('click', (event) => {
    const weatherFeature = weatherMode ? weatherFeatureAt(event) : null
    if (weatherFeature) {
      openWeatherCard(weatherFeature, event.point, { pinned: true })
      return
    }
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
    if (requestAnalysisCursor(event)) return
    if (plannerMode && plannerView === '3d' && !editingMode) return
    const { lng, lat } = event.lngLat
    if (editingMode && onPlanAdd) onPlanAdd(lng, lat)
    else onJump?.(lng, lat)
  })
  map.getCanvas().addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch' && plannerView === '3d') onAnalysisCursor?.(null)
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
    setPlannerMode(on, { editing = on } = {}) {
      const wasEditing = editingMode
      plannerMode = !!on
      editingMode = plannerMode && !!editing
      if (wasEditing && !editingMode && waypointDrag) cancelWaypointDrag()
      el.classList.toggle('planner', plannerMode)
      el.classList.toggle('editing', editingMode)
      if (plannerMode) el.classList.remove('hidden')
      if (!plannerMode) {
        plannerView = '2d'
        analysisCursor.distanceM = null
      }
      setInteractionForView({ animate: false })
      syncPlannerData()
      updateChrome()
      decorateCanvas()
      requestAnimationFrame(() => resize({ fit: false }))
    },
    setPlannerView(next) {
      const requested = next === '3d' ? '3d' : '2d'
      if (requested === '3d' && !enableNativeTerrain()) {
        degradeTo2d(nativeTerrainFailure)
        return false
      }
      plannerView = requested
      if (requested === '2d') analysisCursor.distanceM = null
      lastFitKey = ''
      setInteractionForView()
      syncPlannerData()
      if (requested === '3d') syncNativeTerrainCamera()
      updateChrome()
      decorateCanvas()
      requestAnimationFrame(() => resize({ fit: false }))
      return true
    },
    get plannerView() { return plannerView },
    get terrainState() {
      return {
        active: nativeTerrainActive,
        sourceId: SOURCE_IDS.terrain,
        exaggeration: currentTerrainExaggeration,
        failed: nativeTerrainFailure,
      }
    },
    setTerrainExaggeration(value) {
      const next = Number(value)
      if (!Number.isFinite(next) || next <= 0) return false
      currentTerrainExaggeration = next
      if (!nativeTerrainActive) return true
      if (enableNativeTerrain()) return true
      degradeTo2d(nativeTerrainFailure)
      return false
    },
    resize,
    fit: fitCurrent,
    focusPlanner() { map.getCanvas().focus() },
    setSelectedWaypoint(id) {
      selectedWaypointId = id ?? null
      syncPlannerData()
    },
    setAnalysisCursor({ points, distanceM } = {}) {
      analysisCursor = {
        points: analysisPointsReady(points) ? points : null,
        distanceM: Number.isFinite(distanceM) ? distanceM : null,
      }
      syncPlannerData()
    },
    setAdminOverlay(next) {
      adminOverlay = next ?? { enabled: false, rings: [], selected: null }
      syncPlannerData()
    },
    setWeatherOverlay(next) {
      weatherOverlay = next ?? { routeRevision: -1, weatherRevision: -1, result: null }
      syncPlannerData()
    },
    setWeatherMode(on, preferences) {
      weatherMode = !!on
      el.classList.toggle('weather-mode', weatherMode)
      if (preferences) weatherPreferences = { ...weatherPreferences, ...preferences }
      syncWeatherLayerVisibility()
    },
    setWeatherPreferences(preferences) {
      weatherPreferences = { ...weatherPreferences, ...preferences }
      if (!weatherPreferences.pinCards && weatherPinned) closeWeatherCard({ force: true })
      syncWeatherLayerVisibility()
    },
    focusWeatherPoint(role, { pinned = false } = {}) {
      const feature = weatherData.features?.find((candidate) => candidate.properties?.role === role)
      if (!feature) return false
      const [lon, lat] = feature.geometry.coordinates
      const point = map.project?.([lon, lat]) ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 }
      openWeatherCard(feature, point, { pinned })
      return true
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
