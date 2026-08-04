// OSRM routing provider — FOSSGIS routed-foot (REAL pedestrian graph; the official
// router.project-osrm.org demo serves the driving graph even under /foot/ — verified
// 2026-08-04: demo returned 21.5km/3094s≈25km/h vs FOSSGIS 17.3km/13847s≈4.5km/h).
// Light use only; no SLA. Self-host path noted in followups.
const BASE = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'

export function createOsrmProvider({ fetchImpl = fetch } = {}) {
  return {
    kind: 'osrm',
    // points: [{ lon, lat }] (≥2) → { geometry: [[lon,lat]...], distanceM, durationS }
    async route(points) {
      if (!Array.isArray(points) || points.length < 2) throw new Error('route needs >= 2 points')
      const coords = points.map((p) => `${p.lon},${p.lat}`).join(';')
      const url = `${BASE}/${coords}?overview=full&geometries=geojson&steps=false`
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
      }
    },
  }
}
