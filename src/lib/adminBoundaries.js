// Administrative boundaries (CN): DataV aliyun GeoJSON helpers — pure, TDD'd.
// Source: https://geo.datav.aliyun.com/areas_v3/bound/{adcode}[_full].json (WGS84)

// province name (Nominatim address.state) → adcode; suffix-normalized
const PROVINCES = [
  ['北京', 110000], ['天津', 120000], ['河北', 130000], ['山西', 140000],
  ['内蒙古', 150000], ['辽宁', 210000], ['吉林', 220000], ['黑龙江', 230000],
  ['上海', 310000], ['江苏', 320000], ['浙江', 330000], ['安徽', 340000],
  ['福建', 350000], ['江西', 360000], ['山东', 370000], ['河南', 410000],
  ['湖北', 420000], ['湖南', 430000], ['广东', 440000], ['广西', 450000],
  ['海南', 460000], ['重庆', 500000], ['四川', 510000], ['贵州', 520000],
  ['云南', 530000], ['西藏', 540000], ['陕西', 610000], ['甘肃', 620000],
  ['青海', 630000], ['宁夏', 640000], ['新疆', 650000], ['香港', 810000],
  ['澳门', 820000], ['台湾', 710000],
]

export function provinceAdcode(address) {
  const state = address?.state ?? address?.province ?? ''
  if (!state) return null
  for (const [name, code] of PROVINCES) if (state.startsWith(name)) return code
  return null
}

// GeoJSON FeatureCollection → flat [{ name, level, adcode, centroid, ring:[[lon,lat],...] }]
export function extractRings(geojson) {
  const out = []
  for (const f of geojson?.features ?? []) {
    const g = f.geometry
    if (!g) continue
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const poly of polys) {
      if (!poly[0] || poly[0].length < 3) continue
      out.push({
        name: f.properties?.name ?? '',
        level: f.properties?.level ?? '',
        adcode: f.properties?.adcode ?? 0,
        centroid: f.properties?.centroid ?? f.properties?.center ?? null,
        ring: poly[0], // outer ring only
      })
    }
  }
  return out
}

// keep rings whose bbox intersects the given bbox
export function filterRingsToBbox(rings, bbox) {
  return rings.filter((r) => {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
    for (const [lon, lat] of r.ring) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
    return maxLon >= bbox.minLon && minLon <= bbox.maxLon && maxLat >= bbox.minLat && minLat <= bbox.maxLat
  })
}

// ray-cast point-in-polygon (ring of [lon, lat])
export function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi) inside = !inside
  }
  return inside
}

// Sutherland–Hodgman rectangle clip: keeps only the in-bbox portion of a ring
// (province outlines span 10+ degrees — drawing them whole buries the viewport
// segment under thousands of off-screen vertices). Returns null when disjoint,
// AND null when the ring fully CONTAINS the bbox (S-H would degenerate to the
// rect itself — no boundary actually crosses the view).
export function clipRingToBbox(ring, bbox) {
  const anyInside = ring.some(([lon, lat]) => lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat)
  if (!anyInside) {
    const cx = (bbox.minLon + bbox.maxLon) / 2
    const cy = (bbox.minLat + bbox.maxLat) / 2
    if (pointInRing(cx, cy, ring)) return null // bbox inside polygon → no boundary in view
  }
  let pts = ring
  const edges = [
    { inside: ([lon]) => lon >= bbox.minLon, intersect: (a, b) => crossX(a, b, bbox.minLon) },
    { inside: ([lon]) => lon <= bbox.maxLon, intersect: (a, b) => crossX(a, b, bbox.maxLon) },
    { inside: ([, lat]) => lat >= bbox.minLat, intersect: (a, b) => crossY(a, b, bbox.minLat) },
    { inside: ([, lat]) => lat <= bbox.maxLat, intersect: (a, b) => crossY(a, b, bbox.maxLat) },
  ]
  for (const e of edges) {
    const out = []
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i]
      const prev = pts[(i + pts.length - 1) % pts.length]
      const curIn = e.inside(cur)
      const prevIn = e.inside(prev)
      if (curIn) {
        if (!prevIn) out.push(e.intersect(prev, cur))
        out.push(cur)
      } else if (prevIn) {
        out.push(e.intersect(prev, cur))
      }
    }
    pts = out
    if (!pts.length) return null
  }
  return pts.length >= 2 ? pts : null
}
function crossX([x1, y1], [x2, y2], x) {
  const t = (x - x1) / (x2 - x1 || 1e-12)
  return [x, y1 + t * (y2 - y1)]
}
function crossY([x1, y1], [x2, y2], y) {
  const t = (y - y1) / (y2 - y1 || 1e-12)
  return [x1 + t * (x2 - x1), y]
}
