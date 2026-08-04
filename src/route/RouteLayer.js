// RouteLayer: waypoint markers (numbered sprites, flags at start/end) +
// terrain-draped fat route line (Line2 casing + vertex-colored slope gradient) +
// direction arrow cones + distance tick sprites + crosshair cursor.
// Thin three.js glue over src/lib pure modules — verified via E2E.
// All volatile deps (terrain.sample, geo, elevOf) are GETTER-INJECTED:
// terrain.rebuild() replaces terrain.sample (terrain.js:262) — never capture by value.
import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { lonLatToWorld } from '../lib/geo.js'
import { sampleRoutePath } from '../lib/route.js'
import { slopeColorOf, segmentSlopeDeg, tickIntervalM, ARROW_SPACING_M } from '../lib/slopeStyle.js'

const LINE_LIFT = 0.12 // world units above the surface (camera-space px → world)
const MARKER_R = 0.5
const ACCENT = '#ff4d00'
const INK = '#17191b'

function makeTextSprite(text, { bg = ACCENT, fg = '#ffffff', size = 44, round = true, worldScale = 0.9 } = {}) {
  const pad = 8
  const c = document.createElement('canvas')
  const mctx = c.getContext('2d')
  mctx.font = `bold ${size}px monospace`
  const w = Math.ceil(mctx.measureText(text).width) + pad * 2
  c.width = w
  c.height = size + pad * 2
  const ctx = c.getContext('2d')
  if (round) {
    ctx.beginPath()
    ctx.arc(c.width / 2, c.height / 2, Math.min(c.width, c.height) / 2 - 2, 0, Math.PI * 2)
    ctx.fillStyle = bg
    ctx.fill()
  } else {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.fillStyle = fg
  ctx.font = `bold ${size}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, c.width / 2, c.height / 2 + 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }))
  sp.scale.set(worldScale * (c.width / c.height), worldScale, 1)
  return sp
}

function makeFlagSprite(color) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')
  ctx.strokeStyle = INK
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(18, 60)
  ctx.lineTo(18, 6)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(20, 8)
  ctx.lineTo(56, 18)
  ctx.lineTo(20, 30)
  ctx.closePath()
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }))
  sp.scale.set(1.3, 1.3, 1)
  sp.center.set(0.28, 0.1) // pole bottom ≈ anchor point
  return sp
}

const ARROW_GEO = new THREE.ConeGeometry(0.11, 0.34, 5) // world units — subtle at near camera
const ARROW_MAT = new THREE.MeshBasicMaterial({ color: ACCENT })

export class RouteLayer {
  // getSceneSample / getGeo / elevOfWorld are GETTERS (live lookup per call).
  constructor(getSceneSample, getGeo, elevOfWorld) {
    this._getSceneSample = getSceneSample
    this._getGeo = getGeo
    this._elevOfWorld = elevOfWorld
    this.group = new THREE.Group()
    this.group.renderOrder = 10
    this.crosshair = null
    this._res = { w: 1280, h: 720 }
  }

  _clear() {
    for (const ch of [...this.group.children]) {
      this.group.remove(ch)
      ch.traverse?.((o) => {
        // shared arrow resources are owned by the layer, never disposed per-child
        if (o.geometry === ARROW_GEO || o.material === ARROW_MAT) return
        o.geometry?.dispose?.()
        if (o.material) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            m.map?.dispose?.()
            m.dispose?.()
          }
        }
      })
    }
    this.crosshair = null
  }

  setResolution(w, h) {
    this._res = { w, h }
    for (const ch of this.group.children) {
      if (ch.isLine2) ch.material.resolution.set(w, h)
    }
  }

  _sampleAt(pts, targetM) {
    // interpolate along cumDistM
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].cumDistM >= targetM) {
        const a = pts[i - 1], b = pts[i]
        const f = (targetM - a.cumDistM) / Math.max(b.cumDistM - a.cumDistM, 1e-6)
        return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, bearing: Math.atan2(b.x - a.x, b.z - a.z) }
      }
    }
    const l = pts.at(-1)
    return { x: l.x, z: l.z, bearing: 0 }
  }

  // Returns sampled pts ([] when <2 waypoints) — callers feed profile/stats.
  // opts: { slopeColors, arrows, ticks } (all default true)
  update(waypoints, opts = {}) {
    const { slopeColors = true, arrows = true, ticks = true } = opts
    this._clear()
    const geo = this._getGeo()
    const sceneSample = this._getSceneSample()
    if (!geo || !sceneSample) return []

    // markers: numbered circles; start/end flags
    waypoints.forEach((w, i) => {
      const { x, z } = lonLatToWorld(geo, w.lon, w.lat)
      const isFirst = i === 0
      const isLast = i === waypoints.length - 1
      let sp
      if (isFirst && waypoints.length > 1) sp = makeFlagSprite('#3d9970')
      else if (isLast && waypoints.length > 1) sp = makeFlagSprite('#d32f2f')
      else sp = makeTextSprite(String(i + 1))
      const lift = sp.center && sp.center.y < 0.5 ? MARKER_R + 0.2 : MARKER_R + 0.5
      sp.position.set(x, sceneSample(x, z) + lift, z)
      this.group.add(sp)
    })

    if (waypoints.length < 2) return []
    const elevOf = this._elevOfWorld() // getter → the fn (call-time geo/dem binding)
    const pts = sampleRoutePath(geo, waypoints, elevOf)
    const positions = new Float32Array(pts.length * 3)
    const colors = new Float32Array(pts.length * 3)
    pts.forEach((p, i) => {
      positions[i * 3] = p.x
      positions[i * 3 + 1] = sceneSample(p.x, p.z) + LINE_LIFT
      positions[i * 3 + 2] = p.z
      // slope of segment starting at i (forward diff; last reuses previous)
      const j = Math.min(i + 1, pts.length - 1)
      const k = Math.max(j - 1, 0)
      const rise = pts[j].ele - pts[k].ele
      const run = pts[j].cumDistM - pts[k].cumDistM
      const col = slopeColors ? slopeColorOf(segmentSlopeDeg(rise, run)) : [1, 0.30, 0]
      colors[i * 3] = col[0]
      colors[i * 3 + 1] = col[1]
      colors[i * 3 + 2] = col[2]
    })

    const mkLine = (linewidth, useColors, color) => {
      const g = new LineGeometry()
      g.setPositions(positions)
      if (useColors) g.setColors(colors)
      const m = new LineMaterial({
        linewidth,
        vertexColors: useColors,
        color: useColors ? 0xffffff : color,
        dashed: false,
        alphaToCoverage: false,
      })
      m.resolution.set(this._res.w, this._res.h)
      const line = new Line2(g, m)
      line.computeLineDistances()
      return line
    }
    const casing = mkLine(5.0, false, INK) // dark casing underneath (readability)
    casing.renderOrder = 10
    const main = mkLine(4.0, slopeColors, ACCENT)
    main.renderOrder = 11
    this.group.add(casing, main)

    const totalM = pts.at(-1).cumDistM

    // direction arrows every ARROW_SPACING_M (skip near start/end and near ticks),
    // spacing widened to keep arrow count under MAX_ARROWS on very long routes
    const MAX_ARROWS = 120
    if (arrows && totalM > ARROW_SPACING_M * 1.5) {
      const tickStep = ticks && totalM > 1200 ? tickIntervalM(totalM) : Infinity
      const arrowStep = Math.max(ARROW_SPACING_M, totalM / MAX_ARROWS)
      for (let d = arrowStep; d < totalM - 60; d += arrowStep) {
        if (d % tickStep < 120 || tickStep - (d % tickStep) < 120) continue
        const { x, z, bearing } = this._sampleAt(pts, d)
        const cone = new THREE.Mesh(ARROW_GEO, ARROW_MAT)
        cone.rotation.order = 'YXZ'
        cone.rotation.y = bearing
        cone.rotation.x = Math.PI / 2 // lie flat, pointing along path
        cone.position.set(x, sceneSample(x, z) + LINE_LIFT + 0.18, z)
        this.group.add(cone)
      }
    }

    // distance ticks
    if (ticks && totalM > 1200) {
      const interval = tickIntervalM(totalM)
      for (let d = interval; d < totalM; d += interval) {
        const { x, z } = this._sampleAt(pts, d)
        const sp = makeTextSprite(`${d / 1000}k`, { bg: INK, size: 40, worldScale: 0.55 })
        sp.position.set(x, sceneSample(x, z) + MARKER_R + 0.3, z)
        this.group.add(sp)
      }
    }

    return pts
  }

  // crosshair cursor at sampled path point (profile hover sync)
  showCrosshair(pt) {
    const sceneSample = this._getSceneSample()
    if (!sceneSample) return
    if (!this.crosshair) {
      this.crosshair = makeTextSprite('◉', { bg: 'rgba(0,0,0,0)', fg: ACCENT, size: 56, round: false })
      this.group.add(this.crosshair)
    }
    this.crosshair.position.set(pt.x, sceneSample(pt.x, pt.z) + LINE_LIFT + 0.3, pt.z)
    this.crosshair.visible = true
  }

  hideCrosshair() {
    if (this.crosshair) this.crosshair.visible = false
  }
}
