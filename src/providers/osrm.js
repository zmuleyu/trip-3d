// OSRM routing provider — FOSSGIS public servers (real per-profile graphs).
// Verified 2026-08-04/05 from browser: routed-foot 17.3km/13847s (~4.5km/h walking)
// vs routed-car 21.5km/3094s (mountain-road driving) on the same pair; CORS ok.
// The official router.project-osrm.org demo serves the driving graph even under
// /foot/ — do not use it for hiking. Light use only (FOSSGIS policy); self-host
// for production load (see followups).
const HOST = 'https://routing.openstreetmap.de'
// service name → OSRM v1 path profile segment (FOSSGIS convention)
const PATH_PROFILE = { foot: 'foot', car: 'driving', bike: 'bike' }

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
    async route(points) {
      if (!points || points.length < 2) throw new Error('osrm: need >= 2 points')
      const coords = points.map((p) => `${p.lon},${p.lat}`).join(';')
      // alternatives=true stays within the one existing route request. We retain
      // at most two valid responses so the public provider's response size and
      // the planner's choice remain deliberately bounded.
      const url = `${HOST}/${service}/route/v1/${pathProfile}/${coords}?overview=full&geometries=geojson&steps=false&alternatives=true`
      const call = async (withExclude) => {
        const res = await fetchImpl(withExclude ? `${url}&exclude=${exclude}` : url)
        if (!res.ok) throw new Error(`osrm HTTP ${res.status}`)
        const body = await res.json()
        if (body.code !== 'Ok') throw new Error(`osrm: ${body.code ?? 'unknown'}`)
        const alternatives = normalizeOsrmRoutes(body.routes)
        if (!alternatives.length) throw new Error('osrm: empty route geometry')
        return { ...alternatives[0], alternatives }
      }
      // FOSSGIS public profiles lack exclude-class support → degrade gracefully:
      // retry once without exclude and flag the result so the UI can tell the user.
      if (exclude) {
        try {
          return await call(true)
        } catch (err) {
          if (!/InvalidValue/.test(err.message)) throw err
          const out = await call(false)
          out.excludeIgnored = true
          return out
        }
      }
      return call(false)
    },
  }
}
