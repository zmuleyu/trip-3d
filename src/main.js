import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  DepthOfFieldEffect,
  VignetteEffect,
  NoiseEffect,
  SMAAEffect,
  HueSaturationEffect,
  BrightnessContrastEffect,
  ToneMappingEffect,
  ToneMappingMode,
  Effect,
  BlendFunction,
} from 'postprocessing'
import packageMetadata from '../package.json'
import { Terrain } from './terrain.js'
import { createLabels, disposeLabels } from './labels.js'
import { TERRARIUM_SOURCE_ID, loadDem, sampleDem } from './dem.js'
import { makeGeoContext, worldToLonLat, lonLatToWorld, TERRAIN_SIZE } from './lib/geo.js'
import { createOverviewMap } from './ui/overviewMap.js'
import { createPlannerWorkspace } from './ui/plannerWorkspace.js'
import { createFluidLayout } from './ui/fluidLayout.js'
import { setDrawerOpen } from './ui/drawer.js'
import { createAdminLayer } from './ui/adminLayer.js'
import { provinceAdcode, extractRings, clipRingToBbox, pointInRing } from './lib/adminBoundaries.js'
import { createAdminBoundaryCache } from './lib/adminBoundaryCache.js'
import { filterAdminRings, adminBreadcrumb, adminEmptyMessage, adminNeedsReload, findDeepestAdminRegion, createAdminInteractionState } from './lib/adminInteraction.js'
import { computeRegionRouteStats, formatRouteStats } from './lib/adminRouteStats.js'
import { createAdminBoundaryUI } from './ui/adminPanel.js'
import { createSharePanel, renderPoster } from './ui/sharePanel.js'
import { buildPosterData } from './lib/poster.js'
import { sampleRouteAnalysisPath, syncRouteAnalysisConsumer } from './lib/routeAnalysis.js'
import { createRouteDemAnalysisController, createRouteDemCoverage, createRouteDemRunIdentity } from './lib/routeDemCoverage.js'
import { createRouteCandidateId, isCurrentRouteCandidate, routeCandidatePathKey, weatherResultMatchesPath } from './lib/routeCandidates.js'
import { initialAnalysisCursorDistance } from './lib/analysisCursor.js'
import { canMarkAnalysisFresh, createAnalysisFreshness, routeGeometryFingerprint } from './lib/analysisFreshness.js'
import { createSegmentComparison, createSegmentMetrics } from './lib/segmentComparison.js'
import { sunPosition, shadeFraction } from './lib/sun.js'
import { resamplePath, flyoverDuration, cameraFrame } from './lib/flyover.js'
import { TripRouteController } from './lib/tripRouteController.js'
import { assignSearchRouteRole } from './lib/searchRouteIntent.js'
import { routeProviderStatus } from './lib/routeStatus.js'
import { computeHorizontalLegs, computeLegs, computeLegsFromPts, normalizeOsrmLegs } from './lib/legs.js'
import { RouteLayer } from './route/RouteLayer.js'
import { openRouteStore } from './lib/store.js'
import { routeToGpx, gpxToRoute } from './lib/gpx.js'
import { encodeShare, decodeShare } from './lib/share.js'
import { createRail, createPanelHost, createLayerButtons, createToast } from './ui/chrome.js'
import { iconSvg } from './ui/icons.js'
import { createPlanningPanel, createLibraryPanel, createProfileCard } from './ui/panels.js'
import { createSearchSession } from './ui/searchSession.js'
import { createWeatherPanel } from './ui/weatherPanel.js'
import { createSettingsPanel } from './ui/settingsPanel.js'
import { formatSummary, loadSummaryPreferences, saveSummaryPreferences } from './ui/summaryPreferences.js'
import { applyDensity, loadDensity, saveDensity } from './ui/densityPreferences.js'
import { reconcileRouteSelection, sameRouteSelection, segmentRouteSelection, waypointRouteSelection } from './ui/routeSelection.js'
import { adjacentAnalysisSegment, analysisSegmentAtDistance, analysisSegmentForSelection } from './ui/analysisSelection.js'
import { selectSearchPlace } from './ui/searchPlaceSelection.js'
import { createOpenMeteoProvider, createOpenMeteoArchiveProvider } from './providers/openmeteo.js'
import { createGeocodeProvider, createGeocodeSearchLifecycle } from './providers/geocode.js'
import { createRoutingProvider } from './providers/routing.js'
import { createSnapRequestGate } from './lib/snap.js'
import { parseAmapLink, buildAmapLink } from './lib/amapLink.js'
import qrcode from 'qrcode-generator'
import { pickRepresentativePoints, aggregateTripDays, archiveWindow } from './lib/weather.js'
import { tripIndex } from './lib/tripIndex.js'
import { fitDemToCoordinates, normalizeRouteMode, routeCoverage } from './lib/routePlanning.js'
import { createFrameScheduler } from './lib/frameScheduler.js'
import { routeCanBeAnalyzed, WORKFLOW_STAGES } from './ui/workflowStage.js'
import { runRouteMutationInPlan } from './ui/routeMutationGuard.js'
import { createWorkspaceLifecycleCoordinator } from './lib/workspaceLifecycleCoordinator.js'
import { createLegacyTerrainToolsAdapter } from './lib/legacyTerrainToolsAdapter.js'

let uiDensity = applyDensity(loadDensity())

// ------------------------------------------------------------------ params

const DEM_PRESETS = {
  '四姑娘山 / 双桥沟': [31.108, 102.884],
  'Monument Valley': [36.998, -110.0984],
  'Grand Canyon': [36.0997, -112.1124],
  Matterhorn: [45.9766, 7.6585],
  'Mount Fuji': [35.3606, 138.7274],
  'Death Valley': [36.2679, -116.8253],
  'Everest Massif': [27.9881, 86.925],
  Landmannalaugar: [63.983, -19.056],
  Custom: null,
}

const params = {
  // terrain source
  demLocation: '四姑娘山 / 双桥沟',
  demLat: 31.108,
  demLon: 102.884,
  demZoom: 12,
  tilesAcross: 3,
  demExaggeration: 1.6,
  routeName: '未命名线路',
  routeSlopeColors: true,
  routeArrows: true,
  routeTicks: true,

  // terrain generation
  seed: 7,
  resolution: 1024,

  // surface material
  color: '#c2c2c2',
  roughness: 1.0,
  roughnessVariation: 0.5,
  roughnessScale: 1,
  bumpScale: 0.2,
  envMapIntensity: 1.5,

  // camera & depth of field
  fov: 43,
  focusDistance: 24.74,
  focusRange: 25,
  bokehScale: 0,

  // map overlay
  mapTint: 1.0,
  heightContrast: 5.1,
  heightPivot: 0.53,
  gradLow: '#ffffff',
  gradMid1: '#ffffff',
  gradMid2: '#ffffff',
  gradHigh: '#ffa861',
  gradMid1Pos: 0.35,
  gradMid2Pos: 0.36,
  slopeTint: 0.5,
  contourInterval: 0.11,
  contourOpacity: 1,
  contourColor: '#000000',
  gridStep: 5,
  gridOpacity: 1,
  labels: true,

  // look (defaults tuned for the real-terrain use case: less wash-out)
  exposure: 0.96,
  contrast: 0.14,
  saturation: -0.22,
  mapOverlay: false, // OSM street tiles draped on the terrain (quick toggle)
  vignette: 0.42,
  grain: 0.35,
  fogNear: 35.5,
  fogFar: 50,
  fogColor: '#ffffff',

  // motion
  flyDuration: 1.8,
  flyEasing: 'smooth',

  // performance
  pixelRatio: Math.min(window.devicePixelRatio, 2),
  shadowMode: 'dynamic',
  shadowRes: 2048,

  // light
  sunIntensity: 8.3,
  sunAzimuth: 64,
  sunElevation: 19,
  hemiIntensity: 0.0,
  envLight: 0.3,
  shadowSoftness: 15,
}

// ------------------------------------------------------------------ renderer / scene

const container = document.getElementById('app')
const loadingEl = document.getElementById('loading')

const renderer = new THREE.WebGLRenderer({
  powerPreference: 'high-performance',
  antialias: false, // SMAA runs in the post chain
  stencil: false,
  depth: false,
})
renderer.setPixelRatio(params.pixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
// VSM so the shadow blur radius is a real, adjustable softness control
renderer.shadowMap.type = THREE.VSMShadowMap
// tone mapping happens in the post chain (three skips renderer tone mapping
// when drawing into the composer's HDR buffer, which is why exposure felt dead)
renderer.toneMapping = THREE.NoToneMapping
container.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(params.fogColor)
// linear fog: near/far give direct control over where the fade starts and
// where the terrain is fully swallowed, hiding the mesh edge
scene.fog = new THREE.Fog(new THREE.Color(params.fogColor), params.fogNear, params.fogFar)

const camera = new THREE.PerspectiveCamera(params.fov, window.innerWidth / window.innerHeight, 0.5, 220)
camera.position.set(0, 18, 19)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, -0.3, 0)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.maxPolarAngle = Math.PI * 0.49
controls.minDistance = 6
controls.maxDistance = 60
controls.update()

// image-based lighting for believable PBR speculars
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = params.envLight
pmrem.dispose()

// ------------------------------------------------------------------ lights

const sun = new THREE.DirectionalLight(0xffffff, params.sunIntensity)
sun.castShadow = true
sun.shadow.mapSize.set(params.shadowRes, params.shadowRes)
sun.shadow.camera.left = -26
sun.shadow.camera.right = 26
sun.shadow.camera.top = 26
sun.shadow.camera.bottom = -26
sun.shadow.camera.near = 4
sun.shadow.camera.far = 80
sun.shadow.bias = -0.0001
sun.shadow.normalBias = 0.02
sun.shadow.radius = params.shadowSoftness
sun.shadow.blurSamples = 16
scene.add(sun)

const hemi = new THREE.HemisphereLight(0xdadada, 0x5c5c5c, params.hemiIntensity)
scene.add(hemi)

function placeSun() {
  const az = THREE.MathUtils.degToRad(params.sunAzimuth)
  const el = THREE.MathUtils.degToRad(params.sunElevation)
  const r = 34
  sun.position.set(Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r)
  sun.intensity = params.sunIntensity
  hemi.intensity = params.hemiIntensity
  if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
}
placeSun()

// ------------------------------------------------------------------ world

const terrain = new Terrain(params)
scene.add(terrain.mesh)

const labelOpts = () => ({ toFeet: (h) => terrain.heightToFeet(h) })
let labels = new THREE.Group()
labels.visible = params.labels
scene.add(labels)

function regenerateLabels() {
  scene.remove(labels)
  disposeLabels(labels)
  labels = createLabels(terrain.sample, params.seed, labelOpts())
  labels.visible = params.labels
  scene.add(labels)
}

// ------------------------------------------------------------------ retained legacy camera seam

const EASINGS = {
  smooth: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), // cubic in-out
  glide: (t) => 1 - Math.pow(1 - t, 5), // quintic out
  linear: (t) => t,
}
const tween = {
  active: false,
  t: 0,
  p0: new THREE.Vector3(),
  p1: new THREE.Vector3(),
  t0: new THREE.Vector3(),
  t1: new THREE.Vector3(),
}
let fps = 60
let workspaceLifecycle = null
let legacyTerrainTools = null
const isPlanStage = () => workspaceLifecycle?.stage === WORKFLOW_STAGES.PLAN

function requestLegacyFrames() {
  workspaceLifecycle?.wakeLegacyFrames()
}

function flyTo(pos, target) {
  camera.up.set(0, 1, 0)
  tween.p0.copy(camera.position)
  tween.t0.copy(controls.target)
  tween.p1.copy(pos)
  tween.t1.copy(target)
  tween.t = 0
  tween.active = true
  legacyTerrainTools?.wakeCamera()
}
// User grabbing the camera cancels a retained programmatic fly-to.
controls.addEventListener('start', () => {
  tween.active = false
  camera.up.set(0, 1, 0)
})

// ------------------------------------------------------------------ post: real depth-based DOF

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
composer.addPass(new RenderPass(scene, camera))

const dof = new DepthOfFieldEffect(camera, {
  focusDistance: 0.02,
  focalLength: 0.06,
  bokehScale: params.bokehScale,
  height: 720,
})
// drive the circle-of-confusion in world units so focus params are intuitive
dof.cocMaterial.worldFocusDistance = params.focusDistance
dof.cocMaterial.worldFocusRange = params.focusRange

// pre-tonemap exposure multiplier, operating on the HDR buffer
class ExposureEffect extends Effect {
  constructor(exposure) {
    super(
      'ExposureEffect',
      'uniform float exposure; void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * exposure, inputColor.a); }',
      { uniforms: new Map([['exposure', new THREE.Uniform(exposure)]]) }
    )
  }
}

const exposureFx = new ExposureEffect(params.exposure)
const toneMap = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
const contrastFx = new BrightnessContrastEffect({ brightness: 0, contrast: params.contrast })
const hueSat = new HueSaturationEffect({ saturation: params.saturation })
const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false })
grain.blendMode.opacity.value = params.grain
const vignette = new VignetteEffect({ darkness: params.vignette, offset: 0.28 })
const smaa = new SMAAEffect()

const dofPass = new EffectPass(camera, dof)
composer.addPass(dofPass)
composer.addPass(new EffectPass(camera, exposureFx, toneMap, hueSat, contrastFx, grain, vignette, smaa))
// skip the whole DOF pass when bokeh is zero — it's pure cost with no visual effect
dofPass.enabled = params.bokehScale > 0

// Plan stage: click on terrain drops a waypoint.
// Bound to the retained legacy canvas only, primary button,
// and any camera 'change' DURING the press marks the gesture as a drag —
// OrbitControls fires 'change' only on real camera movement (rotate/pan/dolly),
// while its 'start' event fires synchronously on pointerdown (useless here).
const raycaster = new THREE.Raycaster()
let downPos = null
let dragged = false
// waypoint drag: capture-phase pointerdown beats OrbitControls' bubble listener,
// so disabling controls here prevents the camera from starting to orbit.
// markerDrag: { waypointId, pointerId, startX, startY, moved, prevEnabled } — threshold
// before "moved" (no revision churn on jitter); pointerId-bound; cancel-safe.
let markerDrag = null
let insertIndex = null // pending insert position (timeline ⊕)
controls.addEventListener('change', () => {
  if (downPos) dragged = true
  // inset viewport follows camera moves (throttled inside the component)
  overviewThrottle()
})
const ndcOf = (e) => new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
// inset viewport indicator refresh, throttled (controls 'change' fires per frame during drags)
let overviewTimer = null
function overviewThrottle() {
  if (overviewTimer) return
  overviewTimer = setTimeout(() => {
    overviewTimer = null
    if (typeof overviewMap !== 'undefined') overviewMap.updateViewport(currentViewportRect())
  }, 400)
}
const DRAG_THRESHOLD_PX = 5
function endMarkerDrag(commit) {
  if (!markerDrag) return
  controls.enabled = markerDrag.prevEnabled
  renderer.domElement.style.cursor = ''
  if (commit && markerDrag.moved) {
    commitWaypointMove(markerDrag.waypointId)
  } else if (markerDrag.moved) {
    cancelWaypointMove(markerDrag.waypointId)
  } else {
    route.cancelWaypointMove(markerDrag.waypointId)
  }
  markerDrag = null
  downPos = null
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return
  downPos = { x: e.clientX, y: e.clientY }
  dragged = false
  if (!adminInteraction.inspecting && isPlanStage() && routeLayer && geo && dem) {
    raycaster.setFromCamera(ndcOf(e), camera)
    const waypointId = routeLayer.hitWaypoint(raycaster)
    if (waypointId) {
      const waypoint = route.waypoints.find((candidate) => candidate.id === waypointId)
      if (!waypoint) return
      setSelectedWaypoint(waypointId)
      beginWaypointMove(waypointId)
      markerDrag = {
        waypointId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        prevEnabled: controls.enabled,
      }
      controls.enabled = false
    }
  }
}, { capture: true })
renderer.domElement.addEventListener('pointermove', (e) => {
  if (adminInteraction.inspecting && !markerDrag) {
    const now = performance.now()
    if (now - hoverTimer >= 90 && geo && dem) {
      hoverTimer = now
      raycaster.setFromCamera(ndcOf(e), camera)
      const hit = raycaster.intersectObject(terrain.mesh, false)[0]
      if (hit) {
        const { lon, lat } = worldToLonLat(geo, hit.point.x, hit.point.z)
        const region = findDeepestAdminRegion(adminState.regions, lon, lat)
        adminLayer?.setHovered(region)
        renderer.domElement.style.cursor = region ? 'pointer' : ''
      }
    }
    return
  }
  if (!markerDrag || e.pointerId !== markerDrag.pointerId) { hoverCursor(e); return }
  if (!markerDrag.moved && Math.hypot(e.clientX - markerDrag.startX, e.clientY - markerDrag.startY) < DRAG_THRESHOLD_PX) return
  markerDrag.moved = true
  renderer.domElement.style.cursor = 'grabbing'
  raycaster.setFromCamera(ndcOf(e), camera)
  const hit = raycaster.intersectObject(terrain.mesh, false)[0]
  if (!hit) return
  const { lon, lat } = worldToLonLat(geo, hit.point.x, hit.point.z)
  // Preview coordinates are in-memory only; revision/history/snap commit on pointerup.
  previewWaypointMove(markerDrag.waypointId, lon, lat)
})
// marker hover affordance: grab cursor over waypoint markers (throttled ~90ms)
let hoverTimer = 0
function hoverCursor(e) {
  const now = performance.now()
  if (now - hoverTimer < 90) return
  hoverTimer = now
  if (!isPlanStage() || !routeLayer || !geo) { renderer.domElement.style.cursor = ''; return }
  raycaster.setFromCamera(ndcOf(e), camera)
  renderer.domElement.style.cursor = routeLayer.hitWaypoint(raycaster) ? 'grab' : ''
}
window.addEventListener('pointerup', (e) => {
  if (markerDrag && e.pointerId === markerDrag.pointerId) endMarkerDrag(true)
})
window.addEventListener('pointercancel', (e) => {
  if (markerDrag && e.pointerId === markerDrag.pointerId) endMarkerDrag(false)
})
window.addEventListener('blur', () => endMarkerDrag(false))
renderer.domElement.addEventListener('pointerup', (e) => {
  if (adminInteraction.inspecting && downPos && geo && dem && e.button === 0) {
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6
    const wasDrag = dragged
    downPos = null
    if (moved || wasDrag) return
    raycaster.setFromCamera(ndcOf(e), camera)
    const hit = raycaster.intersectObject(terrain.mesh, false)[0]
    if (!hit) return
    const { lon, lat } = worldToLonLat(geo, hit.point.x, hit.point.z)
    const region = findDeepestAdminRegion(adminState.regions, lon, lat)
    if (region) adminInteraction.select({ ...region, selectedAt: [lon, lat] })
    return // inspect mode owns this click; never drop a planning waypoint
  }
  if (markerDrag || !isPlanStage() || !downPos || !geo || !dem || e.button !== 0) return
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6
  const wasDrag = dragged
  downPos = null
  if (moved || wasDrag) return
  const ndc = ndcOf(e)
  raycaster.setFromCamera(ndc, camera)
  const hit = raycaster.intersectObject(terrain.mesh, false)[0]
  if (!hit) return
  const { lon, lat } = worldToLonLat(geo, hit.point.x, hit.point.z)
  const ele = Math.round(elevOfWorld(hit.point.x, hit.point.z))
  let wp = null
  runPlanRouteMutation(() => {
    wp = insertIndex != null ? route.insertWaypoint(insertIndex, lon, lat, ele) : route.addWaypoint(lon, lat, ele)
    if (insertIndex != null) {
      insertIndex = null
      toast.show('已插入途经点')
    }
  })
  if (!wp) return console.warn('waypoint cap reached')
  refreshRoute()
  scheduleSnap()
})

// ------------------------------------------------------------------ regeneration helpers

// ------------------------------------------------------------------ real-world DEM loading

let dem = null
let demBusy = false
let demRequestId = 0
let settingsPanel = null
let profileCard = null
let layerBtns = null
let mobileLayerReturn = null
let mobileOutsideLayerPointer = null
const isCompactWorkspace = () => !!globalThis.matchMedia?.('(max-width: 1023px)')?.matches

function restoreLayerSurface() {
  if (layerBtns?.el?.parentElement !== document.body) document.body.appendChild(layerBtns.el)
}

function closeMobileLayers({ restoreInspector = true, restoreFocus = true } = {}) {
  if (panelHost.currentId !== 'layers') return
  panelHost.hide()
  restoreLayerSurface()
  overviewMap?.setLayersOpen(false)
  const previous = mobileLayerReturn
  mobileLayerReturn = null
  if (restoreInspector && previous?.id) {
    showTab(previous.id, { forceOpen: true })
    panelHost.setSheetState(previous.sheetState)
  } else if (restoreFocus) overviewMap?.layerToggle?.focus?.()
}

function openMobileLayers() {
  if (!layerBtns) return
  if (panelHost.currentId !== 'layers') mobileLayerReturn = panelHost.currentId
    ? { id: panelHost.currentId, sheetState: panelHost.sheetState }
    : null
  panelHost.show('layers', '地图显示', 'ESC 返回', layerBtns.el, {
    onBack: () => closeMobileLayers(),
  })
  panelHost.setSheetState('half')
  overviewMap?.setLayersOpen(true)
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || panelHost?.currentId !== 'layers') return
  event.preventDefault()
  closeMobileLayers()
})
const isMobileOutsideLayerPointer = (event) => {
  const path = event.composedPath?.() ?? []
  return !!mobileOutsideLayerPointer && (path.includes(mobileOutsideLayerPointer.target) || event.target === mobileOutsideLayerPointer.target)
}
document.addEventListener('pointerdown', (event) => {
  if (panelHost?.currentId !== 'layers') return
  if (panelHost.el.contains(event.target) || overviewMap?.layerToggle?.contains(event.target)) return
  mobileOutsideLayerPointer = { target: event.target, pointerId: event.pointerId }
  closeMobileLayers({ restoreFocus: false })
  event.preventDefault()
  event.stopImmediatePropagation()
}, true)
document.addEventListener('pointerup', (event) => {
  if (!isMobileOutsideLayerPointer(event) || event.pointerId !== mobileOutsideLayerPointer.pointerId) return
  event.preventDefault()
  event.stopImmediatePropagation()
  requestAnimationFrame(() => { mobileOutsideLayerPointer = null })
}, true)
document.addEventListener('click', (event) => {
  if (!isMobileOutsideLayerPointer(event)) return
  mobileOutsideLayerPointer = null
  event.preventDefault()
  event.stopImmediatePropagation()
}, true)
// terrain-ready contract: the latest successful load bumps terrainGen; when the
// rebuild completes, waiters resolve with the built generation. Callers compare
// gens to detect supersession (search-add / snap flows). No demBusy polling.
let terrainGen = 0
const terrainWaiters = []
function whenTerrainBuilt(gen) {
  return new Promise((res) => terrainWaiters.push({ gen, res }))
}
async function loadRealTerrain() {
  const requestId = ++demRequestId
  const request = { lat: params.demLat, lon: params.demLon, zoom: params.demZoom, tilesAcross: params.tilesAcross }
  demBusy = true
  settingsPanel?.setTerrainStatus('loading', '正在获取高程数据…')
  loadingEl.textContent = 'fetching elevation tiles…'
  loadingEl.classList.remove('hidden')
  try {
    const loaded = await loadDem(request)
    if (requestId !== demRequestId) return
    dem = loaded
    terrainGen++
    terrain.setDem(dem)
    geo = makeGeoContext(dem)
    ensureRouteLayer()
    buildMapOverlay(dem, terrainGen) // fire-and-forget, generation-guarded
    // NO refreshRoute() here: the legacy adapter rebuild callback drapes the route.
    syncSettingsControls()
    loadingEl.textContent = 'generating terrain…'
    const loadedGen = terrainGen
    legacyTerrainTools.rebuildTerrain()
    whenTerrainBuilt(loadedGen).then((built) => {
      if (built >= loadedGen) settingsPanel?.setTerrainStatus('ready', '地形已更新')
    })
  } catch (err) {
    if (requestId !== demRequestId) return
    console.error('DEM load failed:', err)
    settingsPanel?.setTerrainStatus('error', '高程数据加载失败，请检查网络后重试。')
    if (!dem) {
      lastRouteAnalysis = route.analyzeElevation({ geo, sampleElevation: null })
      lastRoutePts = []
      profileCard?.update(lastRouteAnalysis)
    }
    loadingEl.textContent = 'elevation fetch failed — check connection'
    setTimeout(() => {
      loadingEl.classList.add('hidden')
      loadingEl.textContent = 'generating terrain…'
    }, 2600)
    // failure resolves waiters with -1 so import/search flows can report it
    for (const w of terrainWaiters.splice(0)) w.res(-1)
  } finally {
    if (requestId === demRequestId) demBusy = false
  }
}

// OSM street-tile overlay for the terrain (same slippy grid as the DEM).
// Per-tile failure leaves a blank cell; stale results are dropped by generation.
async function buildMapOverlay(demSnap, gen) {
  const { zoom, tileX0, tileY0, tilesAcross } = demSnap
  const size = tilesAcross * 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const jobs = []
  for (let i = 0; i < tilesAcross; i++) {
    for (let j = 0; j < tilesAcross; j++) {
      const tx = tileX0 + i
      const ty = tileY0 + j
      jobs.push((async () => {
        try {
          const r = await fetch(`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`)
          if (!r.ok) return
          const img = await createImageBitmap(await r.blob())
          ctx.drawImage(img, i * 256, j * 256)
          img.close()
        } catch { /* tile missing → blank cell */ }
      })())
    }
  }
  await Promise.all(jobs)
  if (gen !== terrainGen) return
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  terrain.setOverlayTexture(tex)
  if (params.mapOverlay) terrain.setOverlayMix(0.55)
}

// ------------------------------------------------------------------ admin boundaries (L1)
// DataV aliyun GeoJSON (CN) draped on terrain; province adcode via Nominatim
// reverse at the DEM center. Reloads on demKey change like snap/weather.
const DATAV = 'https://geo.datav.aliyun.com/areas_v3/bound'
const adminBoundaryCache = createAdminBoundaryCache()
const adminState = { on: false, demKey: null, loading: false, panelOpen: false, rings: [], regions: [], breadcrumb: [], cacheStatus: '缓存状态未知' }
let adminLayer = null
let adminUI = null
const adminInteraction = createAdminInteractionState({ onChange: () => refreshAdminUI() })

// L4 route-crossing stat for the detail card. Async (setTimeout) with a
// sequence guard: any selection/route/layer change invalidates in-flight work.
let adminRouteStat = null
let adminRouteStatSeq = 0
function scheduleAdminRouteStat() {
  adminRouteStatSeq++
  adminRouteStat = null
  const sel = adminInteraction.selected
  if (!adminState.on || !sel?.ring?.length || lastRoutePts.length < 2) {
    adminUI?.setRouteStat(null)
    return
  }
  const seq = adminRouteStatSeq
  const pts = lastRoutePts.map((p) => [p.lon, p.lat])
  setTimeout(() => {
    if (seq !== adminRouteStatSeq) return
    const stat = computeRegionRouteStats(pts, sel)
    adminRouteStat = stat ? formatRouteStats(stat) : null
    adminUI?.setRouteStat(adminRouteStat)
  }, 0)
}

function refreshAdminUI() {
  if (!adminUI) return
  const visibleRings = filterAdminRings(adminState.rings, adminInteraction.level)
  adminLayer?.setLevel(adminInteraction.level)
  adminLayer?.setSelected(adminInteraction.selected)
  overviewMap?.setAdminOverlay({ enabled: adminState.on, rings: visibleRings, selected: adminInteraction.selected })
  adminUI.update({
    enabled: adminState.on,
    panelOpen: adminState.panelOpen,
    breadcrumb: adminState.breadcrumb,
    level: adminInteraction.level,
    segmentCount: visibleRings.length,
    cacheStatus: adminState.cacheStatus,
    inspecting: adminInteraction.inspecting,
    selected: adminInteraction.selected ? {
      ...adminInteraction.selected,
      parents: adminState.breadcrumb.filter((name) => name !== adminInteraction.selected.name),
    } : null,
    emptyMessage: visibleRings.length || adminState.loading || adminState.demKey !== currentDemKey()
      ? ''
      : adminEmptyMessage(adminState.breadcrumb),
    routeStat: adminRouteStat,
  })
  document.body.classList.toggle('admin-inspecting', adminInteraction.inspecting)
  scheduleAdminRouteStat()
}

function setAdminEnabled(enabled) {
  adminState.on = enabled
  adminInteraction.setEnabled(enabled)
  layerBtns?.get('admin')?.set(enabled)
  if (enabled) loadAdminBoundaries()
  else {
    adminState.panelOpen = false
    adminLayer?.setVisible(false)
    adminUI?.setPanelOpen(false)
  }
}

function setAdminPanelOpen(open) {
  adminState.panelOpen = !!open
  layerBtns?.get('admin')?.setPanelOpen(open)
  refreshAdminUI()
}

function toggleAdminInspect() {
  if (adminInteraction.inspecting) adminInteraction.exitInspect()
  else adminInteraction.enterInspect()
}

function focusSelectedAdminRegion() {
  const region = adminInteraction.selected
  if (!region?.ring?.length || !geo) return
  const center = region.selectedAt ?? region.centroid ?? region.ring[Math.floor(region.ring.length / 2)]
  const world = center && lonLatToWorld(geo, center[0], center[1])
  if (!world || !Number.isFinite(world.x)) return
  controls.target.set(world.x, terrain.sample(world.x, world.z), world.z)
  controls.update()
}

adminUI = createAdminBoundaryUI({
  onEnabled: setAdminEnabled,
  onLevel: (level) => { adminInteraction.setLevel(level); refreshAdminUI() },
  onInspect: toggleAdminInspect,
  onCloseSelection: () => adminInteraction.select(null),
  onFocus: focusSelectedAdminRegion,
})

async function loadAdminBoundaries() {
  if (!dem || !geo) return
  const key = currentDemKey()
  if (adminState.demKey === key && adminLayer) { adminLayer.setVisible(true); refreshAdminUI(); return }
  if (adminState.demKey && adminState.demKey !== key) {
    adminState.rings = []
    adminState.regions = []
    adminInteraction.exitInspect()
  }
  adminState.loading = true
  toast.show('区划边界加载中…')
  try {
    // province adcode from the DEM center (one reverse call, explicit toggle)
    const rev = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${dem.lat}&lon=${dem.lon}&format=json&zoom=5&accept-language=zh`).then((r) => r.json())
    const adcode = provinceAdcode(rev?.address)
    if (!adcode) { toast.show('境外区域暂未接入区划边界(仅中国)'); setAdminEnabled(false); return }
    const [outline, full] = await Promise.all([
      adminBoundaryCache.fetchJson(`${DATAV}/${adcode}.json`),
      adminBoundaryCache.fetchJson(`${DATAV}/${adcode}_full.json`),
    ])
    if (key !== currentDemKey()) return // terrain switched mid-load
    // viewport bbox from world corners
    const c1 = worldToLonLat(geo, -TERRAIN_SIZE / 2, -TERRAIN_SIZE / 2)
    const c2 = worldToLonLat(geo, TERRAIN_SIZE / 2, TERRAIN_SIZE / 2)
    const bbox = { minLon: Math.min(c1.lon, c2.lon), maxLon: Math.max(c1.lon, c2.lon), minLat: Math.min(c1.lat, c2.lat), maxLat: Math.max(c1.lat, c2.lat) }
    const outlineRings = extractRings(outline).map((r) => ({ ...r, level: 'province' }))
    const cityRings = extractRings(full).map((r) => ({ ...r, level: 'city' }))
    // drill one level deeper: the prefecture-city containing the DEM center has
    // district-level features in its own _full file (province_full is city-level
    // only — at z12+ a whole city usually CONTAINS the viewport, no boundary crosses)
    let districtRings = []
    const containing = cityRings.find((r) => r.adcode && r.adcode !== adcode && pointInRing(dem.lon, dem.lat, r.ring))
    if (containing) {
      try {
        const cityFull = await adminBoundaryCache.fetchJson(`${DATAV}/${containing.adcode}_full.json`)
        if (key !== currentDemKey()) return
        districtRings = extractRings(cityFull).map((r) => ({ ...r, level: 'district' }))
      } catch { /* district layer optional — province/city still render */ }
    }
    // clip every ring to the viewport bbox — whole province outlines span 10+
    // degrees and bury the visible segment under thousands of off-screen vertices
    const regions = [...outlineRings, ...cityRings, ...districtRings]
    const rings = []
    for (const r of regions) {
      const clipped = clipRingToBbox(r.ring, bbox)
      if (clipped) rings.push({ ...r, ring: clipped })
    }
    if (!adminLayer) {
      adminLayer = createAdminLayer({
        toWorld: (lon, lat) => lonLatToWorld(geo, lon, lat),
        heightAt: (x, z) => terrain.sample(x, z),
        inView: (lon, lat) => lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat,
      })
      scene.add(adminLayer.group)
    }
    adminLayer.setRings(rings)
    adminLayer.setVisible(adminState.on)
    adminState.demKey = key
    adminState.rings = rings
    adminState.regions = regions
    const deepest = findDeepestAdminRegion(regions, dem.lon, dem.lat)
    adminState.breadcrumb = adminBreadcrumb({
      province: rev?.address?.state ?? rev?.address?.province ?? outlineRings[0]?.name,
      city: containing?.name ?? rev?.address?.city,
      district: deepest?.level === 'district' ? deepest.name : rev?.address?.county,
    })
    adminState.cacheStatus = '● 已缓存'
    refreshAdminUI()
    toast.show(`区划边界已加载(${rings.length} 段)`)
  } catch (err) {
    console.warn('admin boundaries failed', err)
    toast.show('区划边界加载失败')
  } finally {
    adminState.loading = false
    refreshAdminUI()
  }
}

// ------------------------------------------------------------------ route planning
let geo = null // makeGeoContext(dem), set in loadRealTerrain
const route = new TripRouteController()
let lastRouteAnalysis = route.analyzeElevation()
const routeDemCoverage = createRouteDemCoverage()
let routeCorridorState = { key: null, status: 'idle', analysis: null, error: null, performance: null }
let waypointElevationState = { key: null, status: 'idle', values: {} }
let routeDemAnalysisController = null
let routeLayer = null
const routeStoreReady = openRouteStore()
  .then((s) => {
    refreshLibrary() // first paint only after IDB is actually open
    return s
  })
  .catch((e) => {
    console.warn('IDB unavailable', e)
    return null // save becomes a visible error, never silent
  })

function elevOfWorld(x, z) {
  const { px, py } = geo.worldToPx(x, z)
  return sampleDem(dem, px, py) // real meters (un-exaggerated)
}

function terrainContains(lon, lat) {
  if (!geo || !dem) return false
  const { px, py } = geo.lonLatToPx(lon, lat)
  return px >= 0 && px <= dem.size - 1 && py >= 0 && py <= dem.size - 1
}

// Waypoint elevation remains wire-compatible while its truth lives in the
// transient route enrichment state. A compatibility placeholder is never
// presented as a measured 0 m value in Plan or Analyze.
function routeMutationElevation(lon, lat, fallback = 0) {
  if (!terrainContains(lon, lat)) return Number.isFinite(fallback) ? fallback : 0
  const { x, z } = lonLatToWorld(geo, lon, lat)
  const elevation = Math.round(elevOfWorld(x, z))
  return Number.isFinite(elevation) ? elevation : (Number.isFinite(fallback) ? fallback : 0)
}

let lastRouteCoverage = { covered: true, outsideCount: 0, total: 0, bounds: null }

function activeRouteCoordinates() {
  const candidate = activeSnapCandidate()
  if (candidate) return candidate.geometry
  return route.waypoints
}

function activeRouteAnalysisGeometry() {
  return activeSnapCandidate()?.geometry ?? null
}

function activeSnapCandidate() {
  if (route.waypointPreviewing || !snapState.on || snapState.version !== snapVersion() || snapState.mode !== route.mode) return null
  const candidate = snapState.alternatives?.[snapState.selectedAlternative]
  return isCurrentRouteCandidate(candidate, { routeId: route.id, geometryRevision: route.geometryRevision, mode: route.mode }) ? candidate : null
}

function clearSnapResult() {
  snapState.geometry = null
  snapState.legs = null
  snapState.alternatives = []
  snapState.selectedAlternative = 0
  snapState.mode = route.mode
  planningPanel?.setRouteAlternatives?.([])
}

function currentRouteAnalysisGeometryKey() {
  const snappedGeometry = activeRouteAnalysisGeometry()
  if (route.waypointPreviewing) return 'preview'
  const candidate = activeSnapCandidate()
  return snappedGeometry ? routeCandidatePathKey({ version: snapState.version, resultId: snapState.resultId, candidate }) : 'raw'
}

function currentRouteCorridorRun() {
  const sourceIdentity = TERRARIUM_SOURCE_ID
  const zoom = Number(params.demZoom)
  const routeId = route.id
  const geometryRevision = route.geometryRevision
  const geometryKey = currentRouteAnalysisGeometryKey()
  return {
    routeId,
    geometryRevision,
    geometryKey,
    sourceIdentity,
    zoom,
    key: createRouteDemRunIdentity({ routeId, geometryRevision, geometryKey, zoom, sourceIdentity }),
  }
}

function createWaypointElevationState(status, values = {}, identity = {}) {
  return {
    key: identity.key ?? currentRouteCorridorRun().key,
    routeId: identity.routeId ?? route.id,
    geometryRevision: identity.geometryRevision ?? route.geometryRevision,
    status,
    values,
  }
}

function publishReadyWaypointElevations(values, identity = {}) {
  const authority = createWaypointElevationState('ready', values, identity)
  if (!route.waypointElevationsReady(authority)) return false
  route.applyWaypointElevations(authority)
  waypointElevationState = authority
  return true
}

function waypointElevationOutputReady() {
  return route.waypointElevationsReady(waypointElevationState)
}

function elevationRecoveryMessage(action) {
  return waypointElevationState.status === 'loading'
    ? `高程仍在补齐，重试后再${action}`
    : `高程暂不可用，重试后再${action}`
}

function requireWaypointElevations(action) {
  if (!route.waypoints.length || waypointElevationOutputReady()) return true
  toast.show(elevationRecoveryMessage(action))
  return false
}

function requireReadyRouteAnalysis(action) {
  if (!requireWaypointElevations(action)) return false
  if (lastRouteAnalysis?.status === 'ready') return true
  const message = lastRouteAnalysis?.status === 'route-terrain-loading'
    ? `路线高程仍在补齐，重试后再${action}`
    : `路线高程暂不可用，重试后再${action}`
  toast.show(message)
  return false
}

function corridorUnavailableStatus(state = routeCorridorState) {
  if (state.status === 'loading') return 'route-terrain-loading'
  if (state.status === 'cancelled') return 'route-terrain-cancelled'
  if (state.error?.code === 'budget-exceeded') return 'route-terrain-budget'
  if (state.status === 'error') return 'route-terrain-unavailable'
  return 'outside-coverage'
}

function invalidateRouteCorridorAnalysis(nextKey) {
  if (routeCorridorState.key === nextKey && waypointElevationState.key === nextKey) return
  if (routeCorridorState.key && routeCorridorState.key !== nextKey) routeDemAnalysisController?.cancel()
  if (routeCorridorState.key !== nextKey) {
    routeCorridorState = {
      key: nextKey,
      status: 'cancelled',
      analysis: null,
      error: null,
      performance: null,
    }
  }
  waypointElevationState = {
    key: nextKey,
    routeId: route.id,
    geometryRevision: route.geometryRevision,
    status: route.waypoints.length ? 'loading' : 'idle',
    values: {},
  }
}

function invalidateRouteCorridorForTerrainRunChange() {
  invalidateRouteCorridorAnalysis(currentRouteCorridorRun().key)
  if (workspaceLifecycle?.stage === WORKFLOW_STAGES.ANALYZE) refreshRoute({ recordHistory: false, fitOverview: false })
}

function reconcileWaypointSelection() {
  route.reconcileSelection()
}

function setTransientRouteSelection(next) {
  const reconciled = reconcileRouteSelection(next, route)
  routeSelection = sameRouteSelection(routeSelection, reconciled) ? null : reconciled
  return routeSelection
}

function setSelectedWaypoint(id) {
  const waypointChanged = route.setSelectedWaypoint(id)
  const previousSelection = routeSelection
  if (isPlanStage()) setTransientRouteSelection(waypointRouteSelection(id))
  if (!waypointChanged && sameRouteSelection(previousSelection, routeSelection)) return false
  refreshRoute({ recordHistory: false, fitOverview: false })
  return true
}

function setSelectedRouteSegment(segmentIndex) {
  const previousSelection = routeSelection
  setTransientRouteSelection(segmentRouteSelection(route, segmentIndex))
  if (sameRouteSelection(previousSelection, routeSelection)) return false
  refreshRoute({ recordHistory: false, fitOverview: false })
  requestAnimationFrame(() => {
    fluidLayout.refresh('summary')
    overviewMap.fit()
  })
  return true
}

function beginWaypointMove(id) {
  let started = false
  runPlanRouteMutation(() => { started = route.beginWaypointMove(id) })
  return started
}

function previewWaypointMove(id, lon, lat) {
  let moved = false
  runPlanRouteMutation(() => {
    if (!route.hasWaypoint(id)) return
    const previousElevation = route.waypoints.find((waypoint) => waypoint.id === id)?.ele
    moved = route.previewWaypointMove(id, { lon, lat, ele: routeMutationElevation(lon, lat, previousElevation) })
    if (moved) refreshRoute({ recordHistory: false, fitOverview: false })
  })
  return moved
}

function commitWaypointMove(id) {
  runPlanRouteMutation(() => {
    if (!route.commitWaypointMove(id)) return
    refreshRoute({ fitOverview: false })
    scheduleSnap()
  })
}

function cancelWaypointMove(id) {
  route.cancelWaypointMove(id)
  refreshRoute({ recordHistory: false, fitOverview: false })
}

function refreshUnavailableRouteAnalysis(coordinates, { recordHistory, fitOverview }) {
  analysisCursorPathKey = ''
  clearAnalysisCursor()
  analysisSegmentSelection = null
  analysisSegmentLegs = []
  routeLayer?.clear()
  lastRoutePts = []
  profileCard?.update(lastRouteAnalysis)
  route.normalizeDayBoundaries()
  if (recordHistory) route.recordHistory()
  updateRouteUI(route, {
    distanceM: route.deriveDistance(coordinates),
    ascentM: null,
    descentM: null,
    maxEle: null,
    minEle: null,
    driveMinutes: null,
  }, [], { fitOverview })
  if (weatherState.result && !weatherMatchesCurrentPath()) invalidateWeatherForDerivedPath()
  if (adminInteraction.selected) scheduleAdminRouteStat()
}

function refreshRoute({ recordHistory = true, fitOverview = true } = {}) {
  reconcileWaypointSelection()
  if (!route.waypointPreviewing) ensureTerrainForRoute()
  const analysisKey = currentRouteCorridorRun().key
  invalidateRouteCorridorAnalysis(analysisKey)
  syncAnalysisFreshness()
  if (!currentCorridorAdjustment()) overviewMap?.setAnalysisSegment(null)
  renderCorridorAdjustment()
  if (!geo || !dem) {
    lastRouteCoverage = { covered: false, outsideCount: route.waypoints.length, total: route.waypoints.length, bounds: null }
    const status = route.waypoints.length < 2
      ? 'incomplete'
      : (demBusy || waypointElevationState.status === 'loading' ? 'route-terrain-loading' : 'dem-unavailable')
    waypointElevationState = createWaypointElevationState(status === 'route-terrain-loading' ? 'loading' : 'unavailable', {}, { key: analysisKey })
    lastRouteAnalysis = { status, points: [], profile: null, stats: null, grade: null }
    refreshUnavailableRouteAnalysis(activeRouteCoordinates(), { recordHistory, fitOverview })
    return
  }
  if (!routeLayer) ensureRouteLayer()
  if (!routeLayer) return
  const coordinates = activeRouteCoordinates()
  lastRouteCoverage = route.waypoints.length >= 2
    ? routeCoverage(geo, coordinates, TERRAIN_SIZE)
    : { covered: true, outsideCount: 0, total: coordinates.length, bounds: null }
  plannerWorkspace?.setCoverage(lastRouteCoverage)
  const localWaypointElevations = route.waypoints.map((waypoint) => [
    waypoint.id,
    terrainContains(waypoint.lon, waypoint.lat) ? routeMutationElevation(waypoint.lon, waypoint.lat, waypoint.ele) : null,
  ])
  if (localWaypointElevations.every(([, elevation]) => Number.isFinite(elevation))) {
    publishReadyWaypointElevations(Object.fromEntries(localWaypointElevations), { key: analysisKey })
  }
  if (lastRouteCoverage.covered && routeCorridorState.key === analysisKey) {
    routeDemAnalysisController?.cancel()
    routeCorridorState = { key: null, status: 'idle', analysis: null, error: null, performance: null }
  }
  if (!lastRouteCoverage.covered) {
    lastRouteAnalysis = routeCorridorState.key === analysisKey && routeCorridorState.status === 'ready'
      ? routeCorridorState.analysis
      : {
          status: corridorUnavailableStatus(),
          points: [],
          profile: null,
          stats: null,
          grade: null,
        }
    if (lastRouteAnalysis.status === 'ready' && applyReadyRouteAnalysis({ recordHistory, fitOverview })) return
    refreshUnavailableRouteAnalysis(coordinates, { recordHistory, fitOverview })
    if (!route.waypointPreviewing) void requestRouteCorridorAnalysis()
    return
  }
  // Raw DEM analysis owns route-point production. Renderers and downstream
  // consumers receive the same immutable-by-convention point set.
  const snappedGeometry = !route.waypointPreviewing && snapState.on && snapState.geometry && snapState.version === snapVersion()
    ? snapState.geometry
    : null
  lastRouteAnalysis = route.analyzeElevation({
    snappedGeometry,
    geo,
    sampleElevation: elevOfWorld,
    coverage: lastRouteCoverage,
  })
  if (lastRouteAnalysis.status === 'ready') {
    publishReadyWaypointElevations(Object.fromEntries(route.waypoints.map((waypoint) => [
      waypoint.id,
      routeMutationElevation(waypoint.lon, waypoint.lat, waypoint.ele),
    ])), { key: analysisKey })
  }
  if (!applyReadyRouteAnalysis({ recordHistory, fitOverview })) {
    refreshUnavailableRouteAnalysis(coordinates, { recordHistory, fitOverview })
    if (!route.waypointPreviewing) void requestRouteCorridorAnalysis()
  }
}

function applyReadyRouteAnalysis({ recordHistory = false, fitOverview = false } = {}) {
  const legacyState = syncRouteAnalysisConsumer(lastRouteAnalysis, {
    render: (points) => routeLayer.update(route.waypoints, {
      slopeColors: params.routeSlopeColors,
      arrows: params.routeArrows,
      ticks: params.routeTicks,
      pathPts: points,
      selectedWaypointId: route.selectedWaypointId,
    }),
  })
  if (legacyState !== 'ready') return false
  const pts = lastRouteAnalysis.points
  const nextAnalysisCursorPathKey = pts.map((point) => `${point.lon.toFixed(6)},${point.lat.toFixed(6)},${point.cumDistM.toFixed(1)}`).join('|')
  if (analysisCursorPathKey && analysisCursorPathKey !== nextAnalysisCursorPathKey) clearAnalysisCursor()
  analysisCursorPathKey = nextAnalysisCursorPathKey
  lastRoutePts = pts
  profileCard?.update(lastRouteAnalysis)
  markAnalysisFreshIfUsable()
  if (!initializeAnalysisCursor(pts)) overviewMap?.setAnalysisCursor({ points: pts, distanceM: analysisCursorDistanceM })
  route.normalizeDayBoundaries() // id-based markers: drop refs to deleted waypoints
  if (recordHistory) route.recordHistory() // safe: dedup no-ops on non-route refreshes
  updateRouteUI(route, lastRouteAnalysis.stats, pts, { fitOverview })
  // Route geometry or the selected provider path changed: no weather result
  // may remain attached to a different derived path.
  if (weatherState.result && !weatherMatchesCurrentPath()) invalidateWeatherForDerivedPath()
  if (adminInteraction.selected) scheduleAdminRouteStat() // route change → recompute L4 stat
  return true
}

let lastRoutePts = []
const analysisFreshness = createAnalysisFreshness()

// snap binds to route IDENTITY + geometryRevision — a rename (revision-only)
// keeps snapped display stable; loading a different route with a colliding
// revision number can never inherit stale geometry.
const snapVersion = () => `${route.id}:${route.geometryRevision}`

// ------------------------------------------------------------------ snap state
// Success-only result cache (WGS-84 geometry); in-flight map dedups concurrent
// identical requests; failures are never cached (public demo has no SLA).
const SNAP_LS = 'trip3d.snapOn'
const SNAP_PROFILE_LS = 'trip3d.snapProfile'
let snapProfile = localStorage.getItem(SNAP_PROFILE_LS) || 'foot'
route.setMode(localStorage.getItem(SNAP_LS) === '1' ? normalizeRouteMode(snapProfile) : 'straight')
const getRouter = () => createRoutingProvider('osrm', { profile: snapProfile })
const snapState = {
  on: route.mode !== 'straight',
  geometry: null,
  legs: null,
  alternatives: [],
  selectedAlternative: 0,
  mode: route.mode,
  version: '',
  resultId: 0,
  requestId: 0,
}
const snapCache = new Map()
const snapInflight = new Map()
const SNAP_CACHE_LIMIT = 24
const snapRequestGate = createSnapRequestGate({ dispatch: runSnap, minIntervalMs: 1100 })

const currentDemKey = () => (dem ? `${dem.lat.toFixed(4)},${dem.lon.toFixed(4)},${dem.zoom}x${dem.tilesAcross}` : '')
const snapRouteKey = (wps) => `osrm:${snapProfile}:` + wps.map((w) => `${w.lon.toFixed(5)},${w.lat.toFixed(5)}`).join('>')

function scheduleSnap() {
  if (!snapState.on) return
  const wps = route.waypoints.map(({ lon, lat }) => ({ lon, lat }))
  const job = {
    key: snapRouteKey(wps),
    version: snapVersion(),
    mode: route.mode,
    wps,
  }
  job.identity = `${job.version}:${job.mode}:${job.key}`
  if (!snapRequestGate.schedule(job)) return
  job.requestId = ++snapState.requestId
  job.requestId = snapState.requestId
  // A new request is a new result boundary even before the response arrives;
  // never leave a prior route choice selectable while its replacement is pending.
  if (snapState.alternatives.length) clearSnapResult()
}

async function runSnap(job, { signal } = {}) {
  if (!snapState.on || job.version !== snapVersion() || job.mode !== route.mode) return
  if (job.wps.length < 2) {
    clearSnapResult()
    snapState.version = snapVersion()
    refreshRoute()
    return
  }
  const cached = snapCache.get(job.key)
  if (cached) { commitSnap(cached, job.version, job.requestId); return }
  planningPanel.setRouteMode(route.mode, routeProviderStatus({ state: 'calculating' }))
  try {
    const result = await snapFetch(job.key, job.wps, { signal })
    if (job.requestId !== snapState.requestId || job.version !== snapVersion()) return
    commitSnap(result, job.version, job.requestId)
  } catch (err) {
    if (err?.code === 'cancelled' || job.requestId !== snapState.requestId) return
    console.warn('snap failed', err)
    clearSnapResult()
    snapState.version = job.version
    planningPanel.setRouteMode(route.mode, routeProviderStatus({ state: 'unavailable' }))
    toast.show('公共路由暂不可用 · 当前为直线示意 · 无时长')
    refreshRoute()
  }
}

// One coalesced route intent is exactly one public-service request. Alternatives
// remain inside that response; NoRoute/timeout/unavailability degrade the whole
// route to the existing truthful straight-line display without retries/fanout.
function snapFetch(key, wps, { signal } = {}) {
  if (snapInflight.has(key)) return snapInflight.get(key)
  const p = (async () => {
    try {
      const r = await getRouter().route(wps, { signal })
      const out = { geometry: r.geometry, legs: r.legs, alternatives: r.alternatives, source: r.source, availability: r.availability }
      snapCache.set(key, out)
      while (snapCache.size > SNAP_CACHE_LIMIT) snapCache.delete(snapCache.keys().next().value)
      return out
    } finally {
      snapInflight.delete(key)
    }
  })()
  snapInflight.set(key, p)
  return p
}

function commitSnap(result, ver, reqId) {
  if (reqId !== snapState.requestId || ver !== snapVersion()) return
  const alternatives = (result.alternatives?.length ? result.alternatives : [result]).slice(0, 2)
    .filter((candidate) => candidate?.geometry?.length >= 2 && Array.isArray(candidate.legs))
    .map((candidate, index) => ({
      ...candidate,
      id: createRouteCandidateId({ routeId: route.id, geometryRevision: route.geometryRevision, mode: route.mode, requestId: reqId, index }),
      routeId: route.id,
      geometryRevision: route.geometryRevision,
      mode: route.mode,
      requestId: reqId,
    }))
  if (!alternatives.length) return
  snapState.alternatives = alternatives
  snapState.selectedAlternative = 0
  snapState.geometry = alternatives[0].geometry
  snapState.legs = alternatives[0].legs
  snapState.mode = route.mode
  snapState.version = ver
  snapState.resultId++
  const routed = alternatives[0].legs.filter((leg) => leg?.real !== false).length
  planningPanel.setRouteMode(route.mode, routeProviderStatus({ routed, total: alternatives[0].legs.length, source: result.source?.label }))
  planningPanel.setRouteAlternatives(alternatives, 0)
  refreshRoute()
}

function selectRouteAlternative(index) {
  const candidate = snapState.alternatives?.[index]
  if (!candidate || !activeSnapCandidate() || candidate.routeId !== route.id || candidate.geometryRevision !== route.geometryRevision || candidate.mode !== route.mode) return
  snapState.selectedAlternative = index
  snapState.geometry = candidate.geometry
  snapState.legs = candidate.legs
  invalidateWeatherForDerivedPath('路线方案已切换，请重新查询沿途天气')
  planningPanel.setRouteAlternatives(snapState.alternatives, index)
  refreshRoute({ recordHistory: false, fitOverview: false })
}

function ensureRouteLayer() {
  if (routeLayer) return
  // getters only: terrain.sample is REPLACED on every rebuild (terrain.js:262),
  // geo/dem are replaced on location switch — never cache them here
  routeLayer = new RouteLayer(
    () => terrain.sample,
    () => geo,
    () => elevOfWorld
  )
  scene.add(routeLayer.group)
}

// ------------------------------------------------------------------ retained layer controls

function setContourVisible(on) {
  params.contourOpacity = on ? 1 : 0
  terrain.mapUniforms.uContourOpacity.value = params.contourOpacity
  reflectLayerSetting('contour', on)
}

function setGridVisible(on) {
  params.gridOpacity = on ? 1 : 0
  terrain.mapUniforms.uGridOpacity.value = params.gridOpacity
  reflectLayerSetting('grid', on)
}

function setLabelsVisible(on) {
  params.labels = !!on
  labels.visible = params.labels
  reflectLayerSetting('labels', params.labels)
}
// ------------------------------------------------------------------ loop

// ------------------------------------------------------------------ ui chrome (rail / panels / workflow stage)
const toast = createToast()
const fluidLayout = createFluidLayout()
const panelHost = createPanelHost({
  onSummaryCustomize: () => toggleSettings(),
})
fluidLayout.register(panelHost.el, {
  id: 'inspector',
  minWidth: 316,
  maxWidth: 520,
  minHeight: 240,
  maxHeight: ({ height }) => Math.max(320, height - 120),
  reserved: { top: 88, right: 0, bottom: 24, left: 88 },
  anchor: 'right',
  dragHandle: panelHost.dragHandle,
  defaultState: ({ width, height }) => ({
    x: width - 360,
    y: 88,
    width: 360,
    height: Math.min(508, height - 112),
  }),
})
let summaryPreferences = loadSummaryPreferences()
const WEATHER_UI_LS = 'trip3d.weatherPreferences.v1'
const normalizeWeatherPreferences = (value = {}) => ({
  hoverCards: value.hoverCards !== false,
  pinCards: value.pinCards !== false,
  temperatureLabels: ['auto', 'always', 'off'].includes(value.temperatureLabels) ? value.temperatureLabels : 'auto',
  transparency: ['system', 'frosted', 'opaque'].includes(value.transparency) ? value.transparency : 'system',
})
let weatherPreferences
try { weatherPreferences = normalizeWeatherPreferences(JSON.parse(localStorage.getItem(WEATHER_UI_LS) ?? '{}')) } catch { weatherPreferences = normalizeWeatherPreferences() }
const saveWeatherPreferences = (value) => {
  weatherPreferences = normalizeWeatherPreferences(value)
  try { localStorage.setItem(WEATHER_UI_LS, JSON.stringify(weatherPreferences)) } catch { /* optional preference */ }
  return weatherPreferences
}
let lastSavedRouteVersion = null
let routeSelection = null

let lastSyncedTripDays = 0 // itinerary→weather days sync guard

function currentLegs(pts) {
  const activeCandidate = activeSnapCandidate()
  const osrmLegs = activeCandidate
    ? normalizeOsrmLegs(activeCandidate.legs, route.waypoints)
    : null
  if (osrmLegs) return osrmLegs
  if (!waypointElevationOutputReady()) return computeHorizontalLegs(route.waypoints)
  return computeLegsFromPts(pts, route.waypoints) ?? (route.waypoints.length >= 2 ? computeLegs(route.waypoints) : null)
}

function updateRouteUI(route, stats, pts, { fitOverview = true } = {}) {
  // legs: real OSRM segments when snap result matches this revision; computed otherwise
  const legs = currentLegs(pts)
  // sunlight analysis: per-leg shade fraction via DEM horizon march
  if (sunState.on && sunState.last && legs?.length && pts?.length >= 2) {
    const idx = route.waypoints.map((w) => {
      let best = 0
      let bd = Infinity
      for (let i = 0; i < pts.length; i++) {
        const d = (pts[i].lon - w.lon) ** 2 + (pts[i].lat - w.lat) ** 2
        if (d < bd) { bd = d; best = i }
      }
      return best
    })
    legs.forEach((l, li) => {
      const slice = pts.slice(idx[li], idx[li + 1] + 1)
      const step = Math.max(1, Math.floor(slice.length / 10))
      const sample = slice.filter((_, i) => i % step === 0)
      l.shade = shadeFraction(sample, sunState.last, (p) => sunBlockedAt(p.lon, p.lat, sunState.last))
    })
  }
  const currentWeather = weatherMatchesCurrentPath() ? weatherState.result : null
  const wxIndex = currentWeather?.index?.overall ?? null
  const wxDays = currentWeather?.agg ?? null
  planningPanel.update(route, stats, legs, wxIndex, snapProfile, wxDays, waypointElevationState)
  weatherPanel?.setRouteContext?.({ route, distanceM: stats?.distanceM })
  // share tab summary mirrors the same data block
  const pd = buildPosterData({
    route, stats, legs,
    weather: currentWeather,
    profile: snapProfile,
  })
  sharePanel.update(`${pd.durationText}(${pd.profileLabel}) · ${pd.distanceText} · ${pd.eleText} · ${pd.waypointText}${pd.weatherIndexText != null ? ` · 天气 ${pd.weatherIndexText}` : ''}`)
  // weather panel days track the itinerary length — only when the count CHANGES
  // (user-picked days must survive unrelated route edits)
  const tripDays = route.dayCount
  if (tripDays !== lastSyncedTripDays) {
    lastSyncedTripDays = tripDays
    weatherPanel.setTripDays?.(tripDays)
  }
  // collapsed panel header still shows live route state; POI tags dim under a route
  const realLegs = legs?.length && legs.every((leg) => leg.real && Number.isFinite(leg.durationS)) ? legs : null
  const wxFlat = wxDays?.flatMap((day) => day?.points ?? []) ?? []
  const summaryData = {
    days: route.dayCount,
    distanceM: stats?.distanceM,
    durationMinutes: realLegs ? realLegs.reduce((sum, leg) => sum + leg.durationS, 0) / 60 : null,
    ascentM: stats?.ascentM,
    descentM: stats?.descentM,
    maxElevationM: stats?.maxEle,
    waypointCount: route.waypoints.length,
    segmentCount: Math.max(0, route.waypoints.length - 1),
    temperatureMin: wxFlat.length ? Math.min(...wxFlat.map((point) => point.tempMin).filter(Number.isFinite)) : null,
    temperatureMax: wxFlat.length ? Math.max(...wxFlat.map((point) => point.tempMax).filter(Number.isFinite)) : null,
    precipitationMm: wxFlat.length ? wxFlat.reduce((sum, point) => sum + (Number(point.precipMm) || 0), 0) : null,
    maxWindKmh: wxFlat.length ? Math.max(...wxFlat.map((point) => point.windMax).filter(Number.isFinite)) : null,
    weatherRiskCount: wxDays?.filter((day) => day.isRain || day.windMax >= 30).length ?? null,
    saved: route.waypoints.length >= 2 ? lastSavedRouteVersion === `${route.id}:${route.revision}` : null,
  }
  panelHost.setSummary(route.waypoints.length
    ? formatSummary(summaryPreferences, summaryData, globalThis.matchMedia?.('(max-width: 1023px)').matches ? 2 : 4)
    : '点击地图添加途经点')
  plannerWorkspace?.setAnalyzeAvailable(routeCanBeAnalyzed(route))
  syncAnalysisFreshness()
  workspaceLifecycle?.reconcile()
  plannerWorkspace?.updateTrip({
    name: route.name,
    dateText: wxDays?.length ? `${wxDays[0].date} — ${wxDays.at(-1).date}` : null,
    saved: summaryData.saved,
  })
  routeSelection = reconcileRouteSelection(routeSelection, route)
  plannerWorkspace?.setJourneySpine({
    route,
    legs: legs ?? [],
    weatherDays: wxDays ?? [],
    selection: workspaceLifecycle?.stage === WORKFLOW_STAGES.PLAN ? routeSelection : null,
  })
  overviewMap?.setWeatherOverlay({ routeRevision: route.revision, weatherRevision: currentWeather ? route.revision : -1, result: currentWeather })
  overviewMap.update(route, pts, currentViewportRect(), {
    fit: fitOverview,
    alternatives: snapState.alternatives,
    selectedAlternative: snapState.selectedAlternative,
    legs: legs ?? [],
  })
  overviewMap.setSelectedWaypoint(route.selectedWaypointId)
  analysisSegmentLegs = legs ?? []
  syncAnalysisSegment()
  const corridorSelection = currentCorridorAdjustment()
  if (corridorSelection) {
    overviewMap.setAnalysisSegment(analysisSegmentForSelection(corridorSelection, route, lastRouteAnalysis?.points, analysisSegmentLegs))
  }
  renderCorridorAdjustment()
}

// ------------------------------------------------------------------ sunlight analysis
// Real-sun drive: date+local time → solar az/el (sun.js) → scene light (placeSun)
// + DEM horizon-march shade fraction per leg (no mesh raycast — too slow at 2M tris).
const sunState = { on: false, minutes: 600, dateISO: new Date().toISOString().slice(0, 10), last: null }

const sunPanel = document.createElement('div')
sunPanel.className = 'ui-sun-panel hidden'
sunPanel.innerHTML = `
  <div class="ttl">☀ 日照分析</div>
  <label class="sun-row">日期 <input type="date" class="sun-date"></label>
  <label class="sun-row">时间 <input type="range" class="sun-time" min="0" max="1439" step="10" value="600"><span class="sun-clock">10:00</span></label>
  <div class="sun-readout">—</div>
  <div class="disclaimer">真实太阳方位驱动光影;遮阴按地形地平线估算</div>
`
document.body.appendChild(sunPanel)
const sunDateEl = sunPanel.querySelector('.sun-date')
const sunTimeEl = sunPanel.querySelector('.sun-time')
const sunClockEl = sunPanel.querySelector('.sun-clock')
const sunReadout = sunPanel.querySelector('.sun-readout')
sunDateEl.value = sunState.dateISO

// DEM horizon march: is the sun at (az,el) blocked by terrain from (lon,lat)?
function sunBlockedAt(lon, lat, sun) {
  if (!geo || !dem || sun.elevation <= 0) return sun.elevation <= 0
  const { px, py } = geo.lonLatToPx(lon, lat)
  if (px < 0 || py < 0 || px > dem.size - 1 || py > dem.size - 1) return false
  const h0 = sampleDem(dem, px, py)
  const az = (sun.azimuth * Math.PI) / 180
  const dpx = Math.sin(az) // east = +px
  const dpy = -Math.cos(az) // north = -py (tile row 0 is north)
  const tanEl = Math.tan((sun.elevation * Math.PI) / 180)
  const mpp = dem.metersPerPixel
  for (let step = 6; step <= 600; step = Math.round(step * 1.45)) {
    const h = sampleDem(dem, px + dpx * step, py + dpy * step)
    if ((h - h0) / (step * mpp) > tanEl + 0.002) return true // terrain above the sun ray
  }
  return false
}

function applySun() {
  if (!sunState.on) return
  const lat = params.demLat
  const lon = params.demLon
  const tz = Math.round(lon / 15) // civil-tz approximation (China +8, US -7 …)
  const utcMs = Date.parse(`${sunState.dateISO}T00:00:00Z`) + (sunState.minutes - tz * 60) * 60000
  const s = sunPosition(lat, lon, new Date(utcMs))
  sunState.last = s
  params.sunAzimuth = ((s.azimuth - 90) + 360) % 360 // scene az 0 = +x(east); solar az 0 = north
  params.sunElevation = Math.max(s.elevation, 1)
  placeSun()
  // night: keep geometry readable with a faint moonlight instead of noon sun
  sun.intensity = params.sunIntensity * (s.elevation > 0 ? Math.min(1, s.elevation / 25 + 0.25) : 0.05)
  const hh = String(Math.floor(sunState.minutes / 60)).padStart(2, '0')
  const mm = String(sunState.minutes % 60).padStart(2, '0')
  sunClockEl.textContent = `${hh}:${mm}`
  sunReadout.textContent = s.elevation <= 0
    ? `夜间(太阳高度 ${s.elevation.toFixed(0)}°)`
    : `方位 ${s.azimuth.toFixed(0)}° · 高度 ${s.elevation.toFixed(0)}° · 遮阴见逐段`
  refreshRoute() // legs pick up shade fractions in updateRouteUI
}

let sunTimer = null
function scheduleApplySun() {
  clearTimeout(sunTimer)
  sunTimer = setTimeout(applySun, 180)
}
sunDateEl.addEventListener('change', () => { sunState.dateISO = sunDateEl.value; scheduleApplySun() })
sunTimeEl.addEventListener('input', () => { sunState.minutes = +sunTimeEl.value; sunClockEl.textContent = `${String(Math.floor(sunState.minutes / 60)).padStart(2, '0')}:${String(sunState.minutes % 60).padStart(2, '0')}`; scheduleApplySun() })

// ------------------------------------------------------------------ weather state
// Results are bound to a route fingerprint + monotonically increasing requestId:
// route edits invalidate the band; slow responses can never overwrite newer state.
const weatherProvider = createOpenMeteoProvider()
const weatherArchiveProvider = createOpenMeteoArchiveProvider()
const weatherState = { revision: -1, pathKey: null, requestId: 0, result: null }

function weatherMatchesCurrentPath() {
  return weatherResultMatchesPath(weatherState, { revision: route.revision, pathKey: currentRouteAnalysisGeometryKey() })
}

function invalidateWeatherForDerivedPath(message = null) {
  weatherState.requestId++
  weatherState.revision = -1
  weatherState.pathKey = null
  weatherState.result = null
  if (message) weatherPanel?.setError(message)
}

async function runWeatherQuery({ dates }) {
  if (!route.waypoints.length) { weatherPanel.setEmptyRoute(); return }
  if (!requireWaypointElevations('查询天气')) {
    weatherPanel.setError(elevationRecoveryMessage('查询天气'))
    return
  }
  const rep = pickRepresentativePoints(route.waypoints)
  const rev = route.revision
  const pathKey = currentRouteAnalysisGeometryKey()
  const reqId = ++weatherState.requestId
  weatherPanel.setLoading(rep)
  weatherState.revision = -1
  weatherState.pathKey = null
  weatherState.result = null
  refreshRoute()
  try {
    const from = dates[0]
    const to = dates[dates.length - 1]
    // beyond the forecast window → ERA5 archive, same trip dates last year
    const today = new Date().toISOString().slice(0, 10)
    const aw = archiveWindow(from, to, today)
    const source = aw ? 'archive' : 'forecast'
    const provider = aw ? weatherArchiveProvider : weatherProvider
    const qFrom = aw?.from ?? from
    const qTo = aw?.to ?? to
    // same-day cache: fingerprint+dates+source → skip the network entirely
    const cacheKey = `trip3d.wx.h1.${routeFingerprint(route)}.${encodeURIComponent(pathKey)}.${from}.${to}.rep.${source}`
    let all = null
    try {
      const hit = localStorage.getItem(cacheKey)
      if (hit) all = JSON.parse(hit)
    } catch { /* cache optional */ }
    if (!all) {
      all = []
      for (const p of rep) {
        const days = await provider.daily(p, qFrom, qTo)
        days.forEach((d, i) => {
          const sourceDate = d.date
          d.date = dates[i] ?? d.date // archive dates → requested trip dates
          if (sourceDate !== d.date && Array.isArray(d.hours)) {
            d.hours = d.hours.map((hour) => ({ ...hour, time: `${d.date}${hour.time.slice(10)}` }))
          }
        })
        all.push(...days)
      }
      try {
        localStorage.setItem(cacheKey, JSON.stringify(all))
        // prune: keep at most 20 weather cache entries
        const keys = Object.keys(localStorage).filter((k) => k.startsWith('trip3d.wx.'))
        if (keys.length > 20) for (const k of keys.slice(0, keys.length - 20)) localStorage.removeItem(k)
      } catch { /* storage full etc. — cache optional */ }
    }
    if (reqId !== weatherState.requestId || rev !== route.revision || pathKey !== currentRouteAnalysisGeometryKey()) return
    const agg = aggregateTripDays(all)
    weatherState.revision = rev
    weatherState.pathKey = pathKey
    weatherState.result = { agg, rep, index: tripIndex(all), source }
    weatherPanel.setResult({ agg, rep, index: tripIndex(all), source })
    refreshRoute() // re-render profile card with the band bound to this fingerprint
  } catch (err) {
    console.warn('weather query failed', err)
    weatherPanel.setError(`天气查询失败:${err.message}(网络不可用或数据窗口不支持)`)
  }
}

const weatherPanel = createWeatherPanel({
  onQuery: runWeatherQuery,
  onPointFocus: (role, pinned) => overviewMap?.focusWeatherPoint(role, { pinned }),
  onRecoverRoute: () => showTab('planning', { forceOpen: true }),
})

function showHourlyWeatherDetails(properties = {}) {
  if (panelHost.currentId !== 'weather') showTab('weather')
  const result = weatherMatchesCurrentPath() ? weatherState.result : null
  const point = result?.rep?.find((candidate) => (candidate.role ?? candidate.name ?? '') === properties.role)
    ?? { role: properties.role ?? '路线天气点' }
  const day = result?.agg?.flatMap((entry) => entry.points ?? []).find((entry) =>
    entry.date === properties.date && entry.point?.lon === point.lon && entry.point?.lat === point.lat)
  weatherPanel.showHourlyDetails({
    point,
    date: properties.date ?? day?.date,
    hours: day?.hours ?? [],
    source: result?.source ?? properties.source ?? 'forecast',
  })
  panelHost.setCollapsed(false)
  if (globalThis.matchMedia?.('(max-width: 1023px)')?.matches) panelHost.setSheetState('full')
}

// ------------------------------------------------------------------ place search
// Explicit trigger only (Enter/button) — Nominatim public instance bans
// autocomplete. 1 req/s client throttle; nominatim primary, photon fallback.
const geocoder = createGeocodeProvider('nominatim')
const geocoderBackup = createGeocodeProvider('photon')
const geocodeSearch = createGeocodeSearchLifecycle({ primary: geocoder, fallback: geocoderBackup })
const searchSession = createSearchSession()
const searchRouteRoles = { startId: null, endId: null }
let searchReqId = 0

async function runSearch(query) {
  query = query?.trim()
  if (!query) return
  const reqId = ++searchReqId
  plannerWorkspace.setSearchSession(searchSession.begin(query))
  const result = await geocodeSearch.search(query)
  if (reqId !== searchReqId || ['cancelled', 'stale'].includes(result.state)) return
  if (result.state === 'unavailable') {
    console.warn('search failed', result.primaryError, result.fallbackError)
    plannerWorkspace.setSearchSession(searchSession.fail())
    toast.show('地点搜索暂不可用，请稍后重试')
    return
  }
  plannerWorkspace.setSearchSession(searchSession.resolve(result.results, result))
}

function flyToLonLat(lon, lat, dist = 8) {
  const { x, z } = lonLatToWorld(geo, lon, lat)
  const y = terrain.sample(x, z)
  flyTo(new THREE.Vector3(x + dist, y + dist * 0.75, z + dist), new THREE.Vector3(x, y, z))
}

async function searchGo(r) {
  if (demBusy || legacyTerrainTools.rebuildState.rebuildPending) { toast.show('地形加载中,稍后再试'); return }
  if (geo && dem) {
    const { px, py } = geo.lonLatToPx(r.lon, r.lat)
    if (px >= 0 && px <= dem.size - 1 && py >= 0 && py <= dem.size - 1) {
      flyToLonLat(r.lon, r.lat)
      return
    }
  }
  toast.show('目标在当前区域外,加载新地形…')
  params.demLat = r.lat
  params.demLon = r.lon
  const gen = terrainGen + 1
  loadRealTerrain()
  const built = await whenTerrainBuilt(gen)
  if (built < gen) { toast.show('加载被更新的操作取代'); return }
  flyToLonLat(r.lon, r.lat)
}

async function searchAssign(r, role) {
  if (role === 'view') {
    await searchGo(r)
    plannerWorkspace.setSearchSession(searchSession.dismiss())
    return
  }
  const ele = routeMutationElevation(r.lon, r.lat)
  let assignment
  if (!runPlanRouteMutation(() => {
    assignment = assignSearchRouteRole({ controller: route, roleIds: searchRouteRoles, role, place: r, elevation: ele })
  })) return
  if (assignment.reason === 'missing-endpoints') { toast.show('请先设置起点和终点，再添加途经点'); return }
  if (!assignment.waypoint) { toast.show('已达途经点上限 32'); return }
  refreshRoute()
  scheduleSnap()
  plannerWorkspace.setSearchSession(searchSession.dismiss())
  const label = role === 'start' ? '已设为起点' : role === 'end' ? '已设为终点' : '已添加途经点'
  toast.show(`${label}:${r.name || '地点'}`)
}

// ------------------------------------------------------------------ amap link interop
// pick DEM view (zoom + tile grid) from route span — wide routes get lower
// zoom AND a wider 5×5 tile grid so the whole route fits the terrain.
// coverage ≈ spanDeg: z8/5×5≈7.0°, z9/5×5≈3.5°, z10/5×5≈1.76°, z11/3×3≈0.53°, z12/3×3≈0.26°
function pickViewForSpan(wps) {
  const lons = wps.map((w) => w.lon)
  const lats = wps.map((w) => w.lat)
  const latMid = lats.reduce((a, b) => a + b, 0) / lats.length
  // circular longitude span (antimeridian-safe): e.g. 179.9→-179.9 spans 0.2°, not 359.8°
  const rawSpan = Math.max(...lons) - Math.min(...lons)
  const lonSpan = rawSpan > 180 ? 360 - rawSpan : rawSpan
  const spanDeg = Math.max(
    lonSpan * Math.cos((latMid * Math.PI) / 180),
    Math.max(...lats) - Math.min(...lats)
  )
  if (spanDeg > 3) return { zoom: 8, tilesAcross: 5 }
  if (spanDeg > 1.5) return { zoom: 9, tilesAcross: 5 }
  if (spanDeg > 0.6) return { zoom: 10, tilesAcross: 5 }
  if (spanDeg > 0.25) return { zoom: 11, tilesAcross: 3 }
  return { zoom: 12, tilesAcross: 3 }
}

let terrainRouteRequestKey = ''
function ensureTerrainForRoute() {
  const waypoints = route.waypoints
  if (!waypoints.length || waypoints.every((waypoint) => terrainContains(waypoint.lon, waypoint.lat))) return false
  const requestKey = `${route.id}:${route.geometryRevision}`
  if (demBusy && terrainRouteRequestKey === requestKey) return false
  terrainRouteRequestKey = requestKey
  params.demLon = waypoints.reduce((sum, waypoint) => sum + waypoint.lon, 0) / waypoints.length
  params.demLat = waypoints.reduce((sum, waypoint) => sum + waypoint.lat, 0) / waypoints.length
  const view = pickViewForSpan(waypoints)
  params.demZoom = view.zoom
  params.tilesAcross = view.tilesAcross
  void loadRealTerrain()
  return true
}

// fit camera to the in-bounds portion of the route after a DEM (re)load
function fitCameraToRoute() {
  const inBounds = route.waypoints
    .map((w) => {
      const { x, z } = lonLatToWorld(geo, w.lon, w.lat)
      const { px, py } = geo.worldToPx(x, z)
      return { x, z, inB: px >= 0 && px <= dem.size - 1 && py >= 0 && py <= dem.size - 1 }
    })
    .filter((p) => p.inB)
  if (!inBounds.length) return
  const xs = inBounds.map((p) => p.x)
  const zs = inBounds.map((p) => p.z)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))
  const dist = Math.max(10, span * 1.8)
  const y = terrain.sample(cx, cz)
  flyTo(new THREE.Vector3(cx + dist * 0.5, y + dist * 0.75, cz + dist * 0.5), new THREE.Vector3(cx, y, cz))
}

async function importAmapLink(urlStr) {
  const parsed = parseAmapLink(urlStr?.trim() ?? '')
  if (!parsed) { toast.show('无法解析:支持 amap.com 行程分享链接'); return }
  const pts = [parsed.from, ...parsed.vias, parsed.to].filter(Boolean)
  if (!pts.length) { toast.show('链接中无有效地点'); return }
  if (demBusy || legacyTerrainTools.rebuildState.rebuildPending) { toast.show('地形加载中,稍后再试'); return }
  snapState.requestId++ // atomic import: void any in-flight snap for the old route
  const cx = pts.reduce((s, p) => s + p.lon, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  let inBounds = false
  if (geo && dem) {
    const { px, py } = geo.lonLatToPx(cx, cy)
    inBounds = px >= 0 && px <= dem.size - 1 && py >= 0 && py <= dem.size - 1
  }
  if (!inBounds) {
    toast.show('加载目标区域地形…')
    params.demLat = cy
    params.demLon = cx
    const view = pickViewForSpan(pts) // wide routes get wider tiles + lower zoom
    params.demZoom = view.zoom
    params.tilesAcross = view.tilesAcross
    const gen = terrainGen + 1
    loadRealTerrain()
    const built = await whenTerrainBuilt(gen)
    if (built < 0) { toast.show('目标区域地形加载失败,未导入'); return }
    if (built < gen) { toast.show('加载被更新的操作取代'); return }
  }
  ensureRouteLayer()
  let added = 0
  let anyOutOfView = false
  if (!runPlanRouteMutation(() => {
    for (const p of pts) {
      const { x, z } = lonLatToWorld(geo, p.lon, p.lat)
      const { px, py } = geo.worldToPx(x, z)
      if (px < 0 || px > dem.size - 1 || py < 0 || py > dem.size - 1) anyOutOfView = true
      const wp = route.addWaypoint(p.lon, p.lat, Math.round(elevOfWorld(x, z)), p.name || `P${route.waypoints.length + 1}`)
      if (wp) added++
    }
  })) return
  refreshRoute()
  scheduleSnap()
  fitCameraToRoute()
  toast.show(`已从高德链接导入 ${added} 个途经点`)
  if (anyOutOfView) setTimeout(() => toast.show('部分点位超出当前地形视野,统计仍含全程(更大范围地形金字塔见 followups)', 3600), 2300)
}

// QR overlay (shared by amap export + share panel): title + QR + copy + close
function showQrOverlay(url, title, copyToast = '链接已复制') {
  const ov = document.createElement('div')
  ov.className = 'ui-qr-overlay'
  const card = document.createElement('div')
  card.className = 'ui-qr-card'
  const ttl = document.createElement('div')
  ttl.className = 'ttl'
  ttl.textContent = title
  const cv = document.createElement('canvas')
  // error-correction fallback for long URLs: M → L; overflow → error toast
  let qr = null
  for (const level of ['M', 'L']) {
    try {
      const q = qrcode(0, level)
      q.addData(url)
      q.make()
      qr = q
      break
    } catch { /* capacity exceeded, try lower correction */ }
  }
  if (!qr) {
    toast.show('链接过长,无法生成二维码(请用复制链接)')
    navigator.clipboard?.writeText(url).catch(() => {})
    return
  }
  const n = qr.getModuleCount()
  const scale = Math.max(3, Math.floor(280 / n))
  cv.width = n * scale
  cv.height = n * scale
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = '#17191b'
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(c * scale, r * scale, scale, scale)
    }
  }
  const lnk = document.createElement('div')
  lnk.className = 'lnk'
  lnk.textContent = url
  const copy = document.createElement('button')
  copy.textContent = '复制链接'
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard optional */ }
    toast.show(copyToast)
  }
  const close = document.createElement('button')
  close.textContent = '关闭'
  close.onclick = () => ov.remove()
  ov.onclick = (e) => { if (e.target === ov) ov.remove() }
  card.append(ttl, cv, copy, close, lnk)
  ov.appendChild(card)
  document.body.appendChild(ov)
}

function exportAmapLink() {
  const url = buildAmapLink(route)
  if (!url) { toast.show('至少 2 个途经点才能生成高德链接'); return }
  showQrOverlay(url, '高德 App 扫码打开此行程', '高德链接已复制')
}

// ------------------------------------------------------------------ poster card
function buildShareUrl() {
  return `${location.origin}${location.pathname}#r=${encodeShare(route, { dem: shareDemContext() })}`
}

function shareDemContext() {
  return dem ?? {
    lat: params.demLat,
    lon: params.demLon,
    zoom: params.demZoom,
    size: params.tilesAcross * 256,
  }
}

const sharePanel = createSharePanel({
  onCopyLink: () => routeActions.onShare(),
  onQr: () => {
    if (route.waypoints.length < 2) { toast.show('先规划线路'); return }
    if (!requireWaypointElevations('保存或分享')) return
    showQrOverlay(buildShareUrl(), '扫码打开此行程', '分享链接已复制')
  },
  onExportGpx: () => routeActions.onExportGpx(),
  onExportAmap: exportAmapLink,
  onDownloadPoster: () => { if (requireReadyRouteAnalysis('生成海报')) void legacyTerrainTools.exportPoster() },
  onFlyover: () => { if (requireReadyRouteAnalysis('生成飞越')) legacyTerrainTools.startFlyover() },
})
sharePanel.update('规划线路后,这里聚合全部分享出口')

const flyOverlay = document.createElement('div')
flyOverlay.className = 'ui-fly-overlay hidden'
flyOverlay.innerHTML = '<div class="fly-card"><div class="ttl">正在录制飞越视频</div><div class="bar"><div class="fill"></div></div><button class="fly-cancel">取消</button></div>'
document.body.appendChild(flyOverlay)

legacyTerrainTools = createLegacyTerrainToolsAdapter({
  getTripSnapshot: () => route.route,
  getPosterSnapshot: () => ({
    route: route.route,
    stats: lastRoutePts.length ? route.deriveStats(lastRoutePts) : null,
    legs: currentLegs(lastRoutePts),
    weather: weatherMatchesCurrentPath() ? weatherState.result : null,
    profile: snapProfile,
  }),
  getFlyoverSnapshot: () => ({ points: lastRoutePts, name: route.name }),
  poster: {
    unavailable: () => toast.show('先规划线路再生成海报'),
    isReady: () => !!dem && !demBusy && legacyTerrainTools?.rebuildState.rebuildPending === false,
    notReady: () => toast.show('地形仍在加载，完成后再生成海报'),
    pending: () => toast.show('正在生成海报…'),
    captureImage: async () => {
      composer.render()
      const image = new Image()
      image.src = renderer.domElement.toDataURL('image/png')
      await image.decode()
      return image
    },
    render: ({ image, ...snapshot }) => renderPoster({ screenshot: image, data: buildPosterData(snapshot), shareUrl: buildShareUrl() }),
    download: (canvas, name) => canvas.toBlob((blob) => {
      if (!blob) { toast.show('海报生成失败'); return }
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${(name || 'route').replace(/[\\/:*?"<>|]/g, '_')}-poster.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 5000)
      toast.show('海报已下载')
    }, 'image/png'),
  },
  flyover: {
    routeInsufficient: () => toast.show('先规划线路再录制'),
    isReady: () => !!dem && !demBusy && legacyTerrainTools?.rebuildState.rebuildPending === false,
    notReady: () => toast.show('地形仍在加载，完成后再录制'),
    isSupported: () => typeof MediaRecorder !== 'undefined',
    unsupported: () => toast.show('当前浏览器不支持视频录制'),
    durationFor: (points) => flyoverDuration(points[points.length - 1].cumDistM, { mPerSec: 400, minS: 12, maxS: 60 }),
    resample: resamplePath,
    ground: (x, z) => terrain.sample(x, z),
    createRecorder: () => new MediaRecorder(renderer.domElement.captureStream(30), {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm',
      videoBitsPerSecond: 6_000_000,
    }),
    captureCamera: () => ({ pos: camera.position.clone(), target: controls.target.clone() }),
    activate: () => { controls.enabled = false; flyOverlay.classList.remove('hidden') },
    deactivate: (previous) => {
      controls.enabled = true
      if (previous) { camera.position.copy(previous.pos); controls.target.copy(previous.target) }
      flyOverlay.classList.add('hidden')
    },
    applyFrame: (path, index, ground) => {
      const frame = cameraFrame(path, index, ground, { height: 2.6, lookAhead: 2, targetLift: 0.35 })
      camera.position.set(frame.pos.x, frame.pos.y, frame.pos.z)
      camera.up.set(0, 1, 0)
      camera.lookAt(frame.target.x, frame.target.y, frame.target.z)
      controls.target.set(frame.target.x, frame.target.y, frame.target.z)
    },
    setProgress: (fraction) => { flyOverlay.querySelector('.fill').style.transform = `scaleX(${fraction.toFixed(3)})` },
    started: (duration) => toast.show(`录制中(${Math.round(duration)}s),可取消`),
    download: (chunks, name) => {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))
      link.download = `${(name || 'route').replace(/[\\/:*?"<>|]/g, '_')}-flyover.webm`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 8000)
      toast.show('飞越视频已下载')
    },
  },
  terrain: {
    showLoading: () => loadingEl.classList.remove('hidden'),
    schedule: (work) => requestAnimationFrame(() => setTimeout(work, 30)),
    rebuild: () => { terrain.rebuild(params); terrain.ensureRoughness(params); regenerateLabels() },
    refreshRoute: () => refreshRoute({ recordHistory: false }),
    reloadAdminIfNeeded: () => {
      if (adminNeedsReload({ enabled: adminState.on, loadedKey: adminState.demKey, currentKey: currentDemKey() })) loadAdminBoundaries()
    },
    refreshStaticShadow: () => { if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true },
    hideLoading: () => loadingEl.classList.add('hidden'),
    resolveWaiters: () => { for (const waiter of terrainWaiters.splice(0)) waiter.res(terrainGen) },
  },
  camera: {
    cancelMotion: () => { tween.active = false },
  },
  requestLegacyFrames,
})
flyOverlay.querySelector('.fly-cancel').onclick = () => legacyTerrainTools.stopFlyover(false)

async function refreshLibrary() {
  const s = await routeStoreReady
  if (s) libraryPanel.setItems(await s.list())
}

function applyRouteModeState(nextMode, { persist = true, refresh = true } = {}) {
  route.setMode(nextMode)
  snapProfile = route.mode === 'car' ? 'car' : 'foot'
  snapState.on = route.mode !== 'straight'
  if (persist) {
    localStorage.setItem(SNAP_LS, snapState.on ? '1' : '0')
    localStorage.setItem(SNAP_PROFILE_LS, snapProfile)
  }
  snapState.version = ''
  snapRequestGate.cancel()
  clearSnapResult()
  snapState.resultId++
  snapState.requestId++
  planningPanel.setRouteMode(route.mode, snapState.on ? '等待路网吸附' : '仅测距；不估算时长')
  if (!refresh) return
  if (snapState.on) scheduleSnap()
  else refreshRoute()
}

const routeActions = {
  onRouteAlternative: (index) => runPlanRouteMutation(() => selectRouteAlternative(index)),
  onMapFocus: () => { panelHost.setSheetState('peek'); overviewMap.focusPlanner?.() },
  onNameChange: (v) => runPlanRouteMutation(() => {
    route.setName(v)
    params.routeName = v
    lastSavedRouteVersion = null
    refreshRoute({ recordHistory: false, fitOverview: false })
  }),
  onDaySelect: ({ startIndex }) => runPlanRouteMutation(() => setSelectedWaypoint(route.waypoints[startIndex]?.id)),
  onUndo: () => runPlanRouteMutation(() => { if (route.undo()) applyRouteModeState(route.mode) }),
  onRedo: () => runPlanRouteMutation(() => { if (route.redo()) applyRouteModeState(route.mode) }),
  onClear: () => runPlanRouteMutation(() => { route.clear(); refreshRoute(); scheduleSnap() }),
  onReverse: () => runPlanRouteMutation(() => { if (route.reverse()) { refreshRoute(); scheduleSnap(); toast.show('已反向') } }),
  onCloseLoop: () => runPlanRouteMutation(() => { if (route.close()) { refreshRoute(); scheduleSnap(); toast.show('已闭环') } else toast.show('已是环线或点位不足') }),
  onToggleDayEnd: (i) => runPlanRouteMutation(() => { if (route.toggleDayBoundary(i)) refreshRoute() }),
  dayNumberAt: (i) => route.dayNumberAt(i),
  onSearch: runSearch,
  onSearchGo: searchGo,
  onImportAmap: importAmapLink,
  onExportAmap: exportAmapLink,
  onWpRemove: (i) => runPlanRouteMutation(() => { route.removeWaypoint(i); refreshRoute(); scheduleSnap() }),
  onWpMove: (i, dir) => runPlanRouteMutation(() => { route.moveWaypoint(i, i + dir); refreshRoute(); scheduleSnap() }),
  onWpMoveTo: (from, to) => runPlanRouteMutation(() => { if (route.moveWaypoint(from, to)) { refreshRoute(); scheduleSnap() } }),
  onWpRename: (i, name) => runPlanRouteMutation(() => { route.renameWaypoint(i, name); refreshRoute() }),
  onInsertAt: (index) => {
    insertIndex = index
    toast.show(`点击地形,新途经点将插入到第 ${index + 1} 位(ESC 取消)`)
  },
  resetInsert: () => { insertIndex = null },
  onRouteMode: (nextMode) => runPlanRouteMutation(() => {
    route.bumpRevision()
    applyRouteModeState(nextMode, { refresh: false })
    route.recordHistory()
    if (snapState.on) scheduleSnap()
    else refreshRoute()
  }),
  onSave: async () => {
    if (!requireWaypointElevations('保存或分享')) return
    const s = await routeStoreReady
    if (!s) { toast.show('本地存储不可用,保存失败'); return }
    await s.save(route)
    lastSavedRouteVersion = `${route.id}:${route.revision}`
    refreshRoute({ recordHistory: false, fitOverview: false })
    await refreshLibrary()
    toast.show(`已保存「${route.name}」`)
    showTab('library')
  },
  onShare: async () => {
    if (!requireWaypointElevations('保存或分享')) return
    const hash = encodeShare(route, { dem: shareDemContext() })
    const url = `${location.origin}${location.pathname}#r=${hash}`
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard may be unavailable */ }
    window.history.replaceState(null, '', `#r=${hash}`)
    toast.show('分享链接已复制')
  },
  onExportGpx: () => {
    if (!requireWaypointElevations('导出 GPX')) return
    const blob = new Blob([routeToGpx(route)], { type: 'application/gpx+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${route.name || 'route'}.gpx`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.show('GPX 已导出')
  },
  onImportGpx: () => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.gpx'
    inp.onchange = async () => {
      try {
        const importedRoute = gpxToRoute(await inp.files[0].text())
        runPlanRouteMutation(() => {
          route.replaceRoute(importedRoute, { resetHistory: false })
          applyRouteModeState('straight', { refresh: false })
          params.routeName = route.name
          ensureRouteLayer()
          route.resetHistory()
          refreshRoute({ recordHistory: false })
          scheduleSnap()
          toast.show(route.downsampled ? `GPX 已导入(抽稀 ${route.originalPointCount}→${route.waypoints.length} 点)` : 'GPX 已导入')
        })
      } catch (err) { toast.show(`GPX 导入失败: ${err.message}`, 3200) }
    }
    inp.click()
  },
}
const planningPanel = createPlanningPanel(routeActions)
profileCard = createProfileCard('#ff4d00')
fluidLayout.register(profileCard.el, {
  id: 'profile',
  minWidth: 520,
  maxWidth: ({ width }) => Math.min(920, width - 200),
  minHeight: 150,
  maxHeight: 360,
  defaultState: ({ width, height }) => ({ x: 116, y: height - 224, width: Math.min(760, width - 232), height: 190 }),
})
planningPanel.setRouteMode(route.mode, snapState.on ? '等待路网吸附' : '仅测距；不估算时长')

let plannerWorkspace
let analysisCursorDistanceM = null
let analysisCursorPathKey = ''
let analysisSegmentSelection = null
let analysisSegmentLegs = []
let analysisSegmentRouteId = ''
let corridorAdjustmentSelection = null
let corridorAdjustmentLayer = null
const segmentComparison = createSegmentComparison()

function syncAnalysisFreshness() {
  plannerWorkspace?.setAnalysisFreshness({ stale: analysisFreshness.isStale(route) })
}

function markAnalysisFreshIfUsable() {
  if (!canMarkAnalysisFresh({
    stage: workspaceLifecycle?.stage,
    analysis: lastRouteAnalysis,
    plannerView: overviewMap?.plannerView,
  })) return false
  analysisFreshness.markAnalyzed(route)
  syncAnalysisFreshness()
  syncSegmentComparison()
  return true
}

function comparisonSegment(selection = segmentComparison.selection) {
  return analysisSegmentForSelection(selection, route, lastRouteAnalysis?.points, analysisSegmentLegs)
}

function syncSegmentComparison() {
  const selection = reconcileRouteSelection(segmentComparison.selection, route)
  const segment = comparisonSegment(selection)
  const state = segmentComparison.observe({
    fingerprint: routeGeometryFingerprint(route),
    selection,
    analysisReady: canMarkAnalysisFresh({
      stage: workspaceLifecycle?.stage,
      analysis: lastRouteAnalysis,
      plannerView: overviewMap?.plannerView,
    }),
    metrics: createSegmentMetrics(segment, lastRouteAnalysis?.points),
  })
  profileCard?.setSegmentComparison(state)
  return state
}

function currentCorridorAdjustment() {
  corridorAdjustmentSelection = reconcileRouteSelection(corridorAdjustmentSelection, route)
  return corridorAdjustmentSelection
}

function renderCorridorAdjustment() {
  const selection = currentCorridorAdjustment()
  const visible = isPlanStage() && !!selection && !!corridorAdjustmentLayer
  corridorAdjustmentLayer?.classList.toggle('hidden', !visible)
  if (!visible) return
  const index = route.waypoints.findIndex((waypoint) => waypoint.id === selection.fromId)
  const from = route.waypoints[index]
  const to = route.waypoints[index + 1]
  corridorAdjustmentLayer.querySelector('[data-corridor-title]').textContent = `调整第 ${index + 1} 段`
  corridorAdjustmentLayer.querySelector('[data-corridor-route]').textContent = `${from.name} → ${to.name}`
  corridorAdjustmentLayer.querySelector('[data-corridor-stale]').hidden = !analysisFreshness.isStale(route)
  corridorAdjustmentLayer.querySelector('[data-corridor-reanalyze]').textContent = analysisFreshness.isStale(route) ? '重新分析' : '返回分析'
}

function endCorridorAdjustment({ fit = true } = {}) {
  corridorAdjustmentSelection = null
  overviewMap?.setAnalysisSegment(null)
  renderCorridorAdjustment()
  if (fit) requestAnimationFrame(() => overviewMap?.fit())
}

function beginCorridorAdjustment(segment) {
  const selection = reconcileRouteSelection(segment?.selection, route)
  if (selection?.kind !== 'segment') return false
  const actualSegment = analysisSegmentForSelection(selection, route, lastRouteAnalysis?.points, analysisSegmentLegs)
  const metrics = createSegmentMetrics(actualSegment, lastRouteAnalysis?.points)
  if (lastRouteAnalysis?.status === 'ready' && !analysisFreshness.isStale(route) && metrics) {
    segmentComparison.begin({ selection, fingerprint: routeGeometryFingerprint(route), metrics })
  } else {
    segmentComparison.clear()
  }
  profileCard?.setSegmentComparison(segmentComparison.value)
  corridorAdjustmentSelection = selection
  if (workspaceLifecycle?.stage !== WORKFLOW_STAGES.PLAN) workspaceLifecycle?.setStage(WORKFLOW_STAGES.PLAN)
  overviewMap?.setAnalysisSegment(actualSegment)
  renderCorridorAdjustment()
  requestAnimationFrame(() => {
    if (!currentCorridorAdjustment() || !overviewMap?.focusRouteSelection({ selection, segment: actualSegment })) {
      endCorridorAdjustment({ fit: false })
      return
    }
    corridorAdjustmentLayer?.querySelector('[data-corridor-title]')?.focus()
  })
  return true
}
function setAnalysisCursor(distanceM) {
  analysisCursorDistanceM = Number.isFinite(distanceM) ? distanceM : null
  profileCard?.setCursorDistance(analysisCursorDistanceM)
  overviewMap?.setAnalysisCursor({ points: lastRouteAnalysis?.points, distanceM: analysisCursorDistanceM })
}
function clearAnalysisCursor() {
  setAnalysisCursor(null)
}
function currentAnalysisSegment() {
  return analysisSegmentForSelection(analysisSegmentSelection, route, lastRouteAnalysis?.points, analysisSegmentLegs)
}
function syncAnalysisSegment() {
  if (analysisSegmentRouteId && analysisSegmentRouteId !== route.id) analysisSegmentSelection = null
  analysisSegmentRouteId = route.id
  analysisSegmentSelection = reconcileRouteSelection(analysisSegmentSelection, route)
  const segment = currentAnalysisSegment()
  profileCard?.setSelectedSegment(segment)
  syncSegmentComparison()
  overviewMap?.setAnalysisSegment(segment)
  return segment
}
function setAnalysisSegment(next, { toggle = false } = {}) {
  const reconciled = reconcileRouteSelection(next, route)
  if (!reconciled || reconciled.kind !== 'segment') return false
  if (toggle && sameRouteSelection(analysisSegmentSelection, reconciled)) {
    analysisSegmentSelection = null
    syncAnalysisSegment()
    return true
  }
  if (sameRouteSelection(analysisSegmentSelection, reconciled)) return false
  analysisSegmentSelection = reconciled
  const segment = syncAnalysisSegment()
  return !!segment
}
function setAnalysisSegmentAtDistance(distanceM, { toggle = false } = {}) {
  const segment = analysisSegmentAtDistance(route, lastRouteAnalysis?.points, analysisSegmentLegs, distanceM)
  return segment ? setAnalysisSegment(segment.selection, { toggle }) : false
}
function stepAnalysisSegment(direction) {
  const segment = adjacentAnalysisSegment(analysisSegmentSelection, route, lastRouteAnalysis?.points, analysisSegmentLegs, direction)
  if (!segment || !setAnalysisSegment(segment.selection)) return false
  setAnalysisCursor(segment.startM)
  return true
}
function clearAnalysisSegment() {
  if (!analysisSegmentSelection) return false
  analysisSegmentSelection = null
  syncAnalysisSegment()
  return true
}
function initializeAnalysisCursor(points = lastRouteAnalysis?.points) {
  const distanceM = initialAnalysisCursorDistance(points, analysisCursorDistanceM)
  if (!Number.isFinite(distanceM)) return false
  if (distanceM === analysisCursorDistanceM) return false
  setAnalysisCursor(distanceM)
  return true
}

function publishRouteCorridorState(state) {
  const currentRun = currentRouteCorridorRun()
  if (state.key !== currentRun.key || state.routeId !== route.id || state.geometryRevision !== route.geometryRevision) return
  if (state.status === 'loading') {
    routeCorridorState = { key: state.key, status: 'loading', analysis: null, error: null, performance: null }
    waypointElevationState = createWaypointElevationState('loading', {}, state)
  } else if (state.status === 'ready') {
    if (!publishReadyWaypointElevations(state.analysis.waypointElevations ?? {}, state)) {
      routeCorridorState = { key: state.key, status: 'error', analysis: null, error: new Error('路线高程不完整'), performance: null }
      waypointElevationState = createWaypointElevationState('unavailable', {}, state)
      refreshRoute({ recordHistory: false, fitOverview: false })
      return
    }
    routeCorridorState = {
      key: state.key,
      status: 'ready',
      analysis: state.analysis,
      error: null,
      performance: {
        tileCount: state.coverage.tileCount,
        newRequests: state.coverage.newRequests,
        decodedBytes: state.coverage.decodedBytes,
        totalDecodeMs: state.coverage.totalDecodeMs,
        maxChunkMs: state.coverage.maxChunkMs,
      },
    }
  } else {
    routeCorridorState = { key: state.key, status: 'error', analysis: null, error: state.error, performance: null }
    waypointElevationState = createWaypointElevationState('unavailable', {}, state)
  }
  refreshRoute({ recordHistory: false, fitOverview: false })
}

routeDemAnalysisController = createRouteDemAnalysisController({
  loadCoverage: (request) => routeDemCoverage.load(request),
  onState: publishRouteCorridorState,
})

function requestRouteCorridorAnalysis({ force = false } = {}) {
  if (!routeDemAnalysisController || route.waypoints.length < 2 || route.waypointPreviewing || lastRouteCoverage.covered || !geo || !dem) return null
  const run = currentRouteCorridorRun()
  if (!force && routeCorridorState.key === run.key && ['loading', 'ready', 'error'].includes(routeCorridorState.status)) return null
  const snappedGeometry = activeRouteAnalysisGeometry()
  const routeSnapshot = route.snapshot()
  const snappedSnapshot = snappedGeometry?.map((coordinate) => [...coordinate]) ?? null
  const geoSnapshot = geo
  const points = sampleRouteAnalysisPath({ route: routeSnapshot, snappedGeometry: snappedSnapshot, geo: geoSnapshot })
  return routeDemAnalysisController.start({
    key: run.key,
    routeId: run.routeId,
    geometryRevision: run.geometryRevision,
    points,
    zoom: run.zoom,
    sourceIdentity: run.sourceIdentity,
    analyze: (coverage) => {
      const analysis = route.analyzeElevation({
        snappedGeometry: snappedSnapshot,
        geo: geoSnapshot,
        sampleElevation: (_x, _z, point) => coverage.sample(point.lon, point.lat),
        coverage: { covered: true, source: 'route-corridor', metersPerPixel: coverage.metersPerPixel },
      }, { route: routeSnapshot })
      return {
        ...analysis,
        waypointElevations: Object.fromEntries(routeSnapshot.waypoints.map((waypoint) => [
          waypoint.id,
          coverage.sample(waypoint.lon, waypoint.lat),
        ]).filter(([, elevation]) => Number.isFinite(elevation))),
      }
    },
  })
}

function retryRouteEnrichment() {
  if (!geo || !dem) {
    ensureTerrainForRoute()
    refreshRoute({ recordHistory: false, fitOverview: false })
    return
  }
  void requestRouteCorridorAnalysis({ force: true })
}

function restoreAnalyzeTerrainView() {
  if (workspaceLifecycle?.stage !== WORKFLOW_STAGES.ANALYZE) return false
  profileCard?.setTerrainState('preparing')
  const actual = workspaceLifecycle.setMapWorkspace({ weather: false })
  if (actual !== '3d') {
    profileCard?.setTerrainState('fallback')
    return false
  }
  profileCard?.setTerrainState('ready')
  markAnalysisFreshIfUsable()
  workspaceLifecycle.fit()
  void requestRouteCorridorAnalysis()
  return true
}

profileCard.setCallbacks({
  onCursorDistance: setAnalysisCursor,
  onSegmentDistance: setAnalysisSegmentAtDistance,
  onSegmentStep: stepAnalysisSegment,
  onSegmentClear: clearAnalysisSegment,
  onAdjustSegment: beginCorridorAdjustment,
  onRetry: retryRouteEnrichment,
  onRetryTerrain: restoreAnalyzeTerrainView,
  onReturnPlan: () => workspaceLifecycle?.setStage(WORKFLOW_STAGES.PLAN),
})
const overviewMap = createOverviewMap({
  terrainExaggeration: params.demExaggeration,
  onTerrainUnavailable: (error) => {
    workspaceLifecycle?.setLegacyFrameModeActive(false)
    if (workspaceLifecycle?.stage !== WORKFLOW_STAGES.ANALYZE) return
    profileCard?.setTerrainState('fallback')
    workspaceLifecycle.continueIn2d({ weather: false })
    markAnalysisFreshIfUsable()
  },
  onJump: (lon, lat) => { if (geo && dem) flyToLonLat(lon, lat, 10) },
  onWaypointSelect: setSelectedWaypoint,
  onWaypointMoveStart: beginWaypointMove,
  onWaypointMove: previewWaypointMove,
  onWaypointMoveEnd: commitWaypointMove,
  onWaypointMoveCancel: cancelWaypointMove,
  onWeatherDetails: showHourlyWeatherDetails,
  onAnalysisCursor: setAnalysisCursor,
  onRouteSelect: ({ segmentIndex, distanceM }) => (isPlanStage()
    ? setSelectedRouteSegment(segmentIndex)
    : setAnalysisSegmentAtDistance(distanceM, { toggle: true })),
  getFitPadding: () => fluidLayout.getSafeArea(),
  onDockAction: (action, open) => {
    if (action !== 'layers') return
    if (isCompactWorkspace()) {
      if (open) openMobileLayers()
      else closeMobileLayers({ restoreInspector: true, restoreFocus: false })
      return
    }
    plannerWorkspace?.setLayersOpen(open)
  },
  onPlanAdd: (lon, lat) => {
    if (!isPlanStage()) return
    const ele = routeMutationElevation(lon, lat)
    let waypoint = null
    runPlanRouteMutation(() => {
      waypoint = insertIndex != null
        ? route.insertWaypoint(insertIndex, lon, lat, ele)
        : route.addWaypoint(lon, lat, ele)
    })
    if (!waypoint) { toast.show('途经点已达上限'); return }
    insertIndex = null
    refreshRoute()
    scheduleSnap()
  },
})
document.body.appendChild(overviewMap.el)
corridorAdjustmentLayer = document.createElement('section')
corridorAdjustmentLayer.className = 'ui-corridor-adjustment hidden'
corridorAdjustmentLayer.setAttribute('aria-label', '路段调整')
corridorAdjustmentLayer.innerHTML = `
  <div><h2 data-corridor-title tabindex="-1">调整路线段</h2><p data-corridor-route></p><p>拖动途经点 · 地图添加 · 切换路线方式</p><p data-corridor-stale hidden>分析已过期 · 路线已变更</p></div>
  <div class="ui-corridor-actions"><button type="button" data-corridor-reanalyze>重新分析</button><button type="button" data-corridor-end>结束聚焦</button></div>
`
corridorAdjustmentLayer.querySelector('[data-corridor-reanalyze]').addEventListener('click', () => {
  const selection = currentCorridorAdjustment()
  const segment = comparisonSegment(selection)
  segmentComparison.observe({
    fingerprint: routeGeometryFingerprint(route),
    selection,
    analysisReady: false,
    metrics: createSegmentMetrics(segment, lastRouteAnalysis?.points),
  })
  segmentComparison.requestReanalysis({ fingerprint: routeGeometryFingerprint(route), selection })
  profileCard?.setSegmentComparison(segmentComparison.value)
  if (selection) analysisSegmentSelection = selection
  endCorridorAdjustment({ fit: false })
  workspaceLifecycle?.setStage(WORKFLOW_STAGES.ANALYZE)
})
corridorAdjustmentLayer.querySelector('[data-corridor-end]').addEventListener('click', () => endCorridorAdjustment())
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !currentCorridorAdjustment()) return
  event.preventDefault()
  endCorridorAdjustment()
})
overviewMap.el.appendChild(corridorAdjustmentLayer)
fluidLayout.register(overviewMap.weatherCard, {
  id: 'weather',
  minWidth: 228,
  maxWidth: 360,
  minHeight: 188,
  maxHeight: 340,
  deferUntilVisible: true,
  defaultState: ({ width }) => ({ x: width - 676, y: 212, width: 248, height: 248 }),
})
overviewMap.setWeatherPreferences(weatherPreferences)
overviewMap.setAdminOverlay({ enabled: adminState.on, rings: filterAdminRings(adminState.rings, adminInteraction.level), selected: adminInteraction.selected })
overviewMap.setWeatherOverlay({ routeRevision: route.revision, weatherRevision: weatherMatchesCurrentPath() ? route.revision : -1, result: weatherMatchesCurrentPath() ? weatherState.result : null })

function expandTerrainToRoute() {
  const fit = fitDemToCoordinates(activeRouteCoordinates(), { currentZoom: params.demZoom })
  if (!fit) {
    toast.show('线路跨度超过单个地形窗口；请拆分线路后再分析', 3600)
    return
  }
  params.demLat = fit.lat
  params.demLon = fit.lon
  params.demZoom = fit.zoom
  params.tilesAcross = fit.tilesAcross
  params.demLocation = 'Custom'
  toast.show('已扩展路线地形范围')
  loadRealTerrain()
}

function enterPlanForEditing() {
  if (workspaceLifecycle?.stage === WORKFLOW_STAGES.ANALYZE) workspaceLifecycle.setStage(WORKFLOW_STAGES.PLAN)
}

function runPlanRouteMutation(mutate) {
  return runRouteMutationInPlan({
    enterPlan: enterPlanForEditing,
    isPlan: () => workspaceLifecycle?.stage === WORKFLOW_STAGES.PLAN,
    mutate,
  })
}

plannerWorkspace = createPlannerWorkspace({
  version: packageMetadata.version,
  onStage: (stage) => {
    closeMobileLayers({ restoreInspector: false, restoreFocus: false })
    if (!workspaceLifecycle?.setStage(stage)) plannerWorkspace.setStage(workspaceLifecycle?.stage ?? WORKFLOW_STAGES.PLAN)
  },
  onSearch: (query) => {
    enterPlanForEditing()
    runSearch(query)
  },
  onSearchSelect: (place) => selectSearchPlace({
    session: searchSession,
    place,
    publish: (snapshot) => plannerWorkspace.setSearchSession(snapshot),
    focus: (lon, lat) => overviewMap.focusPlace(lon, lat),
  }),
  onSearchRole: (role) => searchAssign(searchSession.selected, role),
  onSearchDismiss: ({ restoreFocus = false } = {}) => {
    plannerWorkspace.setSearchSession(searchSession.dismiss())
    if (restoreFocus) plannerWorkspace.focusSearch()
  },
  onSpineExpand: () => {
    showTab('planning', { forceOpen: true })
    requestAnimationFrame(() => overviewMap.fit())
  },
  onSpineDismiss: () => {
    routeSelection = null
    refreshRoute({ recordHistory: false, fitOverview: false })
    requestAnimationFrame(() => overviewMap.fit())
  },
  onMoreAction: (action) => {
    if (action === 'save') routeActions.onSave()
    if (action === 'share') showTab('share')
    if (action === 'import') routeActions.onImportGpx()
    if (action === 'export') routeActions.onExportGpx()
    if (action === 'admin') {
      if (!adminState.on) setAdminEnabled(true)
      setAdminPanelOpen(true)
    }
    if (action === 'settings') toggleSettings()
    if (action === 'help') helpOv.classList.remove('hidden')
    if (action === 'reset-layout') {
      fluidLayout.reset()
      toast.show('面板布局已重置')
      requestAnimationFrame(() => overviewMap.fit())
    }
  },
  onMenuChange: (_menu, open) => {
    if (open && globalThis.matchMedia?.('(max-width: 1023px)')?.matches) panelHost.setSheetState('peek')
  },
})
document.body.appendChild(plannerWorkspace.el)
fluidLayout.register(plannerWorkspace.el.querySelector('.ui-trip-spine'), {
  id: 'summary',
  minWidth: 420,
  maxWidth: ({ width }) => Math.min(820, width - 200),
  minHeight: 78,
  maxHeight: 220,
  defaultState: ({ width, height }) => ({ x: 116, y: height - 118, width: Math.min(560, width - 232), height: 94 }),
})

// 3D terrain world AABB → lon/lat rect for the inset viewport indicator
function currentViewportRect() {
  if (!geo || !dem) return null
  const half = TERRAIN_SIZE / 2
  const nw = worldToLonLat(geo, -half, -half)
  const se = worldToLonLat(geo, half, half)
  return { minLon: Math.min(nw.lon, se.lon), maxLon: Math.max(nw.lon, se.lon), minLat: Math.min(nw.lat, se.lat), maxLat: Math.max(nw.lat, se.lat) }
}
const libraryPanel = createLibraryPanel({
  getCurrent: () => route,
  onSaveCurrent: () => routeActions.onSave?.(),
  onPlan: () => showTab('planning', { forceOpen: true }),
  onLoad: async (id) => {
    const s = await routeStoreReady
    if (!id || !s) return
    const r = await s.load(id)
    if (!r) return
    runPlanRouteMutation(() => {
      route.replaceRoute(r, { resetHistory: false })
      lastSavedRouteVersion = `${r.id}:${r.revision}`
      applyRouteModeState(route.mode, { refresh: false })
      params.routeName = r.name
      ensureRouteLayer()
      route.resetHistory()
      refreshRoute({ recordHistory: false })
      scheduleSnap()
      toast.show(`已加载「${r.name}」`)
    })
  },
  onDelete: async (id) => {
    const s = await routeStoreReady
    if (!id || !s) return
    await s.remove(id)
    refreshLibrary()
    toast.show('已删除')
  },
})

// The coordinator owns the only workflow state: Plan is editable 2D and
// Analyze is read-only 3D. Panels and weather remain destinations/overlays.
workspaceLifecycle = createWorkspaceLifecycleCoordinator({
  getRoute: () => route,
  hasLegacyFrameWork,
  onBlocked: (message) => toast.show(message),
  onStageChange: (stage) => {
    closeMobileLayers({ restoreInspector: false, restoreFocus: false })
    const analyze = stage === WORKFLOW_STAGES.ANALYZE
    profileCard?.setStage(stage)
    profileCard?.setTerrainState(analyze ? 'preparing' : 'ready')
    if (!analyze) {
      clearAnalysisCursor()
      clearAnalysisSegment()
    } else {
      initializeAnalysisCursor()
      syncAnalysisSegment()
    }
    syncAnalysisFreshness()
    document.body.classList.toggle('analyze-operate', analyze)
    plannerWorkspace?.setStage(stage)
    if (analyze) {
      panelHost.hide()
      rail.clearActive()
      restoreAnalyzeTerrainView()
      return
    }
    workspaceLifecycle.setMapWorkspace({ weather: false })
    workspaceLifecycle.fit()
    renderCorridorAdjustment()
  },
  onWorkspaceChange: ({ weather, editing }) => {
    document.body.classList.add('planner-operate')
    document.body.classList.toggle('weather-operate', weather)
    plannerWorkspace.setVisible(true)
    overviewMap.setPlannerMode(true, { editing })
    overviewMap.setWeatherMode(weather, weatherPreferences)
  },
  onPlannerViewRequest: (view) => overviewMap.setPlannerView(view),
  onPlannerViewChange: ({ actual, stage, mapWorkspaceActive }) => {
    document.body.classList.toggle('planner-2d', actual === '2d')
    document.body.classList.toggle('planner-3d', stage === WORKFLOW_STAGES.ANALYZE && actual === '3d')
    overviewMap.update(route, lastRoutePts, currentViewportRect(), { fit: false })
    if (mapWorkspaceActive) overviewMap.resize({ fit: false })
  },
  onWorkspaceSettled: () => requestAnimationFrame(() => {
    overviewMap.resize({ fit: false })
    overviewMap.update(route, lastRoutePts, currentViewportRect(), { fit: false })
  }),
  onFit: () => requestAnimationFrame(() => {
    overviewMap.resize({ fit: false })
    overviewMap.fit()
  }),
})
plannerWorkspace.setAnalyzeAvailable(routeCanBeAnalyzed(route))
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsDrawer?.classList.contains('open')) {
    toggleSettings()
    return
  }
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return // don't hijack form editing
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    runPlanRouteMutation(() => {
      if (route.undo()) { applyRouteModeState(route.mode); toast.show('撤销') }
    })
    return
  }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault()
    runPlanRouteMutation(() => {
      if (route.redo()) { applyRouteModeState(route.mode); toast.show('重做') }
    })
    return
  }
  if (e.key === 'Escape' && insertIndex != null) {
    insertIndex = null // cancel pending insert before exiting planning
    toast.show('已取消插入')
    return
  }
  if (adminInteraction.handleKey(e.key)) {
    renderer.domElement.style.cursor = ''
    adminLayer?.setHovered(null)
    return
  }
  if (e.key === 'Escape' && panelHost.currentId) {
    if (panelHost.currentId === 'weather') setWeatherWorkspace(false)
    panelHost.hide()
    rail.clearActive()
    workspaceLifecycle.setMapWorkspace({ weather: false })
  }
})

function showTab(id, { forceOpen = false } = {}) {
  if (panelHost.currentId === 'layers') closeMobileLayers({ restoreInspector: false, restoreFocus: false })
  if (settingsDrawer?.classList.contains('open')) setSettingsOpen(false, { restoreFocus: false })
  if (panelHost.currentId === id && !forceOpen) {
    if (id === 'weather') setWeatherWorkspace(false)
    panelHost.hide()
    rail.clearActive()
    workspaceLifecycle.setMapWorkspace({ weather: false })
    return
  }
  if (id === 'planning') {
    setWeatherWorkspace(false)
    enterPlanForEditing()
    panelHost.show('planning', '规划行程', 'ESC 退出', planningPanel.el)
    panelHost.setCollapsed(false)
    rail.setActive('planning')
    requestAnimationFrame(() => {
      fluidLayout.refresh('inspector')
      overviewMap.fit()
    })
    return
  }
  setWeatherWorkspace(id === 'weather')
  panelHost.setCollapsed(false)
  rail.setActive(id)
  if (id === 'library') { refreshLibrary(); panelHost.show('library', '线路库', null, libraryPanel.el) }
  if (id === 'weather') panelHost.show('weather', '沿途天气', 'ESC 退出', weatherPanel.el)
  if (id === 'share') panelHost.show('share', '留存与分享', null, sharePanel.el)
}

function setWeatherWorkspace(on) {
  workspaceLifecycle.setMapWorkspace({ weather: !!on })
}

const rail = createRail({
  items: [
    { id: 'planning', icon: 'planning', label: '规划', onSelect: () => showTab('planning') },
    { id: 'library', icon: 'library', label: '线路库', onSelect: () => showTab('library') },
    { id: 'weather', icon: 'weather', label: '天气', badge: null, disabled: false, onSelect: () => showTab('weather') },
  ],
  settingsItem: {
    id: 'utility', icon: 'more', label: '更多', onSelect: () => {
      const open = !plannerWorkspace.moreOpen
      plannerWorkspace.setMoreOpen(open)
    },
  },
})

const helpOv = document.createElement('div')
helpOv.className = 'ui-help-overlay hidden'
helpOv.innerHTML = `<div class="ui-help-card">
  <div class="ttl">快捷键与手势</div>
  <div class="row"><b>点击地形</b> 添加途经点(Plan 阶段)</div>
  <div class="row"><b>拖拽标记</b> 移动途经点位置</div>
  <div class="row"><b>双击名字</b> 重命名途经点</div>
  <div class="row"><b>Ctrl+Z / Ctrl+Y</b> 撤销 / 重做</div>
  <div class="row"><b>ESC</b> 关闭当前面板 / 取消插入</div>
  <div class="row"><b>行间 ⊕</b> 在该段后插入途经点</div>
  <button class="close">关闭</button>
</div>`
document.body.appendChild(helpOv)
helpOv.querySelector('.close').onclick = () => helpOv.classList.add('hidden')
helpOv.onclick = (e) => { if (e.target === helpOv) helpOv.classList.add('hidden') }

// data attribution (compliance: OSM ODbL / FOSSGIS / Open-Meteo CC-BY / Mapzen tiles)
const attrib = document.createElement('div')
attrib.className = 'ui-attrib'
attrib.innerHTML =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · ' +
  'search <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer">Nominatim</a> · ' +
  'routing <a href="https://map.project-osrm.org/about.html" target="_blank" rel="noreferrer">OSRM/FOSSGIS</a> · ' +
  'weather <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · ' +
  'elevation <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Mapzen Terrarium</a>'
document.body.appendChild(attrib)

function layerSettingsSnapshot() {
  const fallback = {
    contour: params.contourOpacity > 0,
    grid: params.gridOpacity > 0,
    labels: !!params.labels,
    mapov: !!params.mapOverlay,
    admin: !!adminState.on,
    sun: !!sunState.on,
  }
  for (const id of Object.keys(fallback)) fallback[id] = layerBtns?.get(id)?.isOn() ?? fallback[id]
  return fallback
}

function syncSettingsControls() {
  settingsPanel?.sync({ params, layers: layerSettingsSnapshot() })
}

function reflectLayerSetting(id, on) {
  layerBtns?.get(id)?.set(!!on)
  syncSettingsControls()
}

function applyNativeSetting(key, value, { commit = true } = {}) {
  if (['demLat', 'demLon', 'demZoom', 'demExaggeration', 'exposure', 'contrast', 'saturation', 'fogNear', 'fogFar'].includes(key)) value = Number(value)
  if (key === 'demLocation') {
    params.demLocation = value
    const preset = DEM_PRESETS[value]
    if (preset) {
      params.demLat = preset[0]
      params.demLon = preset[1]
      loadRealTerrain()
    }
  } else if (key === 'demLat' || key === 'demLon') {
    params[key] = value
    params.demLocation = 'Custom'
  } else if (key === 'demZoom') {
    params.demZoom = value
    invalidateRouteCorridorForTerrainRunChange()
    loadRealTerrain()
  } else if (key === 'demExaggeration') {
    params.demExaggeration = value
    overviewMap?.setTerrainExaggeration(value)
    if (commit) legacyTerrainTools.rebuildTerrain()
  } else if (['routeSlopeColors', 'routeArrows', 'routeTicks'].includes(key)) {
    params[key] = !!value
    refreshRoute()
  } else if (key === 'exposure') {
    params.exposure = value
    exposureFx.uniforms.get('exposure').value = value
  } else if (key === 'contrast') {
    params.contrast = value
    contrastFx.uniforms.get('contrast').value = value
  } else if (key === 'saturation') {
    params.saturation = value
    hueSat.saturation = value
  } else if (key === 'fogNear') {
    params.fogNear = value
    scene.fog.near = value
  } else if (key === 'fogFar') {
    params.fogFar = value
    scene.fog.far = value
  }
  syncSettingsControls()
}

function applyNativeLayer(id, on) {
  layerBtns?.get(id)?.set(!!on, { notify: true })
  syncSettingsControls()
}

function loadCurrentSettingsTerrain() { loadRealTerrain() }

// Mount settings only while the drawer is open.
const settingsDrawer = document.createElement('div')
settingsDrawer.className = 'ui-settings'
settingsDrawer.setAttribute('role', 'dialog')
settingsDrawer.setAttribute('aria-label', '显示与地形设置')
settingsDrawer.setAttribute('aria-hidden', 'true')
settingsDrawer.inert = true
document.body.appendChild(settingsDrawer)
let settingsReturnFocus = null

function mountSettingsPanel() {
  if (settingsPanel?.el?.isConnected) return
  settingsPanel = createSettingsPanel({
    presets: Object.keys(DEM_PRESETS),
    summaryPreferences,
    weatherPreferences,
    density: uiDensity,
    onClose: () => setSettingsOpen(false),
    onSetting: applyNativeSetting,
    onLayer: applyNativeLayer,
    onLoad: loadCurrentSettingsTerrain,
    onSummaryPreferences: (next) => {
      summaryPreferences = saveSummaryPreferences(next)
      if (routeLayer && geo && dem) refreshRoute({ recordHistory: false, fitOverview: false })
    },
    onWeatherPreferences: (next) => {
      saveWeatherPreferences(next)
      overviewMap.setWeatherPreferences(weatherPreferences)
    },
    onDensity: (next) => {
      uiDensity = applyDensity(saveDensity(next))
      requestAnimationFrame(() => {
        fluidLayout.refresh('inspector')
        overviewMap.resize({ fit: false })
      })
    },
  })
  settingsDrawer.appendChild(settingsPanel.el)
  syncSettingsControls()
}

function setSettingsOpen(open, { restoreFocus = true } = {}) {
  document.body.classList.toggle('settings-open', !!open)
  if (open) {
    settingsReturnFocus = document.activeElement
    mountSettingsPanel()
    workspaceLifecycle.setMapWorkspace({ weather: false })
    plannerWorkspace.setLayersOpen(false)
    overviewMap.setLayersOpen(false)
    if (panelHost.currentId && panelHost.currentId !== 'planning') {
      panelHost.hide()
      rail.clearActive()
    }
    syncSettingsControls()
  }
  setDrawerOpen(settingsDrawer, open, restoreFocus ? settingsReturnFocus : null)
  if (!open) settingsPanel = null
}

function toggleSettings() {
  const open = !settingsDrawer.classList.contains('open')
  setSettingsOpen(open)
}

// High-frequency layer toggles use the same native setters as the settings drawer.
layerBtns = createLayerButtons({
  buttons: [
    { id: 'mapov', group: 'base', icon: 'roads', tip: '路网', initial: params.mapOverlay, onToggle: (id, on) => { params.mapOverlay = on; terrain.setOverlayMix(on ? 0.55 : 0) } },
    { id: 'contour', group: 'overlay', icon: 'contour', tip: '等高线', initial: params.contourOpacity > 0, onToggle: (id, on) => setContourVisible(on) },
    { id: 'grid', group: 'overlay', icon: 'grid', tip: '测量网格', initial: params.gridOpacity > 0, onToggle: (id, on) => setGridVisible(on) },
    { id: 'labels', group: 'overlay', icon: 'labels', tip: '山峰标签', initial: params.labels, onToggle: (id, on) => setLabelsVisible(on) },
    { id: 'admin', group: 'overlay', icon: 'admin', tip: '行政区划', initial: false, repeatOpensPanel: true, onToggle: (id, on) => setAdminEnabled(on), onPanelToggle: (id, open) => setAdminPanelOpen(open) },
    { id: 'sun', group: 'overlay', icon: 'sun', tip: '日照分析', initial: false, onToggle: (id, on) => { sunState.on = on; sunPanel.classList.toggle('hidden', !on); document.body.classList.toggle('sun-open', on); if (on) applySun() } },
  ],
  onStateChange: syncSettingsControls,
})
plannerWorkspace.attachLayers({ trigger: overviewMap.layerToggle, surface: layerBtns.el })
syncSettingsControls()

// restore shared route from URL hash BEFORE the default DEM load below.
// Decode first so the single startup load fetches the shared center.
if (location.hash.startsWith('#r=')) {
  try {
    const shared = decodeShare(location.hash.slice(3))
    params.demLat = shared.dem.lat
    params.demLon = shared.dem.lon
    params.demZoom = shared.dem.zoom
    if (shared.dem.ta) params.tilesAcross = shared.dem.ta // wide-view grids ride along
    params.demLocation = 'Custom'
    route.reset(shared.name, shared.mode, { resetHistory: false })
    applyRouteModeState(route.mode, { persist: false, refresh: false })
    params.routeName = shared.name
    for (const w of shared.waypoints) route.addWaypoint(w.lon, w.lat, w.ele, w.name)
    if (shared.days?.length) route.setDayBoundaries(shared.days.map((i) => route.waypoints[i]?.id).filter(Boolean))
    route.resetHistory()
    // Plan entry starts route-centered terrain enrichment without blocking restore.
  } catch (err) {
    console.warn('bad share hash', err)
  }
}

workspaceLifecycle.setMapWorkspace({ weather: false })
if (!dem) loadRealTerrain()
ensureRouteLayer()
refreshRoute({ fitOverview: false })

// console access for debugging/scripting
window.__exp = { scene, camera, controls, params, terrain, loadRealTerrain, loadAdminBoundaries, expandTerrainToRoute, plannerWorkspace, overviewMap, get renderStats() { const frames = workspaceLifecycle?.frameScheduler; return { legacyFps: fps, legacyFrames: frames?.frameCount ?? 0, legacyFrameLoopRunning: frames?.running ?? false, plannerTerrain: overviewMap.terrainState } }, get routeCoverage() { return lastRouteCoverage }, get routeAnalysis() { return lastRouteAnalysis }, get routeDemCoverage() { return { state: routeCorridorState, cache: routeDemCoverage.stats() } }, get terrainState() { return { demBusy, demRequestId, ...legacyTerrainTools.rebuildState, terrainGen } }, get routingState() { return { on: snapState.on, profile: snapProfile, version: snapState.version, resultId: snapState.resultId } }, get adminState() { return adminState }, get adminInteraction() { return adminInteraction }, get adminLayer() { return adminLayer }, get labels() { return labels }, get route() { return route.route }, get geo() { return geo }, get dem() { return dem } }

// Real world is the default source. A restored Plan route may already have
// started the same background load through refreshRoute().
if (!demBusy) loadRealTerrain()

route.resetHistory() // baseline for undo/redo (after any hash restore above)

// after first build: restore snap toggle UI + re-snap a hash-restored route
whenTerrainBuilt(1).then(() => {
  planningPanel.setRouteMode(route.mode, snapState.on ? '等待路网吸附' : '仅测距；不估算时长')
  if (snapState.on && route.waypoints.length >= 2) scheduleSnap()
})

const clock = new THREE.Clock()

function hasLegacyFrameWork() { return legacyTerrainTools.flyoverActive || tween.active }

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05)
  document.body.classList.toggle('focus-mode', legacyTerrainTools.flyoverActive)
  if (legacyTerrainTools.tickFlyover(dt)) {
    // Flyover camera/recording state remains inside the adapter.
  } else if (tween.active) {
    tween.t = Math.min(1, tween.t + dt / params.flyDuration)
    const e = EASINGS[params.flyEasing](tween.t)
    camera.position.lerpVectors(tween.p0, tween.p1, e)
    controls.target.lerpVectors(tween.t0, tween.t1, e)
    camera.lookAt(controls.target)
    if (tween.t >= 1) tween.active = false
  } else {
    controls.update()
  }

  // refresh camera matrices NOW so DOM projections match this frame's render
  // (otherwise labels are projected with last frame's matrices and lag behind)
  camera.updateMatrixWorld()
  dof.cocMaterial.worldFocusDistance = params.focusDistance
  fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05

  if (!workspaceLifecycle?.mapWorkspaceActive || legacyTerrainTools.flyoverActive) composer.render(dt)
  workspaceLifecycle?.settleLegacyFrames()
}

workspaceLifecycle.attachFrameScheduler(createFrameScheduler({ onFrame: tick }))

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  routeLayer?.setResolution(window.innerWidth, window.innerHeight)
  overviewMap.resize()
})
