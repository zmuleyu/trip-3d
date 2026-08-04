// RouteLayer: waypoint markers (numbered sprites) + terrain-draped route line.
// Thin three.js glue over src/lib pure modules — verified manually in dev server.
// All volatile deps (terrain.sample, geo, elevOf) are injected as GETTERS and
// re-evaluated on every update() — terrain.rebuild() replaces terrain.sample
// (terrain.js:262), and DEM switches replace geo/dem; cached refs would go stale.
import * as THREE from 'three'
import { lonLatToWorld } from '../lib/geo.js'
import { sampleRoutePath } from '../lib/route.js'

const LINE_LIFT = 0.09 // world units above surface to avoid z-fighting
const MARKER_R = 0.28

function makeNumberSprite(n, accent = '#ff4d00') {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(64, 64, 56, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 64px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), 64, 68)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }))
  sp.scale.setScalar(1.6)
  return sp
}

export class RouteLayer {
  // getSample: () => (x,z)=>sceneHeight; getGeo: () => geoCtx; getElevOf: () => (x,z)=>meters
  constructor(getSample, getGeo, getElevOf) {
    this.getSample = getSample
    this.getGeo = getGeo
    this.getElevOf = getElevOf
    this.group = new THREE.Group()
    this.group.renderOrder = 10
    this._line = null
    this._markers = []
  }

  _clear() {
    for (const m of this._markers) {
      m.material.map.dispose()
      m.material.dispose()
      this.group.remove(m)
    }
    this._markers = []
    if (this._line) {
      this._line.geometry.dispose()
      this._line.material.dispose()
      this.group.remove(this._line)
      this._line = null
    }
  }

  // returns sampled path pts for stats/profile panels; [] when <2 waypoints
  update(waypoints) {
    this._clear()
    const sample = this.getSample()
    const geo = this.getGeo()
    waypoints.forEach((w, i) => {
      const { x, z } = lonLatToWorld(geo, w.lon, w.lat)
      const sp = makeNumberSprite(i + 1)
      sp.position.set(x, sample(x, z) + MARKER_R + 0.5, z)
      this._markers.push(sp)
      this.group.add(sp)
    })
    if (waypoints.length < 2) return []
    const pts = sampleRoutePath(geo, waypoints, this.getElevOf())
    const verts = new Float32Array(pts.length * 3)
    pts.forEach((p, i) => {
      verts[i * 3] = p.x
      verts[i * 3 + 1] = sample(p.x, p.z) + LINE_LIFT
      verts[i * 3 + 2] = p.z
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    this._line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ff4d00' }))
    this.group.add(this._line)
    return pts
  }
}
