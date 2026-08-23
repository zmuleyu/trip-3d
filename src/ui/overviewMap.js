// Overview inset map — DOM/canvas component. Renders OSM tiles + route +
// waypoints + the current 3D viewport rectangle. All projection math lives in
// lib/overview.js (pure, TDD'd). Tiles and route share the same linear
// equirectangular projection, so they stay mutually consistent.
import { viewFromPoints, projectToView, unprojectFromView, tileXYToLonLat } from '../lib/overview.js'

const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
const ACCENT = '#ff4d00'

export function createOverviewMap({ onJump, onPlanAdd } = {}) {
  const el = document.createElement('div')
  el.className = 'ui-overview hidden'
  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 150
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', '二维路线规划地图；点击添加途经点')
  const credit = document.createElement('div')
  credit.className = 'ui-overview-credit'
  credit.textContent = '© OpenStreetMap'
  el.append(canvas, credit)
  const ctx = canvas.getContext('2d')

  let view = null
  let lastRoute = null
  let lastPts = null
  let viewportLonLat = null // {minLon,minLat,maxLon,maxLat}
  let plannerMode = false
  let logicalWidth = 200
  let logicalHeight = 150
  let pixelRatio = 1
  const tileCache = new Map() // key → ImageBitmap | 'pending' | 'error'
  let redrawTimer = null

  async function loadTile(z, x, y) {
    const key = `${z}/${x}/${y}`
    if (tileCache.has(key)) return tileCache.get(key)
    tileCache.set(key, 'pending')
    try {
      const res = await fetch(TILE_URL(z, x, y))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const bmp = await createImageBitmap(await res.blob())
      tileCache.set(key, bmp)
      scheduleRedraw()
      return bmp
    } catch {
      tileCache.set(key, 'error')
      return null
    }
  }

  function draw() {
    if (!view) return
    const W = logicalWidth
    const H = logicalHeight
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#f4f0e6'
    ctx.fillRect(0, 0, W, H)
    // tiles (each stretched into the linear projection)
    for (let tx = view.x0; tx <= view.x1; tx++) {
      for (let ty = view.y0; ty <= view.y1; ty++) {
        const bmp = tileCache.get(`${view.z}/${tx}/${ty}`)
        if (!bmp || bmp === 'pending' || bmp === 'error') {
          if (!bmp) loadTile(view.z, tx, ty)
          continue
        }
        const nw = tileXYToLonLat(tx, ty, view.z)
        const se = tileXYToLonLat(tx + 1, ty + 1, view.z)
        const p0 = projectToView(nw.lon, nw.lat, view)
        const p1 = projectToView(se.lon, se.lat, view)
        ctx.drawImage(bmp, p0.x, p0.y, p1.x - p0.x, p1.y - p0.y)
      }
    }
    // route polyline (sampled pts when available for real path shape)
    const path = lastPts?.length >= 2 ? lastPts : lastRoute?.waypoints
    if (path?.length >= 2) {
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 2
      ctx.beginPath()
      path.forEach((p, i) => {
        const pt = projectToView(p.lon, p.lat, view)
        i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)
      })
      ctx.stroke()
    }
    // waypoint dots
    const wps = lastRoute?.waypoints ?? []
    wps.forEach((w, i) => {
      const pt = projectToView(w.lon, w.lat, view)
      ctx.fillStyle = i === 0 ? '#3d9970' : i === wps.length - 1 ? '#d32f2f' : '#888'
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
    // 3D viewport rectangle (clamped — a viewport larger than the inset would
    // otherwise stroke entirely off-canvas)
    if (viewportLonLat) {
      const a = projectToView(viewportLonLat.minLon, viewportLonLat.maxLat, view)
      const b = projectToView(viewportLonLat.maxLon, viewportLonLat.minLat, view)
      const rx = Math.max(0, Math.min(a.x, b.x))
      const ry = Math.max(0, Math.min(a.y, b.y))
      const rw = Math.min(W, Math.max(a.x, b.x)) - rx
      const rh = Math.min(H, Math.max(a.y, b.y)) - ry
      if (rw > 2 && rh > 2) {
        // inset when the viewport covers (nearly) the whole inset, so the frame
        // stays distinguishable from the container border
        const inset = rw >= W - 2 && rh >= H - 2 ? 3 : 0.5
        ctx.strokeStyle = '#17191b'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.strokeRect(rx + inset, ry + inset, rw - inset * 2, rh - inset * 2)
        ctx.setLineDash([])
      }
    }
  }

  function scheduleRedraw() {
    if (redrawTimer) return
    redrawTimer = setTimeout(() => { redrawTimer = null; draw() }, 120)
  }

  function rebuildView() {
    const wps = lastRoute?.waypoints ?? []
    const fallback = viewportLonLat
      ? [
          { lon: viewportLonLat.minLon, lat: viewportLonLat.minLat },
          { lon: viewportLonLat.maxLon, lat: viewportLonLat.maxLat },
        ]
      : []
    const viewPoints = wps.length >= 2 ? wps : fallback
    if (viewPoints.length < 2) { view = null; return }
    view = viewFromPoints(viewPoints, logicalWidth, logicalHeight)
    for (let tx = view.x0; tx <= view.x1; tx++) for (let ty = view.y0; ty <= view.y1; ty++) loadTile(view.z, tx, ty)
  }

  function resize() {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      logicalWidth = Math.max(200, Math.round(rect.width))
      logicalHeight = Math.max(150, Math.round(rect.height - credit.offsetHeight))
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(logicalWidth * pixelRatio)
      canvas.height = Math.round(logicalHeight * pixelRatio)
      canvas.style.width = `${logicalWidth}px`
      canvas.style.height = `${logicalHeight}px`
    }
    if (lastRoute || viewportLonLat) rebuildView()
    if (view) draw()
  }

  canvas.addEventListener('click', (e) => {
    if (!view) return
    const r = canvas.getBoundingClientRect()
    const x = (e.clientX - r.left) * logicalWidth / Math.max(1, r.width)
    const y = (e.clientY - r.top) * logicalHeight / Math.max(1, r.height)
    const { lon, lat } = unprojectFromView(x, y, view)
    if (plannerMode && onPlanAdd) onPlanAdd(lon, lat)
    else onJump?.(lon, lat)
  })

  return {
    el,
    setPlannerMode(on) {
      plannerMode = !!on
      el.classList.toggle('planner', plannerMode)
      if (plannerMode) el.classList.remove('hidden')
      requestAnimationFrame(resize)
    },
    resize,
    focusPlanner() { canvas.focus() },
    // route: waypoints source; pts: sampled path (snapped/spline) or null; viewport: lon/lat rect
    update(route, pts, viewport) {
      lastRoute = route
      lastPts = pts
      viewportLonLat = viewport
      const wps = route?.waypoints ?? []
      if (wps.length < 2 && !plannerMode) {
        el.classList.add('hidden')
        view = null
        return
      }
      el.classList.remove('hidden')
      rebuildView()
      if (!view) return
      draw()
    },
    updateViewport(viewport) {
      viewportLonLat = viewport
      if (view) scheduleRedraw()
    },
  }
}
