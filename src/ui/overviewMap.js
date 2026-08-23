// Interactive OSM route-planning map. Tiles, route geometry, pointer input,
// and the 3D terrain footprint share the same Web Mercator pixel space.
import {
  TILE_SIZE,
  metersPerPixel,
  panView,
  projectToView,
  resizeView,
  resizeViewFromTop,
  tileXYToLonLat,
  unprojectFromView,
  viewFromPoints,
  zoomView,
} from '../lib/overview.js'
import { iconSvg } from './icons.js'

const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
const ACCENT = '#ff4d00'

function footprintPoints(viewport) {
  if (!viewport) return []
  return [
    { lon: viewport.minLon, lat: viewport.minLat },
    { lon: viewport.maxLon, lat: viewport.maxLat },
  ]
}

function routeKey(route) {
  return (route?.waypoints ?? []).map((point) => `${point.lon.toFixed(5)},${point.lat.toFixed(5)}`).join('|')
}

function formatScale(meters) {
  if (meters >= 1000) return `${meters / 1000} km`
  return `${meters} m`
}

function niceScale(targetMeters) {
  if (!Number.isFinite(targetMeters) || targetMeters <= 0) return 100
  const power = 10 ** Math.floor(Math.log10(targetMeters))
  const factor = targetMeters / power
  return (factor >= 5 ? 5 : factor >= 2 ? 2 : 1) * power
}

export function createOverviewMap({ onJump, onPlanAdd } = {}) {
  const el = document.createElement('div')
  el.className = 'ui-overview hidden'

  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 150
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', '二维路线地图')
  canvas.setAttribute('aria-describedby', 'ui-map-instructions')

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

  const scale = document.createElement('div')
  scale.className = 'ui-map-scale'
  const scaleLine = document.createElement('i')
  const scaleLabel = document.createElement('span')
  scale.append(scaleLine, scaleLabel)

  const credit = document.createElement('div')
  credit.className = 'ui-overview-credit'
  credit.textContent = '© OpenStreetMap'
  el.append(canvas, mapContext, controls, emptyHint, footprintLegend, scale, credit)
  const ctx = canvas.getContext('2d')

  let view = null
  let lastRoute = null
  let lastPts = null
  let viewportLonLat = null
  let plannerMode = false
  let logicalWidth = 200
  let logicalHeight = 150
  let pixelRatio = 1
  let lastFitKey = ''
  let gesture = null
  const tileCache = new Map()
  let redrawTimer = null

  async function loadTile(z, x, y) {
    const worldTiles = 2 ** z
    if (y < 0 || y >= worldTiles) return null
    const wrappedX = ((x % worldTiles) + worldTiles) % worldTiles
    const key = `${z}/${wrappedX}/${y}`
    if (tileCache.has(key)) return tileCache.get(key)
    tileCache.set(key, 'pending')
    try {
      const response = await fetch(TILE_URL(z, wrappedX, y))
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bitmap = await createImageBitmap(await response.blob())
      tileCache.set(key, bitmap)
      scheduleRedraw()
      return bitmap
    } catch {
      tileCache.set(key, 'error')
      return null
    }
  }

  function loadVisibleTiles() {
    if (!view) return
    for (let tx = view.x0; tx <= view.x1; tx++) {
      for (let ty = view.y0; ty <= view.y1; ty++) loadTile(view.z, tx, ty)
    }
  }

  function routePath() {
    return lastPts?.length >= 2 ? lastPts : lastRoute?.waypoints
  }

  function drawPath(path) {
    if (!path?.length) return
    ctx.beginPath()
    path.forEach((point, index) => {
      const pixel = projectToView(point.lon, point.lat, view)
      if (index) ctx.lineTo(pixel.x, pixel.y)
      else ctx.moveTo(pixel.x, pixel.y)
    })
  }

  function draw() {
    if (!view) return
    const W = logicalWidth
    const H = logicalHeight
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#f4f0e6'
    ctx.fillRect(0, 0, W, H)

    const worldTiles = 2 ** view.z
    for (let tx = view.x0; tx <= view.x1; tx++) {
      for (let ty = view.y0; ty <= view.y1; ty++) {
        if (ty < 0 || ty >= worldTiles) continue
        const wrappedX = ((tx % worldTiles) + worldTiles) % worldTiles
        const bitmap = tileCache.get(`${view.z}/${wrappedX}/${ty}`)
        if (!bitmap || bitmap === 'pending' || bitmap === 'error') continue
        ctx.drawImage(bitmap, tx * TILE_SIZE - view.originX, ty * TILE_SIZE - view.originY, TILE_SIZE, TILE_SIZE)
      }
    }

    if (viewportLonLat) {
      const a = projectToView(viewportLonLat.minLon, viewportLonLat.maxLat, view)
      const b = projectToView(viewportLonLat.maxLon, viewportLonLat.minLat, view)
      const left = Math.min(a.x, b.x)
      const top = Math.min(a.y, b.y)
      const width = Math.abs(b.x - a.x)
      const height = Math.abs(b.y - a.y)
      if (left < W && top < H && left + width > 0 && top + height > 0) {
        ctx.save()
        const clippedLeft = Math.max(0, Math.min(W, left))
        const clippedTop = Math.max(0, Math.min(H, top))
        const clippedRight = Math.max(0, Math.min(W, left + width))
        const clippedBottom = Math.max(0, Math.min(H, top + height))
        ctx.fillStyle = 'rgba(251,250,247,.5)'
        ctx.fillRect(0, 0, W, clippedTop)
        ctx.fillRect(0, clippedBottom, W, H - clippedBottom)
        ctx.fillRect(0, clippedTop, clippedLeft, clippedBottom - clippedTop)
        ctx.fillRect(clippedRight, clippedTop, W - clippedRight, clippedBottom - clippedTop)
        ctx.fillStyle = 'rgba(23,25,27,.035)'
        ctx.fillRect(left, top, width, height)
        ctx.strokeStyle = 'rgba(23,25,27,.46)'
        ctx.lineWidth = 1.25
        ctx.setLineDash([6, 5])
        ctx.strokeRect(left + .5, top + .5, Math.max(0, width - 1), Math.max(0, height - 1))
        ctx.restore()
      }
    }

    const path = routePath()
    if (path?.length >= 2) {
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      drawPath(path)
      ctx.strokeStyle = 'rgba(255,255,255,.94)'
      ctx.lineWidth = 7
      ctx.stroke()
      drawPath(path)
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 3.5
      ctx.stroke()
    }

    const waypoints = lastRoute?.waypoints ?? []
    waypoints.forEach((waypoint, index) => {
      const pixel = projectToView(waypoint.lon, waypoint.lat, view)
      const label = index === 0 ? 'A' : index === waypoints.length - 1 ? 'B' : String(index + 1)
      ctx.beginPath()
      ctx.arc(pixel.x, pixel.y, 10, 0, Math.PI * 2)
      ctx.fillStyle = index === 0 ? '#24845c' : index === waypoints.length - 1 ? '#c9362b' : '#17191b'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = '700 9px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, pixel.x, pixel.y + .5)
    })
  }

  function updateScale() {
    if (!view) return
    const mpp = metersPerPixel(view)
    const meters = niceScale(mpp * 88)
    const width = Math.max(28, Math.min(110, meters / mpp))
    scaleLine.style.width = `${width}px`
    scaleLabel.textContent = formatScale(meters)
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
    zoomIn.disabled = !view || view.z >= 14
    zoomOut.disabled = !view || view.z <= 3
    updateScale()
  }

  function setView(next) {
    if (!next) return
    view = next
    loadVisibleTiles()
    draw()
    updateChrome()
  }

  function fitCurrent() {
    const waypoints = lastRoute?.waypoints ?? []
    const points = waypoints.length >= 2 ? waypoints : footprintPoints(viewportLonLat)
    if (!points.length) return
    const mobilePlanner = plannerMode && globalThis.matchMedia?.('(max-width: 720px)').matches
    const fitHeight = mobilePlanner ? Math.min(logicalHeight, Math.max(240, window.innerHeight * .4)) : logicalHeight
    const fitPadding = plannerMode ? (mobilePlanner ? 80 : 72) : 28
    let fitted = viewFromPoints(points, logicalWidth, fitHeight, { padding: fitPadding })
    if (plannerMode && fitted && fitted.z < 14) {
      const candidate = zoomView(fitted, fitted.z + 1)
      const projected = points.map((point) => projectToView(point.lon, point.lat, candidate))
      const spanX = Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x))
      const spanY = Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y))
      const routeFits = spanX <= logicalWidth - fitPadding * 2 && spanY <= fitHeight - fitPadding * 2
      const terrainFits = spanX <= logicalWidth * 1.05 && spanY <= fitHeight * 1.05
      if (waypoints.length >= 2 ? routeFits : terrainFits) fitted = candidate
    }
    if (mobilePlanner && fitted && fitHeight !== logicalHeight) fitted = resizeViewFromTop(fitted, logicalWidth, logicalHeight)
    setView(fitted)
  }

  function zoomBy(delta, anchorX = logicalWidth / 2, anchorY = logicalHeight / 2) {
    if (!view) return
    setView(zoomView(view, view.z + delta, anchorX, anchorY))
  }

  function scheduleRedraw() {
    if (redrawTimer) return
    redrawTimer = setTimeout(() => { redrawTimer = null; draw() }, 80)
  }

  function resize() {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    logicalWidth = Math.max(200, Math.round(rect.width))
    logicalHeight = Math.max(150, Math.round(rect.height - credit.offsetHeight))
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(logicalWidth * pixelRatio)
    canvas.height = Math.round(logicalHeight * pixelRatio)
    canvas.style.width = `${logicalWidth}px`
    canvas.style.height = `${logicalHeight}px`
    if (plannerMode) fitCurrent()
    else if (view) setView(resizeView(view, logicalWidth, logicalHeight))
    else fitCurrent()
  }

  function eventPoint(event) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * logicalWidth / Math.max(1, rect.width),
      y: (event.clientY - rect.top) * logicalHeight / Math.max(1, rect.height),
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!view || event.button !== 0) return
    const point = eventPoint(event)
    canvas.focus()
    canvas.setPointerCapture?.(event.pointerId)
    gesture = { pointerId: event.pointerId, startX: point.x, startY: point.y, view, dragged: false }
  })

  canvas.addEventListener('pointermove', (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const point = eventPoint(event)
    const dx = point.x - gesture.startX
    const dy = point.y - gesture.startY
    if (!gesture.dragged && Math.hypot(dx, dy) < 5) return
    gesture.dragged = true
    canvas.classList.add('dragging')
    setView(panView(gesture.view, dx, dy))
  })

  const finishPointer = (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const point = eventPoint(event)
    const dragged = gesture.dragged
    gesture = null
    canvas.classList.remove('dragging')
    if (dragged || !view) return
    const { lon, lat } = unprojectFromView(point.x, point.y, view)
    if (plannerMode && onPlanAdd) onPlanAdd(lon, lat)
    else onJump?.(lon, lat)
  }
  canvas.addEventListener('pointerup', finishPointer)
  canvas.addEventListener('pointercancel', () => { gesture = null; canvas.classList.remove('dragging') })
  canvas.addEventListener('wheel', (event) => {
    if (!view) return
    event.preventDefault()
    const point = eventPoint(event)
    zoomBy(event.deltaY < 0 ? 1 : -1, point.x, point.y)
  }, { passive: false })
  canvas.addEventListener('keydown', (event) => {
    if (!view) return
    if (event.key === '+' || event.key === '=') zoomBy(1)
    else if (event.key === '-') zoomBy(-1)
    else if (event.key === '0' || event.key === 'Home') fitCurrent()
    else if (event.key === 'ArrowLeft') setView(panView(view, 48, 0))
    else if (event.key === 'ArrowRight') setView(panView(view, -48, 0))
    else if (event.key === 'ArrowUp') setView(panView(view, 0, 48))
    else if (event.key === 'ArrowDown') setView(panView(view, 0, -48))
    else return
    event.preventDefault()
  })

  zoomIn.onclick = () => zoomBy(1)
  zoomOut.onclick = () => zoomBy(-1)
  fit.onclick = fitCurrent

  return {
    el,
    get view() { return view ? { ...view } : null },
    setPlannerMode(on) {
      plannerMode = !!on
      el.classList.toggle('planner', plannerMode)
      if (plannerMode) el.classList.remove('hidden')
      updateChrome()
      requestAnimationFrame(resize)
    },
    resize,
    fit: fitCurrent,
    focusPlanner() { canvas.focus() },
    update(route, points, viewport) {
      lastRoute = route
      lastPts = points
      viewportLonLat = viewport
      const waypoints = route?.waypoints ?? []
      if (waypoints.length < 2 && !plannerMode) {
        el.classList.add('hidden')
        view = null
        return
      }
      el.classList.remove('hidden')
      const footprintKey = viewport ? `${viewport.minLon.toFixed(4)},${viewport.minLat.toFixed(4)},${viewport.maxLon.toFixed(4)},${viewport.maxLat.toFixed(4)}` : ''
      const nextFitKey = waypoints.length >= 2 ? `route:${routeKey(route)}` : `terrain:${footprintKey}`
      if (!view || nextFitKey !== lastFitKey) {
        lastFitKey = nextFitKey
        fitCurrent()
      } else {
        draw()
        updateChrome()
      }
    },
    updateViewport(viewport) {
      viewportLonLat = viewport
      if ((lastRoute?.waypoints?.length ?? 0) < 2) {
        lastFitKey = ''
        fitCurrent()
      } else if (view) {
        draw()
      }
    },
  }
}
