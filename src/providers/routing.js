// RoutingProvider — OSRM registered (this goal); amap placeholder; more later.
//
// Interface: route(points: [{ lon, lat }]) => Promise<{ geometry: [[lon,lat]...], distanceM, durationS }>
import { createOsrmProvider } from './osrm.js'

class StubRoutingProvider {
  constructor(kind) { this.kind = kind }
  async route() {
    throw new Error(`NotImplemented: routing provider '${this.kind}'`)
  }
}

// Amap placeholder — 双轨决策:本期仅占位(key + GCJ-02 + 条款评估见 followups)
class AmapRoutingStub {
  constructor() { this.kind = 'amap' }
  async route() {
    throw new Error('amap provider 占位:待 key 管理 + GCJ-02 转换 + 条款评估(docs/followups.md)')
  }
}

const KINDS = {
  none: () => new StubRoutingProvider('none'),
  osrm: (opts) => createOsrmProvider(opts),
  amap: () => new AmapRoutingStub(),
}

export function createRoutingProvider(kind, opts) {
  const make = KINDS[kind]
  if (!make) throw new Error(`unknown routing provider: ${kind}`)
  return make(opts)
}
