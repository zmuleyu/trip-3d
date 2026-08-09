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
