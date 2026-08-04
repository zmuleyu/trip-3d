// OSRM routing provider — demo server (light use only), foot profile.
// https://router.project-osrm.org — no key; production use should self-host (followups).
const BASE = 'https://router.project-osrm.org/route/v1/foot'

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
