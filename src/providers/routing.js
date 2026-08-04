// RoutingProvider — P4 extension point (road-network snapping).
// MVP ships no implementation; 'none' is the only registered kind.
//
// @typedef {{ lon: number, lat: number }} LonLat
// @typedef {{ distanceM: number, durationS: number, geometry: LonLat[] }} RouteLeg
// Interface: plan(waypoints: LonLat[], opts?: { mode?: 'driving' }) => Promise<RouteLeg[]>

class StubRoutingProvider {
  constructor(kind) { this.kind = kind }
  // eslint-disable-next-line no-unused-vars
  async plan(waypoints, opts = {}) {
    throw new Error(`NotImplemented: routing provider '${this.kind}' (reserved for P4)`)
  }
}

const KINDS = { none: StubRoutingProvider }

export function createRoutingProvider(kind) {
  const Klass = KINDS[kind]
  if (!Klass) throw new Error(`unknown routing provider: ${kind}`)
  return new Klass(kind)
}
