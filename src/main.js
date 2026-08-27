import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import GUI from 'lil-gui'
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
import { Terrain } from './terrain.js'
import { createCone } from './cone.js'
import { createLabels, disposeLabels } from './labels.js'
import { createHud3D, findPois } from './hud3d.js'
import { createHud2D } from './hud2d.js'
import { loadDem, sampleDem } from './dem.js'
import { makeGeoContext, worldToLonLat, lonLatToWorld, TERRAIN_SIZE } from './lib/geo.js'
import { createOverviewMap } from './ui/overviewMap.js'
import { createPlannerWorkspace } from './ui/plannerWorkspace.js'
import { setDrawerOpen } from './ui/drawer.js'
import { createAdminLayer } from './ui/adminLayer.js'
import { provinceAdcode, extractRings, clipRingToBbox, pointInRing } from './lib/adminBoundaries.js'
import { createAdminBoundaryCache } from './lib/adminBoundaryCache.js'
import { filterAdminRings, adminBreadcrumb, adminEmptyMessage, adminNeedsReload, findDeepestAdminRegion, createAdminInteractionState } from './lib/adminInteraction.js'
import { computeRegionRouteStats, formatRouteStats } from './lib/adminRouteStats.js'
import { createAdminBoundaryUI } from './ui/adminPanel.js'
import { createSharePanel, renderPoster } from './ui/sharePanel.js'
import { buildPosterData } from './lib/poster.js'
import { createRoute, addWaypoint, insertWaypoint, removeWaypoint, moveWaypoint, reverseWaypoints, closeLoop, toggleDayEnd, normalizeDayEnds, dayNumberAt, routeStats, routeFingerprint } from './lib/route.js'
import { analyzeRouteElevation, syncRouteAnalysisConsumer } from './lib/routeAnalysis.js'
import { initialAnalysisCursorDistance } from './lib/analysisCursor.js'
import { sunPosition, shadeFraction } from './lib/sun.js'
import { resamplePath, flyoverDuration, cameraFrame } from './lib/flyover.js'
import { createHistory } from './lib/history.js'
import { computeLegs, computeLegsFromPts, normalizeOsrmLegs } from './lib/legs.js'
import { RouteLayer } from './route/RouteLayer.js'
import { openRouteStore } from './lib/store.js'
import { routeToGpx, gpxToRoute } from './lib/gpx.js'
import { encodeShare, decodeShare } from './lib/share.js'
import { createModeMachine, MODES } from './ui/mode.js'
import { createRail, createPanelHost, createLayerButtons, createToast } from './ui/chrome.js'
import { iconSvg } from './ui/icons.js'
import { createPlanningPanel, createLibraryPanel, createProfileCard } from './ui/panels.js'
import { createWeatherPanel } from './ui/weatherPanel.js'
import { createSettingsPanel } from './ui/settingsPanel.js'
import { formatSummary, loadSummaryPreferences, saveSummaryPreferences } from './ui/summaryPreferences.js'
import { createOpenMeteoProvider, createOpenMeteoArchiveProvider } from './providers/openmeteo.js'
import { createGeocodeProvider } from './providers/geocode.js'
import { createRoutingProvider } from './providers/routing.js'
import { joinGeometries, snapCacheKey } from './lib/snap.js'
import { parseAmapLink, buildAmapLink } from './lib/amapLink.js'
import qrcode from 'qrcode-generator'
import { pickRepresentativePoints, aggregateTripDays, archiveWindow } from './lib/weather.js'
import { tripIndex } from './lib/tripIndex.js'
import { fitDemToCoordinates, normalizeRouteMode, routeCoverage, routeDistanceMeters } from './lib/routePlanning.js'
import { createFrameScheduler } from './lib/frameScheduler.js'
import { createWorkflowStage, routeCanBeAnalyzed, WORKFLOW_STAGES } from './ui/workflowStage.js'
import { runRouteMutationInPlan } from './ui/routeMutationGuard.js'

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
  source: 'real',
  demLocation: '四姑娘山 / 双桥沟',
  demLat: 31.108,
  demLon: 102.884,
  demZoom: 12,
  tilesAcross: 3,
  demExaggeration: 1.6,
  planning: false,
  routeName: '未命名线路',
  routeSlopeColors: true,
  routeArrows: true,
  routeTicks: true,

  // terrain generation
  seed: 7,
  scale: 0.055,
  octaves: 6,
  lacunarity: 2.2,
  gain: 0.55,
  amplitude: 1.8,
  warp: 2.0,
  detail: 0.0,
  detailScale: 1.9,
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
  autoFocus: true,
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

  // HUD
  hud: false,
  hudOpacity: 1,
  uiBlur: 9,
  uiBgOpacity: 0.4,
  hudAccent: '#ff4d00',
  hudInk: '#17191b',
  sweepSpeed: 2.5,
  scanColor: '#ccd6ff',
  scanDuration: 4.6,
  scanWidth: 0.8,
  scanBlur: 0.86,
  scanDispHeight: 1.16,
  scanDispFalloff: 1.2,

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
  surveyLines: true,

  // motion
  coneSpin: 0,
  coneTilt: 0,
  coneDrift: 0,
  bob: 0,
  ringSpeed: 1.0,
  flyDuration: 1.8,
  flyEasing: 'smooth',
  paused: false,

  // tour
  tourFrom: 'PK-01',
  tourTo: 'PK-02',
  tourDuration: 14,
  tourAltitude: 2.5,
  tourSmoothing: 0.7,
  tourLook: 0.1,
  tourBank: 0.8,

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
sun.shadow.mapSize.set(2048, 2048)
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

function applyShadowMode() {
  sun.castShadow = params.shadowMode !== 'off'
  renderer.shadowMap.autoUpdate = params.shadowMode === 'dynamic'
  if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
}

// ------------------------------------------------------------------ world

const terrain = new Terrain(params)
scene.add(terrain.mesh)

const cone = createCone()
scene.add(cone.group)

const labelOpts = () => ({ real: params.source === 'real', toFeet: (h) => terrain.heightToFeet(h) })
let labels = createLabels(terrain.sample, params.seed, labelOpts())
labels.visible = params.labels
scene.add(labels)

function regenerateLabels() {
  scene.remove(labels)
  disposeLabels(labels)
  labels = createLabels(terrain.sample, params.seed, labelOpts())
  labels.visible = params.labels
  scene.add(labels)
}

// ------------------------------------------------------------------ HUD + interactivity

const HOME = { pos: new THREE.Vector3(0, 18, 19), target: new THREE.Vector3(0, -0.3, 0) }
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
let selectedPoi = -1
let fps = 60
let scanStart = -1
let legacyFrameLoop = null
let legacyFrameModeActive = false
let legacyFrameStartPending = false

function requestLegacyFrames() {
  if (legacyFrameLoop) legacyFrameLoop.start()
  else legacyFrameStartPending = true
}

function setLegacyFrameModeActive(on) {
  legacyFrameModeActive = !!on
  if (legacyFrameModeActive) requestLegacyFrames()
  else if (!hasLegacyFrameWork()) legacyFrameLoop?.stop()
}

const poiFeet = (h) => terrain.heightToFeet(h)
let pois = findPois(terrain.sample, params.seed, poiFeet)
let hud3 = createHud3D(params.seed, pois, { ink: params.hudInk, accent: params.hudAccent })
hud3.lines.visible = params.surveyLines
scene.add(hud3.group)

function flyTo(pos, target) {
  tour.active = false // programmatic fit wins over an in-flight tour (review P1)
  camera.up.set(0, 1, 0)
  tween.p0.copy(camera.position)
  tween.t0.copy(controls.target)
  tween.p1.copy(pos)
  tween.t1.copy(target)
  tween.t = 0
  tween.active = true
  requestLegacyFrames()
}

// pose to restore when a selection is closed: wherever the camera was pre-click
const returnPose = { saved: false, pos: new THREE.Vector3(), target: new THREE.Vector3() }

// ------------------------------------------------------------------ tour mode

// One continuous Catmull-Rom spline: current camera pose → above the FROM poi →
// arc across the terrain → standoff short of the TO poi. Sampled by ARC LENGTH
// (uniform speed), driven by a trapezoidal velocity profile, with all rotation
// going through a damped "gimbal" controller so snaps are impossible.

const TOUR_N = 240
const tour = {
  active: false,
  t: 0,
  bank: 0,
  uA: 0.2, // arc-length fraction where the path passes over the FROM poi
  curve: null,
  aTop: new THREE.Vector3(),
  bTop: new THREE.Vector3(),
}
const _tp = new THREE.Vector3()
const _tg = new THREE.Vector3()
const _tt0 = new THREE.Vector3()
const _tt1 = new THREE.Vector3()
const _tm = new THREE.Matrix4()
const _tq = new THREE.Quaternion()
const _tqr = new THREE.Quaternion()
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const UP = new THREE.Vector3(0, 1, 0)

function boxBlur(arr, radius, passes = 1) {
  let a = arr
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(a.length)
    for (let i = 0; i < a.length; i++) {
      let s = 0
      let c = 0
      for (let j = Math.max(0, i - radius); j <= Math.min(a.length - 1, i + radius); j++) {
        s += a[j]
        c++
      }
      out[i] = s / c
    }
    a = out
  }
  return a
}

// trapezoidal velocity: accelerate → cruise at constant speed → decelerate
function trapezoid(t, r) {
  t = THREE.MathUtils.clamp(t, 0, 1)
  if (t < r) return (t * t) / (2 * r * (1 - r))
  if (t > 1 - r) {
    const u = 1 - t
    return 1 - (u * u) / (2 * r * (1 - r))
  }
  return (t - r / 2) / (1 - r)
}

function startTour() {
  const A = pois.find((p) => p.id === params.tourFrom)
  const B = pois.find((p) => p.id === params.tourTo)
  if (!A || !B || A === B) return

  // ground path A → standoff short of B (ending on B itself would degenerate
  // to a vertical view), arced sideways for a more interesting line
  const a = new THREE.Vector3(A.x, 0, A.z)
  const bFull = new THREE.Vector3(B.x, 0, B.z)
  const dist = a.distanceTo(bFull)
  const dirAB = bFull.clone().sub(a).normalize()
  const b = bFull.clone().addScaledVector(dirAB, -Math.min(7, dist * 0.4))
  const mid = a.clone().add(b).multiplyScalar(0.5)
  mid.addScaledVector(new THREE.Vector3(-dirAB.z, 0, dirAB.x), dist * 0.22)

  const px = new Float32Array(TOUR_N)
  const pz = new Float32Array(TOUR_N)
  const ground = new Float32Array(TOUR_N)
  for (let i = 0; i < TOUR_N; i++) {
    const t = i / (TOUR_N - 1)
    const u = 1 - t
    px[i] = u * u * a.x + 2 * u * t * mid.x + t * t * b.x
    pz[i] = u * u * a.z + 2 * u * t * mid.z + t * t * b.z
    ground[i] = terrain.sample(px[i], pz[i])
  }

  // altitude: clearance envelope (rolling max) blurred hard — rises over
  // mountains as one long swell, never tracks bumps
  const radius = Math.round(4 + params.tourSmoothing * 30)
  const envelope = new Float32Array(TOUR_N)
  for (let i = 0; i < TOUR_N; i++) {
    let m = -Infinity
    for (let j = Math.max(0, i - radius); j <= Math.min(TOUR_N - 1, i + radius); j++) m = Math.max(m, ground[j])
    envelope[i] = m
  }
  const smoothY = boxBlur(envelope, radius, 3)

  // one continuous spline starting at the CURRENT camera position — the
  // approach is just the first leg of the same flight, no phase transition
  const pts = [camera.position.clone()]
  for (let i = 0; i < TOUR_N; i += 20) pts.push(new THREE.Vector3(px[i], smoothY[i] + params.tourAltitude, pz[i]))
  pts.push(new THREE.Vector3(px[TOUR_N - 1], smoothY[TOUR_N - 1] + params.tourAltitude, pz[TOUR_N - 1]))
  tour.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5)
  tour.curve.arcLengthDivisions = 400
  tour.curve.updateArcLengths()

  // arc-length fraction where we pass over the FROM poi (gaze switches there)
  let bestD = Infinity
  for (let i = 0; i <= 200; i++) {
    const s = i / 200
    tour.curve.getPointAt(s, _tp)
    const d = Math.hypot(_tp.x - A.x, _tp.z - A.z)
    if (d < bestD) {
      bestD = d
      tour.uA = s
    }
  }

  tour.aTop.set(A.x, A.h + 0.6, A.z)
  tour.bTop.set(B.x, B.h + 0.6, B.z)
  tour.bank = 0
  tour.t = 0
  tour.active = true
  tween.active = false
  requestLegacyFrames()
}

// gaze target along the flight: frame the FROM poi on approach, then look
// ahead down the path, converging onto the TO poi at the end
function tourGaze(s, camPos, out) {
  const ahead = Math.min(s + params.tourLook, 1)
  tour.curve.getPointAt(ahead, out)
  out.y -= params.tourAltitude * 0.7 // gaze slightly below the flight line
  // hand the gaze off BEFORE we're overhead the FROM poi — looking straight
  // down while passing over it flips the heading violently
  const fromBlend = THREE.MathUtils.smoothstep(s, tour.uA * 0.15, tour.uA * 0.75)
  out.lerp(tour.aTop, 1 - fromBlend)
  out.lerp(tour.bTop, THREE.MathUtils.smoothstep(s, 0.85, 1))

  // pitch clamp: never look down steeper than ~72°, pushing the gaze point
  // forward instead — guards against gimbal flips in every configuration
  const dx = out.x - camPos.x
  const dz = out.z - camPos.z
  const horiz = Math.hypot(dx, dz)
  const drop = camPos.y - out.y
  const minHoriz = drop * 0.33
  if (drop > 0 && horiz < minHoriz) {
    if (horiz > 1e-4) {
      const k = minHoriz / horiz
      out.x = camPos.x + dx * k
      out.z = camPos.z + dz * k
    } else {
      tour.curve.getTangentAt(s, _tt0)
      out.x = camPos.x + _tt0.x * minHoriz
      out.z = camPos.z + _tt0.z * minHoriz
    }
  }
  return out
}

const hud2 = createHud2D({
  onSelectPoi(i) {
    if (selectedPoi === -1) {
      returnPose.pos.copy(camera.position)
      returnPose.target.copy(controls.target)
      returnPose.saved = true
    }
    selectedPoi = i
    const p = pois[i]
    hud2.setSelected(i, p)
    const dir = new THREE.Vector3(p.x, 0, p.z).normalize()
    flyTo(new THREE.Vector3(p.x + dir.x * 6.5, p.h + 4.2, p.z + dir.z * 6.5), new THREE.Vector3(p.x, p.h + 0.6, p.z))
  },
  onDeselect() {
    selectedPoi = -1
    hud2.setSelected(-1, null)
    flyTo(returnPose.saved ? returnPose.pos : HOME.pos, returnPose.saved ? returnPose.target : HOME.target)
    returnPose.saved = false
  },
  onScan() {
    scanStart = performance.now() / 1000
    cone.kick(3)
    requestLegacyFrames()
  },
})
hud2.setPois(pois)
hud2.setStatic(params)
hud2.setVisible(params.hud)
hud2.setOpacity(params.hudOpacity)
document.documentElement.style.setProperty('--hud-accent', params.hudAccent)
document.documentElement.style.setProperty('--hud-ink', params.hudInk)
document.documentElement.style.setProperty('--hud-blur', `${params.uiBlur}px`)
document.documentElement.style.setProperty('--hud-bg-alpha', params.uiBgOpacity)

// user grabbing the camera cancels any fly-to or tour
controls.addEventListener('start', () => {
  tween.active = false
  tour.active = false
  camera.up.set(0, 1, 0)
})

// real-world mode strips the fiction: no cone/reticle, no dial platform
function applySourceMode() {
  const real = params.source === 'real'
  cone.group.visible = !real
  hud3.platform.visible = !real
  hud2.setReticleVisible(!real)
}

function regenerateHud() {
  scene.remove(hud3.group)
  hud3.dispose()
  pois = findPois(terrain.sample, params.seed, poiFeet)
  hud3 = createHud3D(params.seed, pois, { ink: params.hudInk, accent: params.hudAccent })
  hud3.lines.visible = params.surveyLines
  scene.add(hud3.group)
  hud2.setPois(pois)
  hud2.setStatic(params)
  selectedPoi = -1
  hud2.setSelected(-1, null)
  applySourceMode()
}
applySourceMode()

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

// ------------------------------------------------------------------ pointer

const mouse = new THREE.Vector2(0, 0)
let lastPointer = null
window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1
  const ny = -((e.clientY / window.innerHeight) * 2 - 1)
  if (lastPointer) {
    const speed = Math.hypot(nx - lastPointer.x, ny - lastPointer.y)
    cone.kick(speed * 6)
  }
  lastPointer = { x: nx, y: ny }
  mouse.set(nx, ny)
})

// planning mode: click on terrain drops a waypoint.
// Bound to the canvas only (GUI/HUD clicks never reach this), primary button,
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
  } else if (waypointMoveDraft?.id === markerDrag.waypointId) {
    waypointMoveDraft = null
  }
  markerDrag = null
  downPos = null
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return
  downPos = { x: e.clientX, y: e.clientY }
  dragged = false
  if (!adminInteraction.inspecting && params.planning && routeLayer && geo && dem) {
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
  if (!params.planning || !routeLayer || !geo) { renderer.domElement.style.cursor = ''; return }
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
  if (markerDrag || !params.planning || !downPos || !geo || !dem || e.button !== 0) return
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
  const wp = insertIndex != null ? insertWaypoint(route, insertIndex, lon, lat, ele) : addWaypoint(route, lon, lat, ele)
  if (insertIndex != null) {
    insertIndex = null
    toast.show('已插入途经点')
  }
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
let mapWorkspaceActive = false
let layerBtns = null
let settingsTerrainReadyText = ''
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
    // NO refreshRoute() here: terrain.rebuild() hasn't run yet — refresh happens
    // in regenerateTerrain()'s completion callback below
    params.source = 'real'
    gui.controllersRecursive().forEach((c) => c.updateDisplay())
    syncSettingsControls()
    loadingEl.textContent = 'generating terrain…'
    const loadedGen = terrainGen
    regenerateTerrain()
    whenTerrainBuilt(loadedGen).then((built) => {
      if (built >= loadedGen) settingsPanel?.setTerrainStatus('ready', '地形已更新')
    })
  } catch (err) {
    if (requestId !== demRequestId) return
    console.error('DEM load failed:', err)
    settingsPanel?.setTerrainStatus('error', '高程数据加载失败，请检查网络后重试。')
    if (!dem) {
      lastRouteAnalysis = analyzeRouteElevation({ route, geo, sampleElevation: null })
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

let rebuildPending = false
let rebuildQueued = false

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

function regenerateTerrain() {
  if (rebuildPending) { rebuildQueued = true; return }
  rebuildPending = true
  loadingEl.classList.remove('hidden')
  // let the indicator paint before the synchronous rebuild blocks the thread
  requestAnimationFrame(() =>
    setTimeout(() => {
      terrain.rebuild(params)
      terrain.rebuildRoughness(params)
      regenerateLabels()
      regenerateHud()
      refreshRoute() // drape route onto the NEW sampler after every rebuild
      if (adminNeedsReload({ enabled: adminState.on, loadedKey: adminState.demKey, currentKey: currentDemKey() })) loadAdminBoundaries()
      if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
      rebuildPending = false
      if (rebuildQueued) {
        rebuildQueued = false
        regenerateTerrain()
        return
      }
      loadingEl.classList.add('hidden')
      if (settingsTerrainReadyText) {
        settingsPanel?.setTerrainStatus('ready', settingsTerrainReadyText)
        settingsTerrainReadyText = ''
      }
      // resolve terrain-ready waiters with the generation that just built
      for (const w of terrainWaiters.splice(0)) w.res(terrainGen)
    }, 30)
  )
}

// ------------------------------------------------------------------ route planning
let geo = null // makeGeoContext(dem), set in loadRealTerrain
let route = createRoute()
let lastRouteAnalysis = analyzeRouteElevation({ route })
let routeLayer = null
let selectedWaypointId = null
let waypointPreviewing = false
let waypointPreviewRejectNotice = false
let waypointMoveDraft = null
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

let lastRouteCoverage = { covered: true, outsideCount: 0, total: 0, bounds: null }

function activeRouteCoordinates() {
  if (!waypointPreviewing && snapState.on && snapState.geometry && snapState.version === snapVersion()) return snapState.geometry
  return route.waypoints
}

function reconcileWaypointSelection() {
  if (selectedWaypointId && !route.waypoints.some((waypoint) => waypoint.id === selectedWaypointId)) selectedWaypointId = null
  if (waypointMoveDraft && !route.waypoints.some((waypoint) => waypoint.id === waypointMoveDraft.id)) waypointMoveDraft = null
}

function setSelectedWaypoint(id) {
  const next = id && route.waypoints.some((waypoint) => waypoint.id === id) ? id : null
  if (selectedWaypointId === next) return false
  selectedWaypointId = next
  refreshRoute({ recordHistory: false, fitOverview: false })
  return true
}

function beginWaypointMove(id) {
  const waypoint = route.waypoints.find((candidate) => candidate.id === id)
  if (!waypoint) return
  waypointPreviewRejectNotice = false
  waypointMoveDraft = { id, values: { ...waypoint } }
}

function previewWaypointMove(id, lon, lat) {
  const waypoint = route.waypoints.find((candidate) => candidate.id === id)
  if (!waypoint || !geo || !dem) return false
  const { x, z } = lonLatToWorld(geo, lon, lat)
  if (Math.abs(x) > TERRAIN_SIZE / 2 || Math.abs(z) > TERRAIN_SIZE / 2) {
    if (!waypointPreviewRejectNotice) toast.show('点位超出当前地形；请先扩展地形范围')
    waypointPreviewRejectNotice = true
    return false
  }
  waypointPreviewRejectNotice = false
  waypoint.lon = lon
  waypoint.lat = lat
  waypoint.ele = Math.round(elevOfWorld(x, z))
  waypointPreviewing = true
  refreshRoute({ recordHistory: false, fitOverview: false })
  return true
}

function commitWaypointMove(id) {
  if (!route.waypoints.some((waypoint) => waypoint.id === id)) {
    waypointMoveDraft = null
    return
  }
  route.revision++
  route.geometryRevision++
  waypointPreviewing = false
  refreshRoute({ fitOverview: false })
  scheduleSnap()
  if (waypointMoveDraft?.id === id) waypointMoveDraft = null
}

function cancelWaypointMove(id) {
  const waypoint = route.waypoints.find((candidate) => candidate.id === id)
  if (waypoint && waypointMoveDraft?.id === id) Object.assign(waypoint, waypointMoveDraft.values)
  if (waypointMoveDraft?.id === id) waypointMoveDraft = null
  waypointPreviewing = false
  refreshRoute({ recordHistory: false, fitOverview: false })
}

function refreshUnavailableRouteAnalysis(coordinates, { recordHistory, fitOverview }) {
  analysisCursorPathKey = ''
  clearAnalysisCursor()
  routeLayer?.clear()
  lastRoutePts = []
  profileCard?.update(lastRouteAnalysis)
  normalizeDayEnds(route)
  if (recordHistory) routeHistory.record(route)
  updateRouteUI(route, {
    distanceM: routeDistanceMeters(coordinates),
    ascentM: null,
    descentM: null,
    maxEle: null,
    minEle: null,
    driveMinutes: null,
  }, [], { fitOverview })
  if (weatherState.result && weatherState.revision !== route.revision) weatherState.requestId++
  if (adminInteraction.selected) scheduleAdminRouteStat()
}

function refreshRoute({ recordHistory = true, fitOverview = true } = {}) {
  reconcileWaypointSelection()
  if (!geo || !dem) {
    analysisCursorPathKey = ''
    clearAnalysisCursor()
    lastRouteAnalysis = analyzeRouteElevation({ route, geo, sampleElevation: null })
    lastRoutePts = []
    profileCard?.update(lastRouteAnalysis)
    plannerWorkspace?.setAnalyzeAvailable(routeCanBeAnalyzed(route))
    workflowStage?.reconcile()
    return
  }
  if (!routeLayer) ensureRouteLayer()
  if (!routeLayer) return
  const coordinates = activeRouteCoordinates()
  lastRouteCoverage = route.waypoints.length >= 2
    ? routeCoverage(geo, coordinates, TERRAIN_SIZE)
    : { covered: true, outsideCount: 0, total: coordinates.length, bounds: null }
  plannerWorkspace?.setCoverage(lastRouteCoverage)
  if (!lastRouteCoverage.covered) {
    lastRouteAnalysis = analyzeRouteElevation({
      route,
      geo,
      sampleElevation: elevOfWorld,
      coverage: lastRouteCoverage,
    })
    refreshUnavailableRouteAnalysis(coordinates, { recordHistory, fitOverview })
    return
  }
  // Raw DEM analysis owns route-point production. Renderers and downstream
  // consumers receive the same immutable-by-convention point set.
  const snappedGeometry = !waypointPreviewing && snapState.on && snapState.geometry && snapState.version === snapVersion() && snapState.demKey === currentDemKey()
    ? snapState.geometry
    : null
  lastRouteAnalysis = analyzeRouteElevation({
    route,
    snappedGeometry,
    geo,
    sampleElevation: elevOfWorld,
    coverage: lastRouteCoverage,
  })
  const legacyState = syncRouteAnalysisConsumer(lastRouteAnalysis, {
    render: (points) => routeLayer.update(route.waypoints, {
      slopeColors: params.routeSlopeColors,
      arrows: params.routeArrows,
      ticks: params.routeTicks,
      pathPts: points,
      selectedWaypointId,
    }),
  })
  if (legacyState !== 'ready') {
    refreshUnavailableRouteAnalysis(coordinates, { recordHistory, fitOverview })
    return
  }
  const pts = lastRouteAnalysis.points
  const nextAnalysisCursorPathKey = pts.map((point) => `${point.lon.toFixed(6)},${point.lat.toFixed(6)},${point.cumDistM.toFixed(1)}`).join('|')
  if (analysisCursorPathKey && analysisCursorPathKey !== nextAnalysisCursorPathKey) clearAnalysisCursor()
  analysisCursorPathKey = nextAnalysisCursorPathKey
  lastRoutePts = pts
  profileCard?.update(lastRouteAnalysis)
  if (!initializeAnalysisCursor(pts)) overviewMap?.setAnalysisCursor({ points: pts, distanceM: analysisCursorDistanceM })
  normalizeDayEnds(route) // id-based markers: drop refs to deleted waypoints
  if (recordHistory) routeHistory.record(route) // safe: dedup no-ops on non-route refreshes
  updateRouteUI(route, lastRouteAnalysis.stats, pts, { fitOverview })
  // route edited → any in-flight weather query for the old revision is void
  if (weatherState.result && weatherState.revision !== route.revision) weatherState.requestId++
  if (adminInteraction.selected) scheduleAdminRouteStat() // route change → recompute L4 stat
}

let lastRoutePts = []
const routeHistory = createHistory() // undo/redo snapshots; record() dedups unchanged states

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
route.mode = localStorage.getItem(SNAP_LS) === '1' ? normalizeRouteMode(snapProfile) : 'straight'
const getRouter = () => createRoutingProvider('osrm', { profile: snapProfile })
const snapState = {
  on: route.mode !== 'straight',
  geometry: null,
  legs: null,
  version: '',
  demKey: '',
  requestId: 0,
}
const snapCache = new Map()
const snapInflight = new Map()
let snapTimer = null

const currentDemKey = () => (dem ? `${dem.lat.toFixed(4)},${dem.lon.toFixed(4)},${dem.zoom}x${dem.tilesAcross}` : '')
const snapRouteKey = (wps) => `osrm:${snapProfile}:` + wps.map((w) => `${w.lon.toFixed(5)},${w.lat.toFixed(5)}`).join('>')

function scheduleSnap() {
  if (!snapState.on) return
  clearTimeout(snapTimer)
  snapTimer = setTimeout(runSnap, 400)
}

async function runSnap() {
  const wps = route.waypoints
  if (!snapState.on) return
  if (wps.length < 2) {
    snapState.geometry = null
    snapState.legs = null
    snapState.version = snapVersion()
    refreshRoute()
    return
  }
  const key = snapRouteKey(wps)
  const ver = snapVersion()
  const reqId = ++snapState.requestId
  const cached = snapCache.get(key)
  if (cached) { commitSnap(cached.geometry, cached.legs, ver, reqId); return }
  planningPanel.setRouteMode(route.mode, '吸附中…')
  try {
    const { geometry, legs } = await snapFetch(key, wps)
    if (reqId !== snapState.requestId || ver !== snapVersion()) return
    commitSnap(geometry, legs, ver, reqId)
  } catch (err) {
    console.warn('snap failed', err)
    if (reqId !== snapState.requestId) return
    snapState.geometry = null
    snapState.legs = null
    snapState.version = ver
    planningPanel.setRouteMode(route.mode, '吸附失败；直线回退段不计时')
    toast.show('路网吸附失败,已回退直线')
    refreshRoute()
  }
}

// whole-route single request (≤32 coords); NoRoute → per-segment sequential
// fallback where unroutable pairs degrade to straight lines (never cached).
// Returns { geometry, legs } — legs are real OSRM segments where available,
// computed straight-line legs for fallback pairs (real:false).
function snapFetch(key, wps) {
  if (snapInflight.has(key)) return snapInflight.get(key)
  const p = (async () => {
    try {
      const r = await getRouter().route(wps.map(({ lon, lat }) => ({ lon, lat })))
      const out = { geometry: r.geometry, legs: r.legs }
      snapCache.set(key, out)
      return out
    } catch (err) {
      // NoRoute / TooBig(413/414/400) → per-segment mode, 4-way parallel
      if (!/NoRoute|HTTP 4(?:00|13|14)/.test(err.message)) throw err
      const segs = new Array(wps.length - 1)
      const legs = new Array(wps.length - 1)
      const fetchSeg = async (i) => {
        const a = wps[i - 1], b = wps[i]
        const segKey = snapCacheKey('osrm', snapProfile, a, b)
        if (snapCache.has(segKey)) {
          const c = snapCache.get(segKey)
          segs[i - 1] = c.geometry
          legs[i - 1] = c.legs
          return
        }
        try {
          const r = await getRouter().route([{ lon: a.lon, lat: a.lat }, { lon: b.lon, lat: b.lat }])
          const out = { geometry: r.geometry, legs: r.legs }
          snapCache.set(segKey, out)
          segs[i - 1] = r.geometry
          legs[i - 1] = r.legs
        } catch {
          segs[i - 1] = [[a.lon, a.lat], [b.lon, b.lat]]
          legs[i - 1] = [computeLegs([a, b])[0]] // straight fallback, real:false, never cached
        }
      }
      const BATCH = 4
      for (let i = 1; i < wps.length; i += BATCH) {
        await Promise.all(Array.from({ length: Math.min(BATCH, wps.length - i) }, (_, k) => fetchSeg(i + k)))
      }
      return { geometry: joinGeometries(segs), legs: legs.flat() }
    } finally {
      snapInflight.delete(key)
    }
  })()
  snapInflight.set(key, p)
  return p
}

function commitSnap(geometry, legs, ver, reqId) {
  if (reqId !== snapState.requestId || ver !== snapVersion()) return
  snapState.geometry = geometry
  snapState.legs = legs
  snapState.version = ver
  snapState.demKey = currentDemKey()
  const routed = legs.filter((leg) => leg?.real !== false).length
  planningPanel.setRouteMode(route.mode, `路网覆盖 ${routed}/${legs.length} 段`)
  refreshRoute()
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

// ------------------------------------------------------------------ GUI

const gui = new GUI({ title: 'EXPERIMENT / 001' })

const copyCtrl = gui
  .add(
    {
      async copy() {
        const json = JSON.stringify(params, null, 2)
        try {
          await navigator.clipboard.writeText(json)
        } catch {
          const ta = document.createElement('textarea')
          ta.value = json
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          ta.remove()
        }
        copyCtrl.name('copied ✓')
        setTimeout(() => copyCtrl.name('copy parameters'), 1200)
      },
    },
    'copy'
  )
  .name('copy parameters')

const fSource = gui.addFolder('Terrain source')
fSource
  .add(params, 'source', { 'procedural noise': 'noise', 'real world (DEM)': 'real' })
  .name('source')
  .onChange((v) => {
    if (v === 'real') loadRealTerrain()
    else {
      settingsPanel?.setTerrainStatus('loading', '正在生成程序化地形…')
      settingsTerrainReadyText = '已切换到程序化地形'
      regenerateTerrain()
    }
    syncSettingsControls()
  })
const latCtrl = { lat: null, lon: null }
fSource
  .add(params, 'demLocation', Object.keys(DEM_PRESETS))
  .name('location')
  .onChange((name) => {
    const p = DEM_PRESETS[name]
    if (!p) return // Custom: use the lat/lon fields below
    params.demLat = p[0]
    params.demLon = p[1]
    latCtrl.lat.updateDisplay()
    latCtrl.lon.updateDisplay()
    if (params.source === 'real') loadRealTerrain()
    syncSettingsControls()
  })
latCtrl.lat = fSource.add(params, 'demLat', -85, 85, 0.0001).name('latitude').onChange(syncSettingsControls)
latCtrl.lon = fSource.add(params, 'demLon', -180, 180, 0.0001).name('longitude').onChange(syncSettingsControls)
fSource
  .add(params, 'demZoom', [8, 9, 10, 11, 12, 13, 14])
  .name('detail (zoom)')
  .onChange(() => {
    if (params.source === 'real') loadRealTerrain()
    syncSettingsControls()
  })
fSource
  .add(params, 'demExaggeration', 0.5, 5, 0.1)
  .name('vertical scale')
  .onFinishChange(() => {
    if (params.source === 'real') regenerateTerrain()
    overviewMap?.setTerrainExaggeration(params.demExaggeration)
    syncSettingsControls()
  })
fSource.add({ load: () => loadRealTerrain() }, 'load').name('load location ⤓')

const fRouteStyle = gui.addFolder('Route style')
const refreshRouteSetting = () => { refreshRoute(); syncSettingsControls() }
fRouteStyle.add(params, 'routeSlopeColors').name('slope gradient').onChange(refreshRouteSetting)
fRouteStyle.add(params, 'routeArrows').name('direction arrows').onChange(refreshRouteSetting)
fRouteStyle.add(params, 'routeTicks').name('distance ticks').onChange(refreshRouteSetting)

const fTerrain = gui.addFolder('Terrain')
fTerrain.add(params, 'seed', 1, 9999, 1).onFinishChange(regenerateTerrain)
fTerrain
  .add(
    {
      randomize() {
        params.seed = Math.floor(Math.random() * 9999) + 1
        gui.controllersRecursive().forEach((c) => c.updateDisplay())
        regenerateTerrain()
      },
    },
    'randomize'
  )
  .name('randomize seed')
fTerrain.add(params, 'scale', 0.04, 0.4, 0.005).onFinishChange(regenerateTerrain)
fTerrain.add(params, 'octaves', 2, 8, 1).onFinishChange(regenerateTerrain)
fTerrain.add(params, 'lacunarity', 1.6, 3.2, 0.05).onFinishChange(regenerateTerrain)
fTerrain.add(params, 'gain', 0.3, 0.7, 0.01).onFinishChange(regenerateTerrain)
fTerrain.add(params, 'amplitude', 0.5, 7, 0.1).onFinishChange(regenerateTerrain)
fTerrain.add(params, 'warp', 0, 6, 0.1).name('domain warp').onFinishChange(regenerateTerrain)
fTerrain.add(params, 'detail', 0, 0.8, 0.01).name('fine detail').onFinishChange(regenerateTerrain)
fTerrain.add(params, 'detailScale', 0.5, 6, 0.1).onFinishChange(regenerateTerrain)
fTerrain.add(params, 'resolution', [256, 384, 512, 768, 1024]).onFinishChange(regenerateTerrain)

const fSurface = gui.addFolder('Surface material')
fSurface.addColor(params, 'color').onChange(() => terrain.updateMaterial(params))
fSurface.add(params, 'roughness', 0, 1, 0.01).onFinishChange(() => terrain.rebuildRoughness(params))
fSurface
  .add(params, 'roughnessVariation', 0, 0.6, 0.01)
  .name('roughness noise')
  .onFinishChange(() => terrain.rebuildRoughness(params))
fSurface
  .add(params, 'roughnessScale', 1, 16, 0.5)
  .name('roughness scale')
  .onFinishChange(() => terrain.rebuildRoughness(params))
fSurface.add(params, 'bumpScale', 0, 2, 0.05).name('micro bump').onChange(() => terrain.updateMaterial(params))
fSurface.add(params, 'envMapIntensity', 0, 1.5, 0.05).name('env reflection').onChange(() => terrain.updateMaterial(params))

const fCamera = gui.addFolder('Camera & focus')
fCamera.add(params, 'fov', 20, 60, 1).onChange((v) => {
  camera.fov = v
  camera.updateProjectionMatrix()
})
fCamera.add(params, 'autoFocus').name('autofocus cone')
fCamera.add(params, 'focusDistance', 5, 60, 0.1).name('focus distance').listen()
fCamera.add(params, 'focusRange', 0.5, 25, 0.1).name('focus range').onChange((v) => {
  dof.cocMaterial.worldFocusRange = v
})
fCamera.add(params, 'bokehScale', 0, 8, 0.1).name('bokeh scale').onChange((v) => {
  dof.bokehScale = v
  dofPass.enabled = v > 0
})

const fMap = gui.addFolder('Map overlay')
fMap.add(params, 'mapTint', 0, 1, 0.02).name('hypsometric tint').onChange((v) => (terrain.mapUniforms.uTint.value = v))
fMap
  .add(params, 'heightContrast', 0.5, 20, 0.1)
  .name('height contrast')
  .onChange((v) => (terrain.mapUniforms.uHeightContrast.value = v))
fMap
  .add(params, 'heightPivot', 0, 1, 0.01)
  .name('height pivot')
  .onChange((v) => (terrain.mapUniforms.uHeightPivot.value = v))
const rebuildRamp = () => terrain.rebuildRamp(params)
fMap.addColor(params, 'gradLow').name('gradient: low').onChange(rebuildRamp)
fMap.addColor(params, 'gradMid1').name('gradient: mid 1').onChange(rebuildRamp)
fMap.addColor(params, 'gradMid2').name('gradient: mid 2').onChange(rebuildRamp)
fMap.addColor(params, 'gradHigh').name('gradient: high').onChange(rebuildRamp)
fMap.add(params, 'gradMid1Pos', 0, 1, 0.01).name('mid 1 position').onChange(rebuildRamp)
fMap.add(params, 'gradMid2Pos', 0, 1, 0.01).name('mid 2 position').onChange(rebuildRamp)
fMap
  .add(params, 'slopeTint', 0, 1, 0.02)
  .name('slope brown')
  .onChange((v) => (terrain.mapUniforms.uSlopeTint.value = v))
fMap
  .add(params, 'contourInterval', 0.04, 0.6, 0.01)
  .name('contour interval')
  .onChange((v) => (terrain.mapUniforms.uContourInterval.value = v))
const contourOpacityCtrl = fMap
  .add(params, 'contourOpacity', 0, 1, 0.02)
  .name('contour opacity')
  .onChange((v) => { terrain.mapUniforms.uContourOpacity.value = v; reflectLayerSetting('contour', v > 0) })
fMap
  .addColor(params, 'contourColor')
  .name('contour color')
  .onChange((v) => terrain.mapUniforms.uContourColor.value.set(v))
const gridOpacityCtrl = fMap.add(params, 'gridOpacity', 0, 1, 0.02).name('grid opacity').onChange((v) => { terrain.mapUniforms.uGridOpacity.value = v; reflectLayerSetting('grid', v > 0) })
const labelsCtrl = fMap.add(params, 'labels').name('place labels').onChange((v) => { labels.visible = v; reflectLayerSetting('labels', v) })
fMap.add(params, 'gridStep', 2, 14, 0.5).name('grid size').onChange((v) => (terrain.mapUniforms.uGridStep.value = v))

const fLook = gui.addFolder('Look')
fLook.add(params, 'exposure', 0.2, 3, 0.02).onChange((v) => { exposureFx.uniforms.get('exposure').value = v; syncSettingsControls() })
fLook.add(params, 'contrast', -0.2, 0.5, 0.01).onChange((v) => { contrastFx.uniforms.get('contrast').value = v; syncSettingsControls() })
fLook.add(params, 'saturation', -1, 0, 0.02).onChange((v) => { hueSat.saturation = v; syncSettingsControls() })
fLook.add(params, 'vignette', 0, 1, 0.02).onChange((v) => (vignette.darkness = v))
fLook.add(params, 'grain', 0, 0.5, 0.01).onChange((v) => (grain.blendMode.opacity.value = v))
fLook.add(params, 'fogNear', 5, 60, 0.5).name('fog start').onChange((v) => { scene.fog.near = v; syncSettingsControls() })
fLook.add(params, 'fogFar', 15, 90, 0.5).name('fog end').onChange((v) => { scene.fog.far = v; syncSettingsControls() })
fLook.addColor(params, 'fogColor').onChange((v) => {
  scene.fog.color.set(v)
  scene.background.set(v)
})
fLook.add(params, 'surveyLines').name('survey circles').onChange((v) => (hud3.lines.visible = v))

const fHud = gui.addFolder('HUD')
const hudCtrl = fHud.add(params, 'hud').name('show HUD').onChange((v) => { hud2.setVisible(v); reflectLayerSetting('hud', v) })
fHud.add(params, 'hudOpacity', 0, 1, 0.02).name('HUD opacity').onChange((v) => hud2.setOpacity(v))
fHud
  .add(params, 'uiBlur', 0, 30, 1)
  .name('panel blur')
  .onChange((v) => document.documentElement.style.setProperty('--hud-blur', `${v}px`))
fHud
  .add(params, 'uiBgOpacity', 0, 1, 0.02)
  .name('panel bg opacity')
  .onChange((v) => document.documentElement.style.setProperty('--hud-bg-alpha', v))
fHud
  .addColor(params, 'hudAccent')
  .name('accent color')
  .onChange((v) => {
    document.documentElement.style.setProperty('--hud-accent', v)
    regenerateHud()
  })
fHud
  .addColor(params, 'hudInk')
  .name('ink color')
  .onChange((v) => {
    document.documentElement.style.setProperty('--hud-ink', v)
    regenerateHud()
  })
fHud.add(params, 'sweepSpeed', 0, 3, 0.05).name('sweep speed')
fHud
  .addColor(params, 'scanColor')
  .name('scan color')
  .onChange((v) => terrain.mapUniforms.uScanColor.value.set(v))
fHud.add(params, 'scanDuration', 1, 8, 0.1).name('scan duration')
fHud
  .add(params, 'scanWidth', 0.05, 4, 0.05)
  .name('scan width')
  .onChange((v) => (terrain.mapUniforms.uScanWidth.value = v))
fHud
  .add(params, 'scanBlur', 0, 3, 0.02)
  .name('scan blur')
  .onChange((v) => (terrain.mapUniforms.uScanBlur.value = v))
fHud
  .add(params, 'scanDispHeight', 0, 2, 0.02)
  .name('wave height')
  .onChange((v) => (terrain.mapUniforms.uScanDispH.value = v))
fHud
  .add(params, 'scanDispFalloff', 0.1, 6, 0.05)
  .name('wave falloff')
  .onChange((v) => (terrain.mapUniforms.uScanDispW.value = v))
fHud.add({ scan: () => { scanStart = performance.now() / 1000; requestLegacyFrames() } }, 'scan').name('trigger scan')

const fMotion = gui.addFolder('Motion')
fMotion.add(params, 'coneSpin', 0, 3, 0.05).name('cone spin')
fMotion.add(params, 'coneTilt', 0, 0.5, 0.01).name('cursor tilt')
fMotion.add(params, 'coneDrift', 0, 2, 0.05).name('cursor drift')
fMotion.add(params, 'bob', 0, 0.3, 0.01).name('hover bob')
fMotion.add(params, 'ringSpeed', 0, 6, 0.1).name('ring speed')
fMotion.add(params, 'flyDuration', 0.4, 4, 0.1).name('fly duration')
fMotion.add(params, 'flyEasing', ['smooth', 'glide', 'linear']).name('fly easing')

const POI_IDS = ['PK-01', 'PK-02', 'PK-03', 'PK-04', 'DEP-05']
const fTour = gui.addFolder('Tour')
fTour.add(params, 'tourFrom', POI_IDS).name('from')
fTour.add(params, 'tourTo', POI_IDS).name('to')
fTour.add(params, 'tourDuration', 4, 40, 0.5).name('duration (s)')
fTour.add(params, 'tourAltitude', 0.8, 10, 0.1).name('altitude')
fTour.add(params, 'tourSmoothing', 0, 1, 0.02).name('path smoothing')
fTour.add(params, 'tourLook', 0.02, 0.3, 0.01).name('look ahead')
fTour.add(params, 'tourBank', 0, 3, 0.05).name('bank into turns')
fTour.add({ start: startTour }, 'start').name('▶ start tour')
fTour.add(
  {
    stop: () => {
      tour.active = false
      camera.up.set(0, 1, 0)
    },
  },
  'stop'
).name('■ stop')

const fPerf = gui.addFolder('Performance')
fPerf
  .add(params, 'pixelRatio', 0.5, 2, 0.05)
  .name('render scale')
  .onChange((v) => {
    renderer.setPixelRatio(v)
    composer.setSize(window.innerWidth, window.innerHeight)
  })
fPerf.add(params, 'shadowMode', ['dynamic', 'static', 'off']).name('shadows').onChange(applyShadowMode)
fPerf
  .add(params, 'shadowRes', [1024, 2048, 4096])
  .name('shadow resolution')
  .onChange((v) => {
    sun.shadow.mapSize.set(v, v)
    if (sun.shadow.map) {
      sun.shadow.map.dispose()
      sun.shadow.map = null
    }
    if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
  })
fMotion.add(params, 'paused')

const fLight = gui.addFolder('Light')
fLight.add(params, 'sunIntensity', 0, 16, 0.1).onChange(placeSun)
fLight.add(params, 'sunAzimuth', 0, 360, 1).onChange(placeSun)
fLight.add(params, 'sunElevation', 5, 85, 1).onChange(placeSun)
fLight.add(params, 'hemiIntensity', 0, 2, 0.05).name('ambient').onChange(placeSun)
fLight
  .add(params, 'envLight', 0, 1.5, 0.02)
  .name('env light (shadow fill)')
  .onChange((v) => (scene.environmentIntensity = v))
fLight
  .add(params, 'shadowSoftness', 0, 30, 0.5)
  .name('shadow softness')
  .onChange((v) => (sun.shadow.radius = v))

// only Terrain source and Tour start expanded
fTerrain.close()
fSurface.close()
fCamera.close()
fMap.close()
fRouteStyle.close()
fLook.close()
fHud.close()
fMotion.close()
fPerf.close()
fLight.close()

// ------------------------------------------------------------------ loop

// ------------------------------------------------------------------ ui chrome (rail / panels / mode)
const toast = createToast()
const panelHost = createPanelHost({
  onSummaryCustomize: () => toggleSettings(),
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

let lastSyncedTripDays = 0 // itinerary→weather days sync guard

function currentLegs(pts) {
  if (!lastRouteCoverage.covered) {
    return route.waypoints.slice(1).map((to, index) => {
      const from = route.waypoints[index]
      return { from: from.name, to: to.name, distanceM: routeDistanceMeters([from, to]), real: false }
    })
  }
  const osrmLegs = snapState.on && snapState.legs && snapState.version === snapVersion() && snapState.demKey === currentDemKey()
    ? normalizeOsrmLegs(snapState.legs, route.waypoints)
    : null
  return osrmLegs ?? computeLegsFromPts(pts, route.waypoints) ?? (route.waypoints.length >= 2 ? computeLegs(route.waypoints) : null)
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
  const wxIndex = weatherState.result && weatherState.revision === route.revision ? weatherState.result.index?.overall : null
  const wxDays = weatherState.result && weatherState.revision === route.revision ? weatherState.result.agg : null
  planningPanel.update(route, stats, legs, wxIndex, snapProfile, wxDays)
  weatherPanel?.setRouteContext?.({ route, distanceM: stats?.distanceM })
  // share tab summary mirrors the same data block
  const pd = buildPosterData({
    route, stats, legs,
    weather: weatherState.result && weatherState.revision === route.revision ? weatherState.result : null,
    profile: snapProfile,
  })
  sharePanel.update(`${pd.durationText}(${pd.profileLabel}) · ${pd.distanceText} · ${pd.eleText} · ${pd.waypointText}${pd.weatherIndexText != null ? ` · 天气 ${pd.weatherIndexText}` : ''}`)
  // weather panel days track the itinerary length — only when the count CHANGES
  // (user-picked days must survive unrelated route edits)
  const tripDays = (route.dayEnds?.length ?? 0) + 1
  if (tripDays !== lastSyncedTripDays) {
    lastSyncedTripDays = tripDays
    weatherPanel.setTripDays?.(tripDays)
  }
  // collapsed panel header still shows live route state; POI tags dim under a route
  const realLegs = legs?.length && legs.every((leg) => leg.real && Number.isFinite(leg.durationS)) ? legs : null
  const wxFlat = wxDays?.flatMap((day) => day?.points ?? []) ?? []
  const summaryData = {
    days: (route.dayEnds?.length ?? 0) + 1,
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
    ? formatSummary(summaryPreferences, summaryData, globalThis.matchMedia?.('(max-width: 720px)').matches ? 2 : 4)
    : '点击地图添加途经点')
  plannerWorkspace?.setJourneySpine({ route, legs: legs ?? [], weatherDays: wxDays ?? [] })
  plannerWorkspace?.setAnalyzeAvailable(routeCanBeAnalyzed(route))
  workflowStage?.reconcile()
  plannerWorkspace?.updateTrip({
    name: route.name,
    dateText: wxDays?.length ? `${wxDays[0].date} — ${wxDays.at(-1).date}` : null,
    saved: summaryData.saved,
  })
  hud2.root.classList.toggle('has-route', route.waypoints.length > 0)
  overviewMap?.setWeatherOverlay({ routeRevision: route.revision, weatherRevision: weatherState.revision, result: weatherState.result })
  overviewMap.update(route, pts, currentViewportRect(), { fit: fitOverview })
  overviewMap.setSelectedWaypoint(selectedWaypointId)
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
const weatherState = { revision: -1, requestId: 0, result: null }

async function runWeatherQuery({ dates }) {
  if (!route.waypoints.length) { weatherPanel.setEmptyRoute(); return }
  const rep = pickRepresentativePoints(route.waypoints)
  const rev = route.revision
  const reqId = ++weatherState.requestId
  weatherPanel.setLoading(rep)
  weatherState.revision = -1
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
    const cacheKey = `trip3d.wx.h1.${routeFingerprint(route)}.${from}.${to}.rep.${source}`
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
    if (reqId !== weatherState.requestId) return // a newer query superseded this one
    const agg = aggregateTripDays(all)
    weatherState.revision = rev
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
  onRecoverRoute: () => showTab('planning'),
})

function showHourlyWeatherDetails(properties = {}) {
  if (panelHost.currentId !== 'weather') showTab('weather')
  const result = weatherState.result && weatherState.revision === route.revision ? weatherState.result : null
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
  if (globalThis.matchMedia?.('(max-width: 720px)')?.matches) panelHost.setSheetState('full')
}

// ------------------------------------------------------------------ place search
// Explicit trigger only (Enter/button) — Nominatim public instance bans
// autocomplete. 1 req/s client throttle; nominatim primary, photon fallback.
const geocoder = createGeocodeProvider('nominatim')
const geocoderBackup = createGeocodeProvider('photon')
let searchReqId = 0
let lastSearchAt = 0

async function runSearch(query) {
  query = query?.trim()
  if (!query) return
  const now = Date.now()
  if (now - lastSearchAt < 1100) { toast.show('搜索限流 1 次/秒,稍候'); return }
  lastSearchAt = now
  const reqId = ++searchReqId
  planningPanel.setSearchBusy(true)
  try {
    let list
    try {
      list = await geocoder.search(query)
    } catch {
      list = await geocoderBackup.search(query)
    }
    if (reqId !== searchReqId) return
    planningPanel.setSearchResults(list, query)
  } catch (err) {
    if (reqId !== searchReqId) return
    console.warn('search failed', err)
    planningPanel.setSearchResults([], query)
    toast.show(`搜索失败:${err.message}`)
  } finally {
    if (reqId === searchReqId) planningPanel.setSearchBusy(false)
  }
}

function flyToLonLat(lon, lat, dist = 8) {
  const { x, z } = lonLatToWorld(geo, lon, lat)
  const y = terrain.sample(x, z)
  flyTo(new THREE.Vector3(x + dist, y + dist * 0.75, z + dist), new THREE.Vector3(x, y, z))
}

async function searchGo(r) {
  if (demBusy || rebuildPending) { toast.show('地形加载中,稍后再试'); return }
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

async function searchAdd(r) {
  if (demBusy || rebuildPending) { toast.show('地形加载中,稍后再试'); return }
  let inBounds = false
  if (geo && dem) {
    const { px, py } = geo.lonLatToPx(r.lon, r.lat)
    inBounds = px >= 0 && px <= dem.size - 1 && py >= 0 && py <= dem.size - 1
  }
  if (!inBounds) {
    toast.show('目标在当前区域外,加载新地形…')
    params.demLat = r.lat
    params.demLon = r.lon
    const gen = terrainGen + 1
    loadRealTerrain()
    const built = await whenTerrainBuilt(gen)
    if (built < gen) { toast.show('加载被更新的操作取代'); return }
  }
  ensureRouteLayer()
  const { x, z } = lonLatToWorld(geo, r.lon, r.lat)
  const wp = addWaypoint(route, r.lon, r.lat, Math.round(elevOfWorld(x, z)), r.name || 'POI')
  if (!wp) { toast.show('已达途经点上限 32'); return }
  if (!mode.isPlanning()) mode.enterPlanning()
  refreshRoute()
  scheduleSnap()
  toast.show(`已加途经点:${r.name || 'POI'}`)
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
  if (demBusy || rebuildPending) { toast.show('地形加载中,稍后再试'); return }
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
  for (const p of pts) {
    const { x, z } = lonLatToWorld(geo, p.lon, p.lat)
    const { px, py } = geo.worldToPx(x, z)
    if (px < 0 || px > dem.size - 1 || py < 0 || py > dem.size - 1) anyOutOfView = true
    const wp = addWaypoint(route, p.lon, p.lat, Math.round(elevOfWorld(x, z)), p.name || `P${route.waypoints.length + 1}`)
    if (wp) added++
  }
  if (!mode.isPlanning()) mode.enterPlanning()
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
  return `${location.origin}${location.pathname}#r=${encodeShare(route, { dem })}`
}

async function exportPoster() {
  if (route.waypoints.length < 2) { toast.show('先规划线路再生成海报'); return }
  toast.show('正在生成海报…')
  // same-task render → toDataURL works without preserveDrawingBuffer
  composer.render()
  const img = new Image()
  img.src = renderer.domElement.toDataURL('image/png')
  await img.decode()
  const stats = lastRoutePts.length ? routeStats(lastRoutePts) : null
  const wx = weatherState.result && weatherState.revision === route.revision ? weatherState.result : null
  const data = buildPosterData({ route, stats, legs: currentLegs(lastRoutePts), weather: wx, profile: snapProfile })
  const canvas = renderPoster({ screenshot: img, data, shareUrl: buildShareUrl() })
  canvas.toBlob((blob) => {
    if (!blob) { toast.show('海报生成失败'); return }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(route.name || 'route').replace(/[\\/:*?"<>|]/g, '_')}-poster.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    toast.show('海报已下载')
  }, 'image/png')
}

const sharePanel = createSharePanel({
  onCopyLink: () => routeActions.onShare(),
  onQr: () => {
    if (route.waypoints.length < 2) { toast.show('先规划线路'); return }
    showQrOverlay(buildShareUrl(), '扫码打开此行程', '分享链接已复制')
  },
  onExportGpx: () => routeActions.onExportGpx(),
  onExportAmap: exportAmapLink,
  onDownloadPoster: exportPoster,
  onFlyover: startFlyover,
})
sharePanel.update('规划线路后,这里聚合全部分享出口')

// ------------------------------------------------------------------ flyover video
// MediaRecorder over canvas.captureStream; camera walks the route path in tick.
const flyState = { active: false, rec: null, chunks: [], t: 0, dur: 0, path: null, ground: null, discard: false }
let flyPrevCam = null

const flyOverlay = document.createElement('div')
flyOverlay.className = 'ui-fly-overlay hidden'
flyOverlay.innerHTML = '<div class="fly-card"><div class="ttl">正在录制飞越视频</div><div class="bar"><div class="fill"></div></div><button class="fly-cancel">取消</button></div>'
document.body.appendChild(flyOverlay)
flyOverlay.querySelector('.fly-cancel').onclick = () => stopFlyover(false)

function startFlyover() {
  if (flyState.active) return
  if (lastRoutePts.length < 2) { toast.show('先规划线路再录制'); return }
  if (typeof MediaRecorder === 'undefined') { toast.show('当前浏览器不支持视频录制'); return }
  const totalDist = lastRoutePts[lastRoutePts.length - 1].cumDistM
  const dur = flyoverDuration(totalDist, { mPerSec: 400, minS: 12, maxS: 60 })
  const path = resamplePath(lastRoutePts, Math.max(60, Math.round(dur * 12)))
  const ground = (x, z) => terrain.sample(x, z)
  const stream = renderer.domElement.captureStream(30)
  let rec
  try {
    rec = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm',
      videoBitsPerSecond: 6_000_000,
    })
  } catch { toast.show('当前浏览器不支持视频录制'); return }
  flyState.chunks = []
  rec.ondataavailable = (e) => { if (e.data.size) flyState.chunks.push(e.data) }
  rec.onstop = () => {
    if (!flyState.discard && flyState.chunks.length) {
      const blob = new Blob(flyState.chunks, { type: 'video/webm' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(route.name || 'route').replace(/[\\/:*?"<>|]/g, '_')}-flyover.webm`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 8000)
      toast.show('飞越视频已下载')
    }
  }
  Object.assign(flyState, { active: true, rec, t: 0, dur, path, ground, discard: false })
  flyPrevCam = { pos: camera.position.clone(), target: controls.target.clone() }
  tour.active = false
  tween.active = false
  controls.enabled = false
  flyOverlay.classList.remove('hidden')
  rec.start(250)
  requestLegacyFrames()
  toast.show(`录制中(${Math.round(dur)}s),可取消`)
}

function stopFlyover(finish) {
  if (!flyState.active) return
  flyState.discard = !finish
  flyState.active = false
  try { flyState.rec.stop() } catch { /* already stopped */ }
  controls.enabled = true
  if (flyPrevCam) {
    camera.position.copy(flyPrevCam.pos)
    controls.target.copy(flyPrevCam.target)
  }
  flyOverlay.classList.add('hidden')
}

async function refreshLibrary() {
  const s = await routeStoreReady
  if (s) libraryPanel.setItems(await s.list())
}

function applyRouteModeState(nextMode, { persist = true, refresh = true } = {}) {
  route.mode = normalizeRouteMode(nextMode)
  snapProfile = route.mode === 'car' ? 'car' : 'foot'
  snapState.on = route.mode !== 'straight'
  if (persist) {
    localStorage.setItem(SNAP_LS, snapState.on ? '1' : '0')
    localStorage.setItem(SNAP_PROFILE_LS, snapProfile)
  }
  snapState.version = ''
  snapState.geometry = null
  snapState.legs = null
  snapState.demKey = ''
  snapState.requestId++
  planningPanel.setRouteMode(route.mode, snapState.on ? '等待路网吸附' : '仅测距；不估算时长')
  if (!refresh) return
  if (snapState.on) scheduleSnap()
  else refreshRoute()
}

const routeActions = {
  onMapFocus: () => { panelHost.setSheetState('peek'); overviewMap.focusPlanner?.() },
  onNameChange: (v) => {
    route.name = v
    params.routeName = v
    lastSavedRouteVersion = null
    refreshRoute({ recordHistory: false, fitOverview: false })
  },
  onDaySelect: ({ startIndex }) => setSelectedWaypoint(route.waypoints[startIndex]?.id),
  onUndo: () => runPlanRouteMutation(() => { if (routeHistory.undo(route)) applyRouteModeState(route.mode) }),
  onRedo: () => runPlanRouteMutation(() => { if (routeHistory.redo(route)) applyRouteModeState(route.mode) }),
  onClear: () => { route.waypoints = []; route.dayEnds = []; waypointMoveDraft = null; route.revision++; route.geometryRevision++; refreshRoute(); scheduleSnap() },
  onReverse: () => { if (reverseWaypoints(route)) { refreshRoute(); scheduleSnap(); toast.show('已反向') } },
  onCloseLoop: () => { if (closeLoop(route)) { refreshRoute(); scheduleSnap(); toast.show('已闭环') } else toast.show('已是环线或点位不足') },
  onToggleDayEnd: (i) => { if (toggleDayEnd(route, i)) refreshRoute() },
  dayNumberAt: (i) => dayNumberAt(route, i),
  onSearch: runSearch,
  onSearchGo: searchGo,
  onSearchAdd: searchAdd,
  onImportAmap: importAmapLink,
  onExportAmap: exportAmapLink,
  onWpRemove: (i) => { removeWaypoint(route, i); reconcileWaypointSelection(); refreshRoute(); scheduleSnap() },
  onWpMove: (i, dir) => { moveWaypoint(route, i, i + dir); refreshRoute(); scheduleSnap() },
  onWpMoveTo: (from, to) => { if (moveWaypoint(route, from, to)) { refreshRoute(); scheduleSnap() } },
  onWpRename: (i, name) => { route.waypoints[i].name = name; route.revision++; refreshRoute() },
  onInsertAt: (index) => {
    insertIndex = index
    toast.show(`点击地形,新途经点将插入到第 ${index + 1} 位(ESC 取消)`)
  },
  resetInsert: () => { insertIndex = null },
  onRouteMode: (nextMode) => {
    route.revision++
    applyRouteModeState(nextMode, { refresh: false })
    routeHistory.record(route)
    if (snapState.on) scheduleSnap()
    else refreshRoute()
  },
  onSave: async () => {
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
    const hash = encodeShare(route, { dem })
    const url = `${location.origin}${location.pathname}#r=${hash}`
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard may be unavailable */ }
    window.history.replaceState(null, '', `#r=${hash}`)
    toast.show('分享链接已复制')
  },
  onExportGpx: () => {
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
          route = importedRoute
          selectedWaypointId = null
          waypointPreviewing = false
          waypointMoveDraft = null
          applyRouteModeState('straight', { refresh: false })
          params.routeName = route.name
          ensureRouteLayer()
          routeHistory.reset(route)
          refreshRoute()
          scheduleSnap()
          toast.show(route.downsampled ? `GPX 已导入(抽稀 ${route.originalPointCount}→${route.waypoints.length} 点)` : 'GPX 已导入')
        })
      } catch (err) { toast.show(`GPX 导入失败: ${err.message}`, 3200) }
    }
    inp.click()
  },
}
const planningPanel = createPlanningPanel(routeActions)
profileCard = createProfileCard(params.hudAccent)
planningPanel.setRouteMode(route.mode, snapState.on ? '等待路网吸附' : '仅测距；不估算时长')

let plannerWorkspace
let workflowStage
let analysisCursorDistanceM = null
let analysisCursorPathKey = ''
function setAnalysisCursor(distanceM) {
  analysisCursorDistanceM = Number.isFinite(distanceM) ? distanceM : null
  profileCard?.setCursorDistance(analysisCursorDistanceM)
  overviewMap?.setAnalysisCursor({ points: lastRouteAnalysis?.points, distanceM: analysisCursorDistanceM })
}
function clearAnalysisCursor() {
  setAnalysisCursor(null)
}
function initializeAnalysisCursor(points = lastRouteAnalysis?.points) {
  const distanceM = initialAnalysisCursorDistance(points, analysisCursorDistanceM)
  if (!Number.isFinite(distanceM)) return false
  if (distanceM === analysisCursorDistanceM) return false
  setAnalysisCursor(distanceM)
  return true
}
profileCard.setCallbacks({ onCursorDistance: setAnalysisCursor })
const overviewMap = createOverviewMap({
  terrainExaggeration: params.demExaggeration,
  onTerrainUnavailable: (error) => {
    plannerWorkspace?.setStage(WORKFLOW_STAGES.PLAN)
    setLegacyFrameModeActive(false)
    workflowStage?.fallback('terrain-unavailable')
    if (!workflowStage && params.planning) applyPlannerView('2d')
    toast.show(error?.message === 'WebGL context lost'
      ? '地形显示已中断；已返回路线规划'
      : '地形分析暂时不可用；已返回路线规划')
  },
  onJump: (lon, lat) => { if (geo && dem) flyToLonLat(lon, lat, 10) },
  onWaypointSelect: setSelectedWaypoint,
  onWaypointMoveStart: beginWaypointMove,
  onWaypointMove: previewWaypointMove,
  onWaypointMoveEnd: commitWaypointMove,
  onWaypointMoveCancel: cancelWaypointMove,
  onWeatherDetails: showHourlyWeatherDetails,
  onAnalysisCursor: setAnalysisCursor,
  onPlanAdd: (lon, lat) => {
    if (!params.planning || !geo || !dem) return
    const { x, z } = lonLatToWorld(geo, lon, lat)
    if (Math.abs(x) > TERRAIN_SIZE / 2 || Math.abs(z) > TERRAIN_SIZE / 2) {
      toast.show('点位超出当前地形；请先扩展地形范围')
      return
    }
    const ele = Math.round(elevOfWorld(x, z))
    const waypoint = insertIndex != null
      ? insertWaypoint(route, insertIndex, lon, lat, ele)
      : addWaypoint(route, lon, lat, ele)
    if (!waypoint) { toast.show('途经点已达上限'); return }
    insertIndex = null
    refreshRoute()
    scheduleSnap()
  },
})
document.body.appendChild(overviewMap.el)
overviewMap.setWeatherPreferences(weatherPreferences)
overviewMap.setAdminOverlay({ enabled: adminState.on, rings: filterAdminRings(adminState.rings, adminInteraction.level), selected: adminInteraction.selected })
overviewMap.setWeatherOverlay({ routeRevision: route.revision, weatherRevision: weatherState.revision, result: weatherState.result })

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
  gui.controllersRecursive().forEach((controller) => controller.updateDisplay())
  toast.show(`扩展地形：Z${fit.zoom} · ${fit.tilesAcross}×${fit.tilesAcross} tiles`)
  loadRealTerrain()
}

function applyPlannerView(view) {
  const requested = view === '3d' ? '3d' : '2d'
  const accepted = overviewMap.setPlannerView(requested)
  const actual = accepted ? requested : '2d'
  plannerWorkspace?.setStage(actual === '3d' ? WORKFLOW_STAGES.ANALYZE : WORKFLOW_STAGES.PLAN)
  // Native MapLibre terrain owns its own render lifecycle. The legacy Three
  // scheduler remains idle unless a real legacy animation explicitly needs it.
  setLegacyFrameModeActive(false)
  document.body.classList.toggle('planner-2d', workflowStage?.stage !== WORKFLOW_STAGES.ANALYZE && actual === '2d')
  document.body.classList.toggle('planner-3d', actual === '3d')
  overviewMap.update(route, lastRoutePts, currentViewportRect(), { fit: false })
  if (mapWorkspaceActive) overviewMap.resize({ fit: false })
  return actual
}

function enterPlanForEditing() {
  if (workflowStage?.stage === WORKFLOW_STAGES.ANALYZE) workflowStage.setStage(WORKFLOW_STAGES.PLAN)
  else if (!mode?.isPlanning()) mode?.enterPlanning()
}

function runPlanRouteMutation(mutate) {
  return runRouteMutationInPlan({
    enterPlanForEditing,
    isPlanEditing: () => workflowStage?.stage === WORKFLOW_STAGES.PLAN && mode?.isPlanning() === true,
    mutate,
  })
}

function fitWorkflowStage() {
  requestAnimationFrame(() => overviewMap.resize({ fit: false }))
}

function applyWorkflowStage(stage) {
  const analyze = stage === WORKFLOW_STAGES.ANALYZE
  profileCard?.setStage(stage)
  if (!analyze) clearAnalysisCursor()
  else initializeAnalysisCursor()
  document.body.classList.toggle('analyze-operate', analyze)
  if (analyze) {
    if (mode?.isPlanning()) mode.exitPlanning()
    else setMapWorkspace({ weather: false, editing: false })
    plannerWorkspace?.setStage(stage)
    panelHost.hide()
    rail.clearActive()
    overviewMap.setPlannerMode(true, { editing: false })
    if (applyPlannerView('3d') !== '3d') workflowStage?.fallback('terrain-unavailable')
    else fitWorkflowStage()
    return
  }
  plannerWorkspace?.setStage(stage)
  if (mode && !mode.isPlanning()) {
    mode.enterPlanning()
    fitWorkflowStage()
  }
  else {
    setMapWorkspace({ weather: false, editing: true })
    applyPlannerView('2d')
    fitWorkflowStage()
  }
}

plannerWorkspace = createPlannerWorkspace({
  onStage: (stage) => {
    if (!workflowStage?.setStage(stage)) plannerWorkspace.setStage(workflowStage?.stage ?? WORKFLOW_STAGES.PLAN)
  },
  onExpand: expandTerrainToRoute,
  onSearch: (query) => {
    enterPlanForEditing()
    panelHost.setCollapsed(false)
    planningPanel.search(query)
  },
  onPrimary: ({ stage, analyzeAvailable }) => {
    if (stage === WORKFLOW_STAGES.ANALYZE) {
      workflowStage?.setStage(WORKFLOW_STAGES.PLAN)
      return
    }
    if (analyzeAvailable) {
      workflowStage?.setStage(WORKFLOW_STAGES.ANALYZE)
      return
    }
    if (!mode.isPlanning()) {
      enterPlanForEditing()
      panelHost.setCollapsed(false)
      requestAnimationFrame(() => overviewMap.fit())
      return
    }
    const nextCollapsed = !panelHost.collapsed
    panelHost.setCollapsed(nextCollapsed)
    requestAnimationFrame(() => overviewMap.fit())
  },
  onSpineExpand: () => {
    enterPlanForEditing()
    panelHost.setCollapsed(false)
    requestAnimationFrame(() => overviewMap.fit())
  },
  onWeather: () => showTab('weather'),
  onMoreAction: (action) => {
    if (action === 'library') showTab('library')
    if (action === 'share') showTab('share')
    if (action === 'import') routeActions.onImportGpx()
    if (action === 'export') routeActions.onExportGpx()
    if (action === 'settings') toggleSettings()
  },
})
document.body.appendChild(plannerWorkspace.el)

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
  onPlan: () => showTab('planning'),
  onLoad: async (id) => {
    const s = await routeStoreReady
    if (!id || !s) return
    const r = await s.load(id)
    if (!r) return
    runPlanRouteMutation(() => {
      route = r
      lastSavedRouteVersion = `${r.id}:${r.revision}`
      selectedWaypointId = null
      waypointPreviewing = false
      waypointMoveDraft = null
      applyRouteModeState(route.mode, { refresh: false })
      params.routeName = r.name
      ensureRouteLayer()
      routeHistory.reset(route)
      refreshRoute()
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

// mode machine drives planning mode + panel visibility
const mode = createModeMachine({
  onChange: (m) => {
    const planning = m === MODES.PLANNING
    params.planning = planning
    setMapWorkspace({ weather: false, editing: planning })
    hud2.setTelemetryVisible(false) // telemetry is developer-only; never compete with planning
    if (planning) {
      applyPlannerView(plannerWorkspace.view)
      if (!dem) loadRealTerrain()
      ensureRouteLayer()
      refreshRoute({ fitOverview: false })
      rail.setActive('planning')
      panelHost.show('planning', '规划行程', 'ESC 退出', planningPanel.el)
      panelHost.setCollapsed(true)
      requestAnimationFrame(() => { overviewMap.resize({ fit: false }); overviewMap.update(route, lastRoutePts, currentViewportRect(), { fit: false }) })
    } else {
      document.body.classList.remove('planner-2d', 'planner-3d')
      rail.clearActive()
      panelHost.hide()
      overviewMap.update(route, lastRoutePts, currentViewportRect(), { fit: false })
    }
  },
})
workflowStage = createWorkflowStage({
  getRoute: () => route,
  onChange: applyWorkflowStage,
  onBlocked: (message) => toast.show(message),
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
      if (routeHistory.undo(route)) { applyRouteModeState(route.mode); toast.show('撤销') }
    })
    return
  }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault()
    runPlanRouteMutation(() => {
      if (routeHistory.redo(route)) { applyRouteModeState(route.mode); toast.show('重做') }
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
  mode.handleKey(e.key)
})

function showTab(id) {
  if (settingsDrawer?.classList.contains('open')) setSettingsOpen(false, { restoreFocus: false })
  if (id === 'planning') {
    setWeatherWorkspace(false)
    enterPlanForEditing()
    panelHost.setCollapsed(false)
    rail.setActive('planning')
    return
  }
  if (panelHost.currentId === id) {
    if (id === 'weather') setWeatherWorkspace(false)
    panelHost.hide(); rail.clearActive(); setMapWorkspace({ weather: false, editing: false }); return
  }
  if (mode.isPlanning()) mode.exitPlanning()
  setWeatherWorkspace(id === 'weather')
  panelHost.setCollapsed(false)
  rail.setActive(id)
  if (id === 'library') { refreshLibrary(); panelHost.show('library', '线路库', null, libraryPanel.el) }
  if (id === 'weather') panelHost.show('weather', '沿途天气', 'ESC 退出', weatherPanel.el)
  if (id === 'share') panelHost.show('share', '留存与分享', null, sharePanel.el)
}

function setMapWorkspace({ weather = false, editing = false } = {}) {
  mapWorkspaceActive = true
  document.body.classList.add('planner-operate')
  document.body.classList.toggle('weather-operate', !!weather)
  plannerWorkspace.setVisible(true)
  overviewMap.setPlannerMode(true, { editing })
  overviewMap.setWeatherMode(!!weather, weatherPreferences)
  if (weather) {
    overviewMap.setPlannerView('2d')
    setLegacyFrameModeActive(false)
  } else {
    applyPlannerView(plannerWorkspace.view)
  }
  requestAnimationFrame(() => { overviewMap.resize({ fit: false }); overviewMap.update(route, lastRoutePts, currentViewportRect(), { fit: false }) })
}

function setWeatherWorkspace(on) {
  setMapWorkspace({ weather: !!on, editing: mode.isPlanning() && !on })
}

const rail = createRail({
  items: [
    { id: 'planning', icon: 'planning', label: '规划', onSelect: () => showTab('planning') },
    { id: 'library', icon: 'library', label: '线路库', onSelect: () => showTab('library') },
    { id: 'weather', icon: 'weather', label: '天气', badge: null, disabled: false, onSelect: () => showTab('weather') },
    { id: 'share', icon: 'share', label: '分享', badge: null, disabled: false, onSelect: () => showTab('share') },
  ],
  settingsItem: { id: 'settings', icon: 'settings', label: '设置', onSelect: () => toggleSettings() },
})

// shortcuts help overlay (rail bottom, above settings)
const helpBtn = document.createElement('button')
helpBtn.className = 'ui-rail-btn ui-rail-help'
helpBtn.setAttribute('aria-label', '快捷键')
helpBtn.innerHTML = `<span class="ico">${iconSvg('help')}</span><span class="lbl">快捷键</span>`
rail.el.insertBefore(helpBtn, rail.el.lastElementChild)
const helpOv = document.createElement('div')
helpOv.className = 'ui-help-overlay hidden'
helpOv.innerHTML = `<div class="ui-help-card">
  <div class="ttl">快捷键与手势</div>
  <div class="row"><b>点击地形</b> 添加途经点(规划模式)</div>
  <div class="row"><b>拖拽标记</b> 移动途经点位置</div>
  <div class="row"><b>双击名字</b> 重命名途经点</div>
  <div class="row"><b>Ctrl+Z / Ctrl+Y</b> 撤销 / 重做</div>
  <div class="row"><b>ESC</b> 退出规划 / 取消插入</div>
  <div class="row"><b>行间 ⊕</b> 在该段后插入途经点</div>
  <button class="close">关闭</button>
</div>`
document.body.appendChild(helpOv)
helpBtn.onclick = () => helpOv.classList.toggle('hidden')
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
    hud: !!params.hud,
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

function updateLegacySettings() {
  gui.controllersRecursive().forEach((controller) => controller.updateDisplay())
}

function applyNativeSetting(key, value, { commit = true } = {}) {
  if (['demLat', 'demLon', 'demZoom', 'demExaggeration', 'exposure', 'contrast', 'saturation', 'fogNear', 'fogFar'].includes(key)) value = Number(value)
  if (key === 'source') {
    params.source = value
    if (value === 'real') loadRealTerrain()
    else {
      settingsPanel?.setTerrainStatus('loading', '正在生成程序化地形…')
      settingsTerrainReadyText = '已切换到程序化地形'
      regenerateTerrain()
    }
  } else if (key === 'demLocation') {
    params.demLocation = value
    const preset = DEM_PRESETS[value]
    if (preset) {
      params.demLat = preset[0]
      params.demLon = preset[1]
      if (params.source === 'real') loadRealTerrain()
    }
  } else if (key === 'demLat' || key === 'demLon') {
    params[key] = value
    params.demLocation = 'Custom'
  } else if (key === 'demZoom') {
    params.demZoom = value
    if (params.source === 'real') loadRealTerrain()
  } else if (key === 'demExaggeration') {
    params.demExaggeration = value
    overviewMap?.setTerrainExaggeration(value)
    if (commit && params.source === 'real') regenerateTerrain()
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
  updateLegacySettings()
  syncSettingsControls()
}

function applyNativeLayer(id, on) {
  layerBtns?.get(id)?.set(!!on, { notify: true })
  updateLegacySettings()
  syncSettingsControls()
}

function loadCurrentSettingsTerrain() {
  if (params.source === 'real') loadRealTerrain()
  else {
    settingsPanel?.setTerrainStatus('loading', '正在生成程序化地形…')
    settingsTerrainReadyText = '程序化地形已更新'
    regenerateTerrain()
  }
}

// Mount settings only while the drawer is open. The retained experiment GUI
// keeps its runtime state but leaves the document and accessibility tree on close.
const settingsDrawer = document.createElement('div')
settingsDrawer.className = 'ui-settings'
settingsDrawer.setAttribute('role', 'dialog')
settingsDrawer.setAttribute('aria-label', '显示与地形设置')
settingsDrawer.setAttribute('aria-hidden', 'true')
settingsDrawer.inert = true
document.body.appendChild(settingsDrawer)
gui.domElement.remove()
let settingsReturnFocus = null

function mountSettingsPanel() {
  if (settingsPanel?.el?.isConnected) return
  settingsPanel = createSettingsPanel({
    presets: Object.keys(DEM_PRESETS),
    advancedEl: gui.domElement,
    summaryPreferences,
    weatherPreferences,
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
  })
  settingsDrawer.appendChild(settingsPanel.el)
  syncSettingsControls()
}

function setSettingsOpen(open, { restoreFocus = true } = {}) {
  document.body.classList.toggle('settings-open', !!open)
  if (open) {
    settingsReturnFocus = document.activeElement
    mountSettingsPanel()
    setMapWorkspace({ weather: false, editing: mode.isPlanning() })
    plannerWorkspace.setLayersOpen(false)
    if (!mode.isPlanning() && panelHost.currentId) {
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

// high-frequency layer toggles (reuse lil-gui controllers so onChange chains fire)
layerBtns = createLayerButtons({
  buttons: [
    { id: 'contour', icon: 'contour', tip: '等高线', initial: params.contourOpacity > 0, onToggle: (id, on) => contourOpacityCtrl.setValue(on ? 1 : 0) },
    { id: 'grid', icon: 'grid', tip: '测量网格', initial: params.gridOpacity > 0, onToggle: (id, on) => gridOpacityCtrl.setValue(on ? 1 : 0) },
    { id: 'labels', icon: 'labels', tip: '山峰标签', initial: params.labels, onToggle: (id, on) => labelsCtrl.setValue(on) },
    { id: 'mapov', icon: 'roads', tip: '路网叠加', initial: params.mapOverlay, onToggle: (id, on) => { params.mapOverlay = on; terrain.setOverlayMix(on ? 0.55 : 0) } },
    { id: 'admin', icon: 'admin', tip: '行政区划', initial: false, repeatOpensPanel: true, onToggle: (id, on) => setAdminEnabled(on), onPanelToggle: (id, open) => setAdminPanelOpen(open) },
    { id: 'sun', icon: 'sun', tip: '日照分析', initial: false, onToggle: (id, on) => { sunState.on = on; sunPanel.classList.toggle('hidden', !on); document.body.classList.toggle('sun-open', on); if (on) applySun() } },
    { id: 'hud', icon: 'hud', tip: 'HUD', initial: params.hud, onToggle: (id, on) => hudCtrl.setValue(on) },
  ],
  onStateChange: syncSettingsControls,
})
syncSettingsControls()

// restore shared route from URL hash BEFORE the default DEM load below.
// The startup line runs `if (params.source === 'real') loadRealTerrain()` once —
// decode first so that single load fetches the SHARED center, not Monument Valley.
if (location.hash.startsWith('#r=')) {
  try {
    const shared = decodeShare(location.hash.slice(3))
    params.demLat = shared.dem.lat
    params.demLon = shared.dem.lon
    params.demZoom = shared.dem.zoom
    if (shared.dem.ta) params.tilesAcross = shared.dem.ta // wide-view grids ride along
    params.demLocation = 'Custom'
    route = createRoute(shared.name, shared.mode)
    selectedWaypointId = null
    waypointPreviewing = false
    waypointMoveDraft = null
    applyRouteModeState(route.mode, { persist: false, refresh: false })
    params.routeName = shared.name
    for (const w of shared.waypoints) addWaypoint(route, w.lon, w.lat, w.ele, w.name)
    if (shared.days?.length) route.dayEnds = shared.days.map((i) => route.waypoints[i]?.id).filter(Boolean)
    routeHistory.reset(route)
    params.planning = true
    // no explicit loadRealTerrain() call — the startup line below does it once
  } catch (err) {
    console.warn('bad share hash', err)
  }
}

if (params.planning) {
  params.planning = false
  mode.enterPlanning()
} else {
  setMapWorkspace({ weather: false, editing: false })
}

// console access for debugging/scripting
window.__exp = { scene, camera, controls, params, terrain, loadRealTerrain, loadAdminBoundaries, expandTerrainToRoute, plannerWorkspace, overviewMap, get renderStats() { return { legacyFps: fps, legacyFrames: legacyFrameLoop?.frameCount ?? 0, legacyFrameLoopRunning: legacyFrameLoop?.running ?? false, plannerTerrain: overviewMap.terrainState } }, get routeCoverage() { return lastRouteCoverage }, get routeAnalysis() { return lastRouteAnalysis }, get terrainState() { return { demBusy, demRequestId, rebuildPending, rebuildQueued, terrainGen } }, get routingState() { return { on: snapState.on, profile: snapProfile, version: snapState.version, demKey: snapState.demKey } }, get adminState() { return adminState }, get adminInteraction() { return adminInteraction }, get adminLayer() { return adminLayer }, get labels() { return labels }, get route() { return route }, get geo() { return geo }, get dem() { return dem } }

// real world is the default source — fetch its tiles on startup
if (params.source === 'real') loadRealTerrain()

routeHistory.reset(route) // baseline for undo/redo (after any hash restore above)

// after first build: restore snap toggle UI + re-snap a hash-restored route
whenTerrainBuilt(1).then(() => {
  planningPanel.setRouteMode(route.mode, snapState.on ? '等待路网吸附' : '仅测距；不估算时长')
  if (snapState.on && route.waypoints.length >= 2) scheduleSnap()
})

const clock = new THREE.Clock()

function hasLegacyFrameWork() {
  return flyState.active || tour.active || tween.active || scanStart >= 0
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  // cinematic tour: arc-length uniform speed + trapezoid profile + damped gimbal
  // focus mode: tours & recordings hide all UI floats (single toggle per frame)
  document.body.classList.toggle('focus-mode', tour.active || flyState.active)
  if (flyState.active) {
    // flyover recording: camera walks the route path; highest priority
    flyState.t += dt
    const frac = Math.min(1, flyState.t / flyState.dur)
    const idx = Math.min(flyState.path.length - 1, Math.floor(frac * (flyState.path.length - 1)))
    const f = cameraFrame(flyState.path, idx, flyState.ground, { height: 2.6, lookAhead: 2, targetLift: 0.35 })
    camera.position.set(f.pos.x, f.pos.y, f.pos.z)
    camera.up.set(0, 1, 0)
    camera.lookAt(f.target.x, f.target.y, f.target.z)
    controls.target.set(f.target.x, f.target.y, f.target.z)
    flyOverlay.querySelector('.fill').style.transform = `scaleX(${frac.toFixed(3)})`
    if (frac >= 1) stopFlyover(true)
  } else if (tour.active) {
    tour.t = Math.min(1, tour.t + dt / params.tourDuration)
    const s = trapezoid(tour.t, 0.18)

    // position: exact on the spline, constant speed thanks to getPointAt
    tour.curve.getPointAt(s, _tp)
    camera.position.copy(_tp)

    // desired orientation: look at the gaze target, rolled into the turn
    tourGaze(s, _tp, _tg)
    controls.target.copy(_tg)
    _tm.lookAt(camera.position, _tg, UP)
    _tq.setFromRotationMatrix(_tm)
    tour.curve.getTangentAt(s, _tt0)
    tour.curve.getTangentAt(Math.min(s + 0.02, 1), _tt1)
    const curl = _tt0.x * _tt1.z - _tt0.z * _tt1.x // signed xz turn over the window
    const arrived = tour.t >= 1
    // after arrival: settle — unwind the bank and let the gimbal fully converge
    // before handing off, so OrbitControls has nothing to snap to
    const bankTarget = arrived ? 0 : THREE.MathUtils.clamp(curl * 15 * params.tourBank, -0.5, 0.5)
    tour.bank = THREE.MathUtils.damp(tour.bank, bankTarget, 2.5, dt)
    _tq.multiply(_tqr.setFromAxisAngle(Z_AXIS, tour.bank))

    // gimbal: rotation chases the desired orientation with a max slew rate,
    // so it can never jump — 80°/s hard ceiling
    const angle = camera.quaternion.angleTo(_tq)
    if (angle > 1e-5) {
      const f = Math.min(1 - Math.exp(-3.2 * dt), (1.4 * dt) / angle)
      camera.quaternion.slerp(_tq, f)
    }

    if (arrived && angle < 0.001 && Math.abs(tour.bank) < 0.001) tour.active = false
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

  if (!params.paused) {
    hud3.update(dt, t, params)
    cone.update(dt, t, mouse, params)
  }

  // terrain scan ripple progress
  if (scanStart >= 0) {
    const p = (performance.now() / 1000 - scanStart) / params.scanDuration
    if (p >= 1) {
      scanStart = -1
      terrain.mapUniforms.uScanT.value = -1
    } else {
      terrain.mapUniforms.uScanT.value = p
    }
  }

  if (params.autoFocus) {
    params.focusDistance = camera.position.distanceTo(cone.getFocusPoint())
  }
  dof.cocMaterial.worldFocusDistance = params.focusDistance

  if (params.hud) {
    fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05
    const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
    const secs = Math.floor(t)
    hud2.update(dt, camera, window.innerWidth, window.innerHeight, {
      conePoint: cone.getFocusPoint(),
      pois,
      az: THREE.MathUtils.radToDeg(sph.theta),
      el: 90 - THREE.MathUtils.radToDeg(sph.phi),
      focus: params.focusDistance,
      fps,
      clock: `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`,
      coneAlt: cone.group.position.y,
      spin: params.coneSpin,
    })
  }

  if ((!params.planning && !mapWorkspaceActive) || flyState.active) composer.render(dt)
  if (!legacyFrameModeActive && !hasLegacyFrameWork()) legacyFrameLoop.stop()
}

legacyFrameLoop = createFrameScheduler({ onFrame: tick })
const startLegacyFrames = legacyFrameStartPending || legacyFrameModeActive || hasLegacyFrameWork()
legacyFrameStartPending = false
if (startLegacyFrames) legacyFrameLoop.start()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  routeLayer?.setResolution(window.innerWidth, window.innerHeight)
  overviewMap.resize()
})
