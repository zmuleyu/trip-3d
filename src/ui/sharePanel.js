// Share tab panel + poster card renderer (DOM canvas composite).
import qrcode from 'qrcode-generator'
import { buildPosterData, layoutPoster, fitCrop } from '../lib/poster.js'

const ACCENT = '#ff4d00'
const INK = '#17191b'

export function createSharePanel(actions) {
  const el = document.createElement('div')
  el.className = 'share-panel'

  const summary = document.createElement('div')
  summary.className = 'share-summary ui-stat-card'
  el.appendChild(summary)

  const mkRow = (label, fn, primary = false, disabled = false) => {
    const b = document.createElement('button')
    b.textContent = label
    if (primary) b.className = 'primary'
    if (disabled) b.disabled = true
    b.onclick = fn
    el.appendChild(b)
    return b
  }

  const row1 = document.createElement('div')
  row1.className = 'ui-btn-row'
  el.appendChild(row1)
  const mk = (label, fn) => {
    const b = document.createElement('button')
    b.textContent = label
    b.onclick = fn
    row1.appendChild(b)
  }
  mk('复制链接', actions.onCopyLink)
  mk('二维码', actions.onQr)
  mk('导出GPX', actions.onExportGpx)
  mk('高德链接', actions.onExportAmap)

  mkRow('下载海报卡 PNG', actions.onDownloadPoster, true)
  mkRow('录制飞越视频 WebM', actions.onFlyover, true)

  return {
    el,
    update(text) {
      summary.innerHTML = ''
      const d = document.createElement('div')
      d.className = 'share-summary-text'
      d.textContent = text
      summary.appendChild(d)
    },
  }
}

// QR → small canvas, M→L fallback like the amap exporter
function qrCanvas(url, cellPx = 3) {
  let qr = null
  for (const level of ['M', 'L']) {
    try { const q0 = qrcode(0, level); q0.addData(url); q0.make(); qr = q0; break } catch { /* overflow */ }
  }
  if (!qr) return null
  const n = qr.getModuleCount()
  const cv = document.createElement('canvas')
  cv.width = cv.height = n * cellPx
  const c2 = cv.getContext('2d')
  c2.fillStyle = '#fff'
  c2.fillRect(0, 0, cv.width, cv.height)
  c2.fillStyle = INK
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) c2.fillRect(c * cellPx, r * cellPx, cellPx, cellPx)
  return cv
}

// Composite the poster card. screenshot: HTMLImageElement; data: buildPosterData output.
export function renderPoster({ screenshot, data, shareUrl, width = 1080, height = 1350 }) {
  const cv = document.createElement('canvas')
  cv.width = width
  cv.height = height
  const ctx = cv.getContext('2d')

  // 1) terrain screenshot, cover-cropped
  const crop = fitCrop(screenshot.width, screenshot.height, width, height)
  ctx.drawImage(screenshot, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height)

  const L = layoutPoster(width, height)

  // 2) readability gradients: top header + bottom info zone
  let g = ctx.createLinearGradient(0, 0, 0, L.header.y + L.header.h + 40)
  g.addColorStop(0, 'rgba(244,240,230,0.92)')
  g.addColorStop(1, 'rgba(244,240,230,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, L.header.y + L.header.h + 40)
  g = ctx.createLinearGradient(0, L.stats.y - 60, 0, height)
  g.addColorStop(0, 'rgba(244,240,230,0)')
  g.addColorStop(0.35, 'rgba(244,240,230,0.94)')
  g.addColorStop(1, 'rgba(244,240,230,0.96)')
  ctx.fillStyle = g
  ctx.fillRect(0, L.stats.y - 60, width, height - L.stats.y + 60)

  // 3) header: title + subline
  ctx.fillStyle = INK
  ctx.font = `bold ${Math.round(width * 0.058)}px system-ui, sans-serif`
  ctx.textBaseline = 'top'
  ctx.fillText(data.title, L.header.x, L.header.y)
  ctx.font = `${Math.round(width * 0.024)}px system-ui, sans-serif`
  ctx.fillStyle = 'rgba(23,25,27,0.65)'
  ctx.fillText(`${data.waypointText} · ${data.profileLabel}`, L.header.x, L.header.y + Math.round(width * 0.075))

  // accent rule
  ctx.fillStyle = ACCENT
  ctx.fillRect(L.header.x, L.header.y + Math.round(width * 0.105), Math.round(width * 0.16), 5)

  // 4) stats: big duration + secondary line
  ctx.fillStyle = ACCENT
  ctx.font = `bold ${Math.round(width * 0.085)}px system-ui, sans-serif`
  ctx.fillText(data.durationText, L.stats.x, L.stats.y)
  ctx.fillStyle = INK
  ctx.font = `${Math.round(width * 0.026)}px system-ui, sans-serif`
  const line2 = [data.distanceText, data.eleText, data.maxEleText].filter(Boolean).join(' · ')
  ctx.fillText(line2, L.stats.x, L.stats.y + Math.round(width * 0.095))
  if (data.weatherIndexText != null) {
    ctx.fillStyle = 'rgba(23,25,27,0.65)'
    ctx.fillText(`天气指数 ${data.weatherIndexText}`, L.stats.x, L.stats.y + Math.round(width * 0.128))
  }

  // 5) mini weather band
  if (data.weatherDays?.length) {
    const colW = L.band.w / data.weatherDays.length
    data.weatherDays.forEach((isRain, i) => {
      ctx.fillStyle = isRain ? 'rgba(74,144,217,0.8)' : 'rgba(240,234,214,0.9)'
      ctx.fillRect(L.band.x + i * colW, L.band.y, colW - 1, L.band.h)
    })
    ctx.strokeStyle = 'rgba(23,25,27,0.3)'
    ctx.strokeRect(L.band.x, L.band.y, L.band.w, L.band.h)
  }

  // 6) QR + caption
  const qc = qrCanvas(shareUrl, 4)
  if (qc) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(L.qr.x - 8, L.qr.y - 8, L.qr.size + 16, L.qr.size + 16)
    ctx.strokeStyle = 'rgba(23,25,27,0.3)'
    ctx.strokeRect(L.qr.x - 8, L.qr.y - 8, L.qr.size + 16, L.qr.size + 16)
    ctx.drawImage(qc, L.qr.x, L.qr.y, L.qr.size, L.qr.size)
    ctx.fillStyle = 'rgba(23,25,27,0.6)'
    ctx.font = `${Math.round(width * 0.018)}px system-ui, sans-serif`
    ctx.fillText('扫码打开行程', L.qr.x, L.qr.y + L.qr.size + 12)
  }

  // 7) credit
  ctx.fillStyle = 'rgba(23,25,27,0.5)'
  ctx.font = `${Math.round(width * 0.017)}px system-ui, sans-serif`
  ctx.fillText('trip-3d.pages.dev · 地形 Mapzen · 路网 OSRM/FOSSGIS · 天气 Open-Meteo · © OSM', L.credit.x, L.credit.y)

  return cv
}

export { buildPosterData }
