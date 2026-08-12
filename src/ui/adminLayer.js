// Admin boundary 3D layer: draped boundary lines + halo name sprites.
import * as THREE from 'three'

const LEVEL_STYLE = {
  province: { color: 0x278ed8, opacity: 0.92, dashed: false, label: '#15597d', lift: 1.4 },
  city: { color: 0x89c9ef, opacity: 0.78, dashed: false, label: '#245f7c', lift: 1.05 },
  district: { color: 0x6d8795, opacity: 0.72, dashed: true, label: '#244654', lift: 0.9 },
}

function makeLabelSprite(text, accent) {
  const pad = 12
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = 'bold 26px monospace'
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2
  c.width = w
  c.height = 44
  const c2 = c.getContext('2d')
  c2.font = 'bold 26px monospace'
  c2.textBaseline = 'middle'
  c2.lineJoin = 'round'
  c2.lineWidth = 7
  c2.strokeStyle = 'rgba(255,255,255,0.94)'
  c2.strokeText(text, pad, 23)
  c2.fillStyle = accent
  c2.fillText(text, pad, 23)
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  const material = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(w / 44 * 0.56, 0.56, 1)
  sprite.renderOrder = 6
  return sprite
}

const regionKey = (region) => String(region?.adcode || `${region?.level}:${region?.name}`)

// rings: [{ name, level, adcode, centroid, ring:[[lon,lat],...] }] (bbox-clipped)
export function createAdminLayer({ toWorld, heightAt }) {
  const group = new THREE.Group()
  group.name = 'admin-boundaries'
  group.visible = false
  let level = 'auto'
  let selectedKey = null
  let hoveredKey = null

  function disposeChildren() {
    for (const child of group.children) {
      child.geometry?.dispose?.()
      child.material?.map?.dispose?.()
      child.material?.dispose?.()
    }
    group.clear()
  }

  function applyVisibility() {
    for (const child of group.children) child.visible = level === 'auto' || child.userData.level === level
  }

  function applyEmphasis() {
    for (const child of group.children) {
      const key = child.userData.regionKey
      const selected = key && key === selectedKey
      const hovered = key && key === hoveredKey
      if (child.userData.kind === 'boundary') {
        child.material.color.setHex(selected ? 0x005f8f : hovered ? 0x20a7ea : child.userData.baseColor)
        child.material.opacity = selected ? 1 : hovered ? 0.98 : child.userData.baseOpacity
      } else if (child.userData.kind === 'label') {
        child.material.opacity = selected ? 1 : hovered ? 0.96 : 0.82
      }
    }
  }

  return {
    group,
    setRings(rings) {
      disposeChildren()
      for (const region of rings) {
        const style = LEVEL_STYLE[region.level] ?? LEVEL_STYLE.district
        const points = []
        for (const [lon, lat] of region.ring) {
          const world = toWorld(lon, lat)
          if (!world || !Number.isFinite(world.x)) continue
          points.push(new THREE.Vector3(world.x, heightAt(world.x, world.z) + 0.04, world.z))
        }
        if (points.length < 2) continue
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const material = style.dashed
          ? new THREE.LineDashedMaterial({ color: style.color, dashSize: 0.48, gapSize: 0.28, transparent: true, opacity: style.opacity, depthTest: false })
          : new THREE.LineBasicMaterial({ color: style.color, transparent: true, opacity: style.opacity, depthTest: false })
        const line = new THREE.Line(geometry, material)
        line.renderOrder = 5
        if (style.dashed) line.computeLineDistances()
        line.userData = { kind: 'boundary', level: region.level, region, regionKey: regionKey(region), baseColor: style.color, baseOpacity: style.opacity }
        group.add(line)

        if (region.name) {
          const anchor = region.ring[Math.floor(region.ring.length / 2)]
          const world = anchor && toWorld(anchor[0], anchor[1])
          if (world && Number.isFinite(world.x)) {
            const sprite = makeLabelSprite(region.name, style.label)
            sprite.scale.multiplyScalar(region.level === 'province' ? 1.45 : 1.22)
            sprite.position.set(world.x, heightAt(world.x, world.z) + style.lift, world.z)
            sprite.userData = { kind: 'label', level: region.level, region, regionKey: regionKey(region) }
            group.add(sprite)
          }
        }
      }
      applyVisibility()
      applyEmphasis()
    },
    setLevel(value) { level = value; applyVisibility() },
    setSelected(region) { selectedKey = region ? regionKey(region) : null; applyEmphasis() },
    setHovered(region) { hoveredKey = region ? regionKey(region) : null; applyEmphasis() },
    setVisible(value) { group.visible = value },
    clear() { disposeChildren() },
  }
}
