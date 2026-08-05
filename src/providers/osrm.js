// OSRM routing provider — FOSSGIS public servers (real per-profile graphs).
// Verified 2026-08-04/05 from browser: routed-foot 17.3km/13847s (~4.5km/h walking)
// vs routed-car 21.5km/3094s (mountain-road driving) on the same pair; CORS ok.
// The official router.project-osrm.org demo serves the driving graph even under
// /foot/ — do not use it for hiking. Light use only (FOSSGIS policy); self-host
// for production load (see followups).
const HOST = 'https://routing.openstreetmap.de'
// service name → OSRM v1 path profile segment (FOSSGIS convention)
const PATH_PROFILE = { foot: 'foot', car: 'driving', bike: 'bike' }

export function createOsrmProvider({ fetchImpl = fetch, profile = 'foot' } = {}) {
  const service = `routed-${profile}`
  const pathProfile = PATH_PROFILE[profile] ?? 'foot'
  return {
    kind: 'osrm',
    profile,
    async route(points) {
      if (!points || points.length < 2) throw new Error('osrm: need >= 2 points')
      const coords = points.map((p) => `${p.lon},${p.lat}`).join(';')
      const url = `${HOST}/${service}/route/v1/${pathProfile}/${coords}?overview=full&geometries=geojson&steps=false`
      const res = await fetchImpl(url)
      if (!res.ok) throw new Error(`osrm HTTP ${res.status}`)
      const body = await res.json()
      if (body.code !== 'Ok') throw new Error(`osrm: ${body.code ?? 'unknown'}`)
      const r = body.routes?.[0]
      if (!r?.geometry?.coordinates?.length) throw new Error('osrm: empty route geometry')
      return {
        geometry: r.geometry.coordinates,
        distanceM: r.distance,
        durationS: r.duration,
        legs: (r.legs ?? []).map((l) => ({ distanceM: l.distance, durationS: l.duration })),
      }
    },
  }
}
