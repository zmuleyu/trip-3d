// OSRM routing provider — FOSSGIS public servers (real per-profile graphs).
// Light use only: FOSSGIS allows at most one request/second, may change or end
// service without notice, and gives no availability guarantee. Production-scale
// use requires separately authorized gateway/self-hosting (README + roadmap).
const HOST = 'https://routing.openstreetmap.de'
// service name → OSRM v1 path profile segment (FOSSGIS convention)
const PATH_PROFILE = { foot: 'foot', car: 'driving', bike: 'bike' }
export const OSRM_SOURCE = Object.freeze({ kind: 'osrm-fossgis', label: 'OSM/FOSSGIS 公共路由', publicDemo: true, noSla: true })

export class OsrmRequestError extends Error {
  constructor(code, cause) {
    super(`osrm: ${code}`, cause ? { cause } : undefined)
    this.name = 'OsrmRequestError'
    this.code = code
  }
}

async function boundedJson(fetchImpl, url, { signal, timeoutMs = 10000 } = {}) {
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
    if (timedOut) throw new OsrmRequestError('timeout', error)
    if (controller.signal.aborted) throw new OsrmRequestError('cancelled', error)
    throw new OsrmRequestError('unavailable', error)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

function normalizeRoute(route) {
  const geometry = route?.geometry?.coordinates
  if (!Array.isArray(geometry) || geometry.length < 2 || geometry.some((point) => !Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) return null
  if (!Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return null
  const legs = route.legs ?? []
  if (!Array.isArray(legs) || legs.some((leg) => !Number.isFinite(leg?.distance) || !Number.isFinite(leg?.duration))) return null
  return {
    geometry,
    distanceM: route.distance,
    durationS: route.duration,
    legs: legs.map((leg) => ({ distanceM: leg.distance, durationS: leg.duration })),
  }
}

export function normalizeOsrmRoutes(routes) {
  return (Array.isArray(routes) ? routes : []).map(normalizeRoute).filter(Boolean).slice(0, 2)
}

export function createOsrmProvider({ fetchImpl = fetch, profile = 'foot', exclude = null } = {}) {
  const service = `routed-${profile}`
  const pathProfile = PATH_PROFILE[profile] ?? 'foot'
  return {
    kind: 'osrm',
    profile,
    exclude,
    source: OSRM_SOURCE,
    async route(points, options = {}) {
      if (!points || points.length < 2) throw new Error('osrm: need >= 2 points')
      const coords = points.map((p) => `${p.lon},${p.lat}`).join(';')
      // alternatives=true stays within the one existing route request. We retain
      // at most two valid responses so the public provider's response size and
      // the planner's choice remain deliberately bounded.
      const url = `${HOST}/${service}/route/v1/${pathProfile}/${coords}?overview=full&geometries=geojson&steps=false&alternatives=true`
      const requestUrl = exclude ? `${url}&exclude=${exclude}` : url
      const call = async () => {
        const { response: res, body } = await boundedJson(fetchImpl, requestUrl, options)
        if (!res.ok) throw new OsrmRequestError(`http-${res.status}`)
        if (body.code !== 'Ok') throw new OsrmRequestError(body.code ?? 'unknown')
        const alternatives = normalizeOsrmRoutes(body.routes)
        if (!alternatives.length) throw new OsrmRequestError('empty-route')
        return { ...alternatives[0], alternatives, source: OSRM_SOURCE, availability: 'available' }
      }
      // Never retry or silently remove requested semantics: one route intent is
      // one public-service request. Unsupported exclude fails truthfully.
      return call()
    },
  }
}
