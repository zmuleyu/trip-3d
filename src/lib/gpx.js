// GPX 1.1 import/export. Export is string-built; import uses DOMParser (browser/jsdom).
import { createRoute, addWaypoint, MAX_WAYPOINTS } from './route.js'

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function routeToGpx(route) {
  const pts = route.waypoints
    .map(
      (w) =>
        `    <rtept lat="${w.lat}" lon="${w.lon}"><ele>${w.ele}</ele><name>${esc(w.name)}</name></rtept>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="trip-3d" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>${esc(route.name)}</name>
${pts}
  </rte>
</gpx>
`
}

export function gpxToRoute(xmlText) {
  let doc
  try {
    doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  } catch {
    throw new Error('invalid GPX: not XML')
  }
  if (doc.querySelector('parsererror')) throw new Error('invalid GPX: parse error')

  // namespace-tolerant EVERYWHERE: one helper for both element picking and child reads
  const byTag = (el, tag) => {
    const els = [...el.getElementsByTagName(tag)]
    return els.length ? els : [...el.getElementsByTagNameNS('*', tag)]
  }
  const named = (el) => {
    const n = byTag(el, 'name')[0]
    return n ? n.textContent.trim() : undefined
  }
  // parseFloat results are validated — NaN/out-of-range coords are rejected instead
  // of silently poisoning geo conversion, spline sampling and three.js geometry
  const toWp = (el, i) => {
    const lon = parseFloat(el.getAttribute('lon'))
    const lat = parseFloat(el.getAttribute('lat'))
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
      throw new Error(`invalid coordinate at point ${i + 1}: lat=${el.getAttribute('lat')} lon=${el.getAttribute('lon')}`)
    const eleRaw = byTag(el, 'ele')[0]?.textContent
    const ele = eleRaw == null || eleRaw.trim() === '' ? 0 : parseFloat(eleRaw)
    return { lon, lat, ele: Number.isFinite(ele) ? ele : 0, name: named(el) ?? `P${i + 1}` }
  }

  let els = byTag(doc, 'rtept')
  if (!els.length) els = byTag(doc, 'wpt')
  let isTrack = false
  if (!els.length) {
    els = byTag(doc, 'trkpt')
    isTrack = els.length > 0
  }
  if (!els.length) throw new Error('no waypoints in GPX')

  const routeName =
    named(byTag(doc, 'rte')[0] ?? byTag(doc, 'trk')[0] ?? doc.documentElement) ??
    doc.documentElement.getAttribute('creator') ??
    '导入线路'
  const route = createRoute(routeName)
  // tracks denser than the waypoint cap are downsampled, never silently truncated:
  // result is flagged so UI can surface "已抽稀 N→M". Interpolating over (length-1)
  // keeps the LAST trackpoint — floor(i * len/MAX) would drop the endpoint.
  const over = els.length > MAX_WAYPOINTS
  const keep = over
    ? Array.from({ length: MAX_WAYPOINTS }, (_, i) => els[Math.round((i * (els.length - 1)) / (MAX_WAYPOINTS - 1))])
    : els
  keep.forEach((el, i) => {
    const w = toWp(el, i)
    addWaypoint(route, w.lon, w.lat, w.ele, w.name)
  })
  if (over) {
    route.downsampled = true
    route.originalPointCount = els.length
    route.sourceKind = isTrack ? 'trk' : 'rte'
  }
  return route
}
