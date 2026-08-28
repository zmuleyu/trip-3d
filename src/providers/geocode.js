// Geocode providers: nominatim (primary, OSM) / photon (backup, Komoot) / amap (placeholder).
// Public endpoints are light-use only. Each request is bounded by AbortSignal +
// timeout and carries transient source metadata; none of it enters Trip storage.
// fetchImpl injected for tests; production uses global fetch (browser sends Referer).
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const PHOTON = 'https://photon.komoot.io/api/'

export const GEOCODE_SOURCES = Object.freeze({
  nominatim: Object.freeze({ kind: 'nominatim', label: 'OSM Nominatim', publicDemo: true, noSla: true }),
  photon: Object.freeze({ kind: 'photon', label: 'Photon 备用', publicDemo: true, noSla: true }),
})

export class GeocodeRequestError extends Error {
  constructor(code, provider, cause) {
    super(`geocode ${provider}: ${code}`, cause ? { cause } : undefined)
    this.name = 'GeocodeRequestError'
    this.code = code
    this.provider = provider
  }
}

async function boundedJson(fetchImpl, url, { signal, timeoutMs = 8000, provider }) {
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort(signal?.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    const body = response.ok ? await response.json() : null
    return { response, body }
  } catch (error) {
    if (timedOut) throw new GeocodeRequestError('timeout', provider, error)
    if (controller.signal.aborted) throw new GeocodeRequestError('cancelled', provider, error)
    throw new GeocodeRequestError('unavailable', provider, error)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

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
    source: GEOCODE_SOURCES.nominatim,
    async search(query, limit = 6, options = {}) {
      if (!query?.trim()) return []
      const url = new URL(NOMINATIM)
      url.searchParams.set('q', query.trim())
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('accept-language', 'zh,en')
      url.searchParams.set('addressdetails', '1')
      const { response: res, body: rows } = await boundedJson(fetchImpl, url.toString(), { ...options, provider: 'nominatim' })
      if (!res.ok) throw new GeocodeRequestError(`http-${res.status}`, 'nominatim')
      return (Array.isArray(rows) ? rows : []).map((r) => normalizeGeocodePlace({
        name: r.name ?? r.display_name?.split(',')[0] ?? '',
        displayName: r.display_name ?? '',
        lon: parseFloat(r.lon),
        lat: parseFloat(r.lat),
        type: r.type ?? '',
        importance: Number(r.importance ?? 0),
        address: r.address ?? {},
        source: GEOCODE_SOURCES.nominatim,
      })).filter((r) => Number.isFinite(r.lon) && Number.isFinite(r.lat))
    },
  }
}

function createPhoton({ fetchImpl = fetch }) {
  return {
    kind: 'photon',
    source: GEOCODE_SOURCES.photon,
    async search(query, limit = 6, options = {}) {
      if (!query?.trim()) return []
      const url = new URL(PHOTON)
      url.searchParams.set('q', query.trim())
      url.searchParams.set('limit', String(limit))
      const { response: res, body } = await boundedJson(fetchImpl, url.toString(), { ...options, provider: 'photon' })
      if (!res.ok) throw new GeocodeRequestError(`http-${res.status}`, 'photon')
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
            source: GEOCODE_SOURCES.photon,
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

function normalizeQuery(query) {
  return query?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN') ?? ''
}

// Search-specific lifecycle: explicit submissions are latest-only, gated at
// 1.1 s, and may perform at most primary 1 + fallback 1. A primary no-result is
// authoritative and does not fan out to Photon; only primary unavailability does.
export function createGeocodeSearchLifecycle({
  primary = createNominatim({}),
  fallback = createPhoton({}),
  minIntervalMs = 1100,
  cacheLimit = 24,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let sequence = 0
  let lastStartedAt = -Infinity
  let active = null
  let pending = null
  const cache = new Map()

  const remember = (key, value) => {
    if (!value.results.length) return
    cache.delete(key)
    cache.set(key, value)
    while (cache.size > cacheLimit) cache.delete(cache.keys().next().value)
  }

  const cancelCurrent = () => {
    active?.controller.abort()
    active = null
    if (pending) {
      clearTimer(pending.timer)
      pending.resolve({ state: 'cancelled', query: pending.query, results: [] })
      pending = null
    }
  }

  const execute = async ({ id, query, key, resolve }) => {
    if (id !== sequence) return resolve({ state: 'stale', query, results: [] })
    pending = null
    lastStartedAt = now()
    const controller = new AbortController()
    active = { id, controller }
    try {
      const results = await primary.search(query, 6, { signal: controller.signal })
      if (id !== sequence) return resolve({ state: 'stale', query, results: [] })
      const value = {
        state: results.length ? 'results' : 'empty', query, results,
        source: primary.source, fallbackUsed: false, primaryUnavailable: false, cached: false,
      }
      remember(key, value)
      resolve(value)
    } catch (primaryError) {
      if (id !== sequence || primaryError?.code === 'cancelled') return resolve({ state: 'cancelled', query, results: [] })
      try {
        const results = await fallback.search(query, 6, { signal: controller.signal })
        if (id !== sequence) return resolve({ state: 'stale', query, results: [] })
        const value = {
          state: results.length ? 'results' : 'empty', query, results,
          source: fallback.source, fallbackUsed: true, primaryUnavailable: true, cached: false,
        }
        remember(key, value)
        resolve(value)
      } catch (fallbackError) {
        if (id !== sequence || fallbackError?.code === 'cancelled') return resolve({ state: 'cancelled', query, results: [] })
        resolve({ state: 'unavailable', query, results: [], primaryError, fallbackError })
      }
    } finally {
      if (active?.id === id) active = null
    }
  }

  return {
    search(query) {
      query = query?.trim() ?? ''
      if (!query) return Promise.resolve({ state: 'empty-query', query, results: [] })
      cancelCurrent()
      const id = ++sequence
      const key = normalizeQuery(query)
      const cached = cache.get(key)
      if (cached) {
        cache.delete(key)
        cache.set(key, cached)
        return Promise.resolve({ ...cached, query, cached: true })
      }
      return new Promise((resolve) => {
        const wait = Math.max(0, minIntervalMs - (now() - lastStartedAt))
        const job = { id, query, key, resolve, timer: null }
        job.timer = setTimer(() => execute(job), wait)
        pending = job
      })
    },
    cancel() { sequence++; cancelCurrent() },
    stats() { return { cached: cache.size, active: !!active, pending: !!pending } },
  }
}
