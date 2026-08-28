// Geocode providers: nominatim (primary, OSM) / photon (backup, Komoot) / amap (placeholder).
// Interface: search(query, limit?) → [{ name, displayName, lon, lat, type, importance }]
// fetchImpl injected for tests; production uses global fetch (browser sends Referer).
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const PHOTON = 'https://photon.komoot.io/api/'

const CATEGORY_LABELS = {
  city: '城市', town: '城镇', village: '村镇', suburb: '城区', neighbourhood: '街区',
  park: '公园', peak: '山峰', river: '河流', attraction: '景点', museum: '博物馆', station: '车站',
  tower: '塔', trn: '铁路站', train_station: '火车站', stop: '站点',
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function placeContext({ address = {}, displayName = '', county = '', state = '', city = '', district = '' } = {}) {
  const province = clean(address.state || address.province || state)
  let locality = clean(address.city || address.town || address.municipality || city)
  let area = clean(address.city_district || address.county || address.district || district || county)
  if (!area && /(?:区|县|旗)$/.test(locality)) {
    area = locality
    locality = ''
  }
  if (locality || area || province) {
    return [locality || '城市信息暂缺', area || '区县信息暂缺', province || '省份信息暂缺'].join(' · ')
  }
  const fallback = displayName.split(',').slice(1, 4).map(clean).filter(Boolean)
  return [fallback[0] || '城市信息暂缺', fallback[1] || '区县信息暂缺', fallback[2] || '省份信息暂缺'].join(' · ')
}

export function normalizeGeocodePlace(result = {}) {
  const rawType = clean(result.type ?? result.category)
  const name = clean(result.name) || clean(result.displayName).split(',')[0] || '未命名地点'
  return {
    ...result,
    name,
    context: placeContext(result),
    category: (CATEGORY_LABELS[rawType] ?? rawType) || '地点',
  }
}

function createNominatim({ fetchImpl = fetch }) {
  return {
    kind: 'nominatim',
    async search(query, limit = 6) {
      if (!query?.trim()) return []
      const url = new URL(NOMINATIM)
      url.searchParams.set('q', query.trim())
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('accept-language', 'zh,en')
      url.searchParams.set('addressdetails', '1')
      const res = await fetchImpl(url.toString())
      if (!res.ok) throw new Error(`nominatim HTTP ${res.status}`)
      const rows = await res.json()
      return (Array.isArray(rows) ? rows : []).map((r) => normalizeGeocodePlace({
        name: r.name ?? r.display_name?.split(',')[0] ?? '',
        displayName: r.display_name ?? '',
        lon: parseFloat(r.lon),
        lat: parseFloat(r.lat),
        type: r.type ?? '',
        importance: Number(r.importance ?? 0),
        address: r.address ?? {},
      })).filter((r) => Number.isFinite(r.lon) && Number.isFinite(r.lat))
    },
  }
}

function createPhoton({ fetchImpl = fetch }) {
  return {
    kind: 'photon',
    async search(query, limit = 6) {
      if (!query?.trim()) return []
      const url = new URL(PHOTON)
      url.searchParams.set('q', query.trim())
      url.searchParams.set('limit', String(limit))
      const res = await fetchImpl(url.toString())
      if (!res.ok) throw new Error(`photon HTTP ${res.status}`)
      const body = await res.json()
      return (body.features ?? [])
        .filter((f) => Array.isArray(f.geometry?.coordinates))
        .map((f) => {
          const p = f.properties ?? {}
          return normalizeGeocodePlace({
            name: p.name ?? '',
            displayName: [p.name, p.county, p.state, p.country].filter(Boolean).join(', '),
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
            type: p.type ?? '',
            importance: 0,
            county: p.county,
            state: p.state,
            city: p.city,
            district: p.district,
          })
        })
        .filter((r) => Number.isFinite(r.lon) && Number.isFinite(r.lat))
    },
  }
}

// Amap placeholder — 双轨决策:本期仅占位。实体实现需 key + GCJ-02 转换 + 条款评估,见 docs/followups.md
function createAmapStub() {
  return {
    kind: 'amap',
    async search() {
      throw new Error('amap provider 占位:待 key 管理 + GCJ-02 转换 + 条款评估(docs/followups.md)')
    },
  }
}

const KINDS = {
  nominatim: (opts) => createNominatim(opts ?? {}),
  photon: (opts) => createPhoton(opts ?? {}),
  amap: () => createAmapStub(),
}

export function createGeocodeProvider(kind, { fetchImpl } = {}) {
  const make = KINDS[kind]
  if (!make) throw new Error(`unknown geocode provider: ${kind}`)
  return make(fetchImpl ? { fetchImpl } : undefined)
}
