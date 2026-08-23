// Poster data assembly + layout math — pure, TDD'd. Rendering lives in ui/sharePanel.js.
import { durationContract, normalizeRouteMode } from './routePlanning.js'

const fmtDur = (minutes) => {
  const m = Math.round(minutes)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}天${h % 24}h${m % 60}m`
}

const truncate = (s, max) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

// { route, stats, legs, weather, profile } → poster copy block
export function buildPosterData({ route, stats, legs, weather, profile }) {
  const mode = normalizeRouteMode(route.mode ?? profile)
  const duration = durationContract({ mode, legs: legs ?? [], stats })
  const durationText = duration.minutes == null ? '—' : fmtDur(duration.minutes)
  const profileLabel = mode === 'straight'
    ? '直线示意'
    : duration.reliable ? duration.label.replace('时长', '') : duration.label
  const hasElevation = stats && [stats.ascentM, stats.descentM, stats.maxEle].every(Number.isFinite)
  const days = (route.dayEnds?.length ?? 0) + 1
  return {
    title: truncate(route.name || '未命名线路', 20),
    durationText,
    profileLabel,
    distanceText: stats ? `${(stats.distanceM / 1000).toFixed(1)} km` : '—',
    eleText: hasElevation ? `↑${stats.ascentM}m ↓${stats.descentM}m` : '—',
    maxEleText: hasElevation ? `最高 ${stats.maxEle}m` : '',
    waypointText: `${route.waypoints.length} 点 · ${days} 天`,
    weatherIndexText: weather?.index?.overall != null ? String(weather.index.overall) : null,
    weatherDays: weather?.agg?.length ? weather.agg.map((d) => !!d.isRain) : null,
  }
}

// block rectangles within a W×H canvas (4:5 poster convention)
export function layoutPoster(W, H) {
  const pad = Math.round(W * 0.055)
  const qrSize = Math.round(W * 0.13)
  return {
    pad,
    header: { x: pad, y: pad, w: W - pad * 2, h: Math.round(H * 0.16) },
    stats: { x: pad, y: Math.round(H * 0.775), w: W - pad * 2, h: Math.round(H * 0.10) },
    band: { x: pad, y: Math.round(H * 0.885), w: W - pad * 2 - qrSize - 12, h: Math.round(H * 0.022) },
    qr: { x: W - pad - qrSize, y: H - pad - qrSize, size: qrSize, h: qrSize },
    credit: { x: pad, y: H - pad - Math.round(H * 0.03), w: W - pad * 2 - qrSize - 12, h: Math.round(H * 0.03) },
  }
}

// cover-crop: source (sw×sh) → target aspect (tw×th); returns crop rect in source pixels
export function fitCrop(sw, sh, tw, th) {
  const sAspect = sw / sh
  const tAspect = tw / th
  if (sAspect > tAspect) {
    const cw = Math.round(sh * tAspect)
    return { sx: Math.round((sw - cw) / 2), sy: 0, sw: cw, sh }
  }
  const ch = Math.round(sw / tAspect)
  return { sx: 0, sy: Math.round((sh - ch) / 2), sw, sh: ch }
}
