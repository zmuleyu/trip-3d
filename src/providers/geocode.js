// Geocode providers: nominatim (primary, OSM) / photon (backup, Komoot) / amap (placeholder).
// Interface: search(query, limit?) → [{ name, displayName, lon, lat, type, importance }]
// fetchImpl injected for tests; production uses global fetch (browser sends Referer).
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const PHOTON = 'https://photon.komoot.io/api/'

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
      const res = await fetchImpl(url.toString())
      if (!res.ok) throw new Error(`nominatim HTTP ${res.status}`)
      const rows = await res.json()
      return (Array.isArray(rows) ? rows : []).map((r) => ({
        name: r.name ?? r.display_name?.split(',')[0] ?? '',
        displayName: r.display_name ?? '',
        lon: parseFloat(r.lon),
        lat: parseFloat(r.lat),
        type: r.type ?? '',
        importance: Number(r.importance ?? 0),
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
          return {
            name: p.name ?? '',
            displayName: [p.name, p.county, p.state, p.country].filter(Boolean).join(', '),
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
            type: p.type ?? '',
            importance: 0,
          }
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
