// Admin boundary 3D layer: draped boundary lines + centroid name sprites.
import * as THREE from 'three'

function makeLabelSprite(text, accent = '#17191b') {
  const pad = 10
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = 'bold 26px monospace'
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2
  c.width = w
  c.height = 40
  const c2 = c.getContext('2d')
  c2.fillStyle = 'rgba(255,255,255,0.88)'
  c2.fillRect(0, 0, w, 40)
  c2.strokeStyle = 'rgba(23,25,27,0.5)'
  c2.strokeRect(0.5, 0.5, w - 1, 39)
  c2.font = 'bold 26px monospace'
  c2.fillStyle = accent
  c2.textBaseline = 'middle'
  c2.fillText(text, pad, 21)
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }))
  sp.scale.set(w / 40 * 0.5, 0.5, 1) // worldScale ~0.5 per 40px unit
  return sp
}

// rings: [{ name, level, ring:[[lon,lat],...] }] (already bbox-filtered)
// toWorld(lon, lat) → { x, z }; heightAt(x, z) → world Y; inView(lon, lat) → bool
export function createAdminLayer({ toWorld, heightAt, inView = () => true }) {
  const group = new THREE.Group()
  group.visible = false

  const provinceMat = new THREE.LineBasicMaterial({ color: 0xff4d00, transparent: true, opacity: 1, depthTest: false })
  const districtMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.5, gapSize: 0.25, transparent: true, opacity: 0.95, depthTest: false })

  return {
    group,
    setRings(rings) {
      group.clear()
      if (!rings.length) return
      for (const r of rings) {
        const pts = []
        for (const [lon, lat] of r.ring) {
          const w = toWorld(lon, lat)
          if (!w || !Number.isFinite(w.x)) continue
          pts.push(new THREE.Vector3(w.x, heightAt(w.x, w.z) + 0.03, w.z))
        }
        if (pts.length < 3) continue
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        const isProvince = r.level === 'province'
        const line = new THREE.Line(geo, isProvince ? provinceMat : districtMat)
        line.renderOrder = 5 // draw above the terrain surface
        if (!isProvince) line.computeLineDistances()
        group.add(line)
        // name label at the midpoint of the clipped (in-viewport) ring —
        // raw centroids of huge polygons sit far outside the viewport
        if (r.name) {
          const anchor = r.ring[Math.floor(r.ring.length / 2)]
          if (anchor) {
            const cw = toWorld(anchor[0], anchor[1])
            if (cw && Number.isFinite(cw.x)) {
              const sp = makeLabelSprite(r.name, isProvince ? '#ff4d00' : '#17191b')
              sp.scale.multiplyScalar(1.7)
              sp.position.set(cw.x, heightAt(cw.x, cw.z) + (isProvince ? 1.4 : 0.9), cw.z)
              group.add(sp)
            }
          }
        }
      }
    },
    setVisible(v) { group.visible = v },
    clear() { group.clear() },
  }
}
