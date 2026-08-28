import { describe, expect, it, vi } from 'vitest'
import {
  ROUTE_DEM_CACHE_RAW_BYTES,
  ROUTE_DEM_DECODED_TILE_BYTES,
  ROUTE_DEM_MAX_CONCURRENCY,
  ROUTE_DEM_MAX_NEW_TILES,
  createRouteDemAnalysisController,
  createRouteDemCoverage,
  createRouteDemRunIdentity,
  decodeTerrariumRgba,
  enumerateRouteDemTiles,
} from './routeDemCoverage.js'
import { TERRARIUM_SOURCE_ID } from '../dem.js'

const tileCenter = (x, y, zoom) => {
  const n = 2 ** zoom
  return {
    lon: ((x + 0.5) / n) * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180 / Math.PI,
  }
}

const response = () => ({ ok: true, blob: async () => new Blob(['tile']) })
const constantTile = (value = 100) => ({
  data: new Float32Array(256 * 256).fill(value),
  size: 256,
  decodedBytes: ROUTE_DEM_DECODED_TILE_BYTES,
  decodeMs: 2,
  maxChunkMs: 1,
})

describe('route corridor Terrarium coverage', () => {
  it('freezes zoom and the existing Terrarium source identity into each run key', () => {
    const route = { routeId: 'route-a', geometryRevision: 1, geometryKey: 'raw' }
    const z12 = createRouteDemRunIdentity({ ...route, zoom: 12, sourceIdentity: TERRARIUM_SOURCE_ID })
    const z13 = createRouteDemRunIdentity({ ...route, zoom: 13, sourceIdentity: TERRARIUM_SOURCE_ID })
    const unavailableSource = createRouteDemRunIdentity({ ...route, zoom: 12, sourceIdentity: 'unavailable:noise' })

    expect(z12).toContain('route:route-a:geometry:1:raw')
    expect(z12).toContain(TERRARIUM_SOURCE_ID)
    expect(z12).not.toBe(z13)
    expect(z12).not.toBe(unavailableSource)
    expect(() => createRouteDemRunIdentity({ ...route, geometryRevision: Number.NaN, zoom: 12, sourceIdentity: TERRARIUM_SOURCE_ID })).toThrow(/状态无效/)
  })
  it('enumerates only sampled corridor tiles and includes the bilinear neighbor at a boundary', () => {
    const zoom = 1
    const lon = (255.5 / (2 ** zoom * 256)) * 360 - 180
    const tiles = enumerateRouteDemTiles([{ lon, lat: 40 }], zoom)

    expect(new Set(tiles.map(({ x }) => x))).toEqual(new Set([0, 1]))
    expect(tiles.length).toBe(2)
  })

  it('decodes raw Terrarium meters with bounded async chunks', async () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4)
    for (let index = 0; index < 16; index++) rgba.set([129, 7, 128, 255], index * 4)
    const yieldControl = vi.fn(async () => {})
    let time = 0
    const decoded = await decodeTerrariumRgba(rgba, {
      size: 4,
      yieldEvery: 4,
      yieldControl,
      clock: () => time++,
    })

    expect([...decoded.data]).toEqual(new Array(16).fill(263.5))
    expect(decoded.minM).toBe(263.5)
    expect(decoded.maxM).toBe(263.5)
    expect(yieldControl).toHaveBeenCalledTimes(3)
    expect(decoded.decodedBytes).toBe(16 * Float32Array.BYTES_PER_ELEMENT)
  })

  it('fails closed before any request when a trigger exceeds the 24-tile budget', async () => {
    const zoom = 6
    const points = Array.from({ length: ROUTE_DEM_MAX_NEW_TILES + 1 }, (_, index) => tileCenter(index, 20, zoom))
    const fetchImpl = vi.fn(async () => response())
    const loader = createRouteDemCoverage({ fetchImpl, decodeTile: async () => constantTile() })

    await expect(loader.load({ points, zoom })).rejects.toMatchObject({
      code: 'budget-exceeded',
      requestedTiles: ROUTE_DEM_MAX_NEW_TILES + 1,
      maxNewTiles: ROUTE_DEM_MAX_NEW_TILES,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('caps shared request concurrency at four', async () => {
    const zoom = 6
    let active = 0
    let peak = 0
    const fetchImpl = vi.fn(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active--
      return response()
    })
    const loader = createRouteDemCoverage({ fetchImpl, decodeTile: async () => constantTile() })
    await loader.load({
      points: Array.from({ length: 10 }, (_, index) => tileCenter(index, 20, zoom)),
      zoom,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(10)
    expect(peak).toBeLessThanOrEqual(ROUTE_DEM_MAX_CONCURRENCY)
    expect(loader.stats().peakActive).toBeLessThanOrEqual(ROUTE_DEM_MAX_CONCURRENCY)
  })

  it('deduplicates a pending tile promise across Analyze callers', async () => {
    let release
    const gate = new Promise((resolve) => { release = resolve })
    const fetchImpl = vi.fn(async () => { await gate; return response() })
    const loader = createRouteDemCoverage({ fetchImpl, decodeTile: async () => constantTile(321) })
    const request = { points: [tileCenter(3, 4, 5)], zoom: 5 }
    const first = loader.load(request)
    const second = loader.load(request)
    release()

    const [a, b] = await Promise.all([first, second])
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(a.sample(request.points[0].lon, request.points[0].lat)).toBe(321)
    expect(b.sample(request.points[0].lon, request.points[0].lat)).toBe(321)
  })

  it('reuses decoded session tiles with zero new requests on a later explicit trigger', async () => {
    const fetchImpl = vi.fn(async () => response())
    const loader = createRouteDemCoverage({ fetchImpl, decodeTile: async () => constantTile(222) })
    const request = { points: [tileCenter(3, 4, 5)], zoom: 5 }

    expect((await loader.load({ ...request, sourceIdentity: TERRARIUM_SOURCE_ID })).newRequests).toBe(1)
    expect((await loader.load({ ...request, sourceIdentity: TERRARIUM_SOURCE_ID })).newRequests).toBe(0)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('fails closed for a source identity other than the existing Terrarium contract', async () => {
    const fetchImpl = vi.fn(async () => response())
    const loader = createRouteDemCoverage({ fetchImpl, decodeTile: async () => constantTile() })

    await expect(loader.load({ points: [tileCenter(3, 4, 5)], zoom: 5, sourceIdentity: 'other-source' }))
      .rejects.toMatchObject({ code: 'source-unavailable' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('uses an access-ordered bounded LRU and reports the measured raw cache bytes', async () => {
    const fetchImpl = vi.fn(async () => response())
    const loader = createRouteDemCoverage({ fetchImpl, decodeTile: async (_blob, { tile }) => constantTile(tile.x), cacheTiles: 2 })
    const loadTile = (x) => loader.load({ points: [tileCenter(x, 8, 5)], zoom: 5 })

    await loadTile(1)
    await loadTile(2)
    await loadTile(1)
    await loadTile(3)
    await loadTile(2)

    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(loader.stats().cacheSize).toBe(2)
    expect(loader.stats().cacheBytes).toBe(2 * ROUTE_DEM_DECODED_TILE_BYTES)
    expect(ROUTE_DEM_CACHE_RAW_BYTES).toBe(12 * 1024 * 1024)
  })

  it('aborts an unshared request, clears pending failure state, and allows explicit retry', async () => {
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      if (fetchImpl.mock.calls.length > 1) resolve(response())
    }))
    const loader = createRouteDemCoverage({ fetchImpl, decodeTile: async () => constantTile() })
    const controller = new AbortController()
    const request = { points: [tileCenter(4, 4, 5)], zoom: 5, signal: controller.signal }
    const pending = loader.load(request)
    controller.abort()

    await expect(pending).rejects.toMatchObject({ code: 'cancelled' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(loader.stats().pending).toBe(0)
    await expect(loader.load({ ...request, signal: undefined })).resolves.toMatchObject({ newRequests: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('fails a partial corridor closed without mutating the route and retries only the failed tile', async () => {
    const route = { id: 'kept', waypoints: [{ id: 'a' }, { id: 'b' }] }
    const before = structuredClone(route)
    let fail = true
    const fetchImpl = vi.fn(async (url) => {
      if (fail && url.includes('/3/')) return { ok: false, status: 503, blob: async () => new Blob() }
      return response()
    })
    const loader = createRouteDemCoverage({ fetchImpl, decodeTile: async (_blob, { tile }) => constantTile(tile.x) })
    const request = { points: [tileCenter(2, 4, 5), tileCenter(3, 4, 5)], zoom: 5 }

    await expect(loader.load(request)).rejects.toMatchObject({ code: 'unavailable' })
    expect(route).toEqual(before)
    fail = false
    const retried = await loader.load(request)
    expect(retried.newRequests).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('does not reuse an aborted sibling promise when retry is clicked immediately', async () => {
    let firstFailure = true
    const fetchImpl = vi.fn((url, { signal }) => {
      if (firstFailure && url.includes('/2/4.png')) {
        firstFailure = false
        return Promise.resolve({ ok: false, status: 503, blob: async () => new Blob() })
      }
      if (firstFailure || fetchImpl.mock.calls.length === 2) {
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
          setTimeout(() => reject(new DOMException('aborted', 'AbortError')), 10)
        }, { once: true }))
      }
      return Promise.resolve(response())
    })
    const loader = createRouteDemCoverage({ fetchImpl, decodeTile: async () => constantTile() })
    const request = { points: [tileCenter(2, 4, 5), tileCenter(3, 4, 5)], zoom: 5 }

    await expect(loader.load(request)).rejects.toMatchObject({ code: 'unavailable' })
    await expect(loader.load(request)).resolves.toMatchObject({ newRequests: 2 })
    expect(loader.stats().pending).toBe(0)
  })

  it('samples continuously across adjacent tile pixels', async () => {
    const zoom = 1
    const decodeTile = async (_blob, { tile }) => {
      const decoded = constantTile()
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) decoded.data[y * 256 + x] = tile.x * 256 + x
      }
      return decoded
    }
    const loader = createRouteDemCoverage({ fetchImpl: async () => response(), decodeTile })
    const lon = (255.5 / (2 ** zoom * 256)) * 360 - 180
    const coverage = await loader.load({ points: [{ lon, lat: 40 }], zoom })

    expect(coverage.sample(lon, 40)).toBeCloseTo(255.5, 5)
  })

  it('rejects stale route versions without publishing an old result', async () => {
    const deferred = new Map()
    const loadCoverage = vi.fn(({ points }) => new Promise((resolve) => deferred.set(points[0].id, resolve)))
    const onState = vi.fn()
    const controller = createRouteDemAnalysisController({ loadCoverage, onState })
    const first = controller.start({ key: 'route-a:1', routeId: 'route-a', geometryRevision: 1, points: [{ id: 'a' }], zoom: 12, analyze: () => ({ status: 'ready', id: 'old' }) })
    const second = controller.start({ key: 'route-a:2', routeId: 'route-a', geometryRevision: 2, points: [{ id: 'b' }], zoom: 12, analyze: () => ({ status: 'ready', id: 'new' }) })

    deferred.get('b')({})
    await expect(second).resolves.toMatchObject({ status: 'ready', analysis: { id: 'new' } })
    deferred.get('a')({})
    await expect(first).resolves.toMatchObject({ status: 'stale', key: 'route-a:1' })
    expect(onState.mock.calls.filter(([state]) => state.status === 'ready').map(([state]) => state.key)).toEqual(['route-a:2'])
    expect(onState.mock.calls.find(([state]) => state.status === 'ready')?.[0]).toMatchObject({ routeId: 'route-a', geometryRevision: 2 })
  })

  it('rejects candidate 0 enrichment after candidate 1 becomes the active derived path', async () => {
    const deferred = new Map()
    const loadCoverage = vi.fn(({ points }) => new Promise((resolve) => deferred.set(points[0].id, resolve)))
    const onState = vi.fn()
    const controller = createRouteDemAnalysisController({ loadCoverage, onState })
    const base = { routeId: 'route-a', geometryRevision: 4, zoom: 12, sourceIdentity: TERRARIUM_SOURCE_ID }
    const candidate0 = createRouteDemRunIdentity({ ...base, geometryKey: 'snapped:route-a:4:result:8:candidate:route-a:4:car:9:0' })
    const candidate1 = createRouteDemRunIdentity({ ...base, geometryKey: 'snapped:route-a:4:result:8:candidate:route-a:4:car:9:1' })
    expect(candidate1).not.toBe(candidate0)

    const first = controller.start({ key: candidate0, routeId: base.routeId, geometryRevision: base.geometryRevision, points: [{ id: 'candidate-0' }], zoom: base.zoom, sourceIdentity: base.sourceIdentity, analyze: () => ({ status: 'ready', id: 'candidate-0' }) })
    const second = controller.start({ key: candidate1, routeId: base.routeId, geometryRevision: base.geometryRevision, points: [{ id: 'candidate-1' }], zoom: base.zoom, sourceIdentity: base.sourceIdentity, analyze: () => ({ status: 'ready', id: 'candidate-1' }) })
    deferred.get('candidate-1')({})
    await expect(second).resolves.toMatchObject({ status: 'ready', key: candidate1, analysis: { id: 'candidate-1' } })
    deferred.get('candidate-0')({})
    await expect(first).resolves.toMatchObject({ status: 'stale', key: candidate0 })
    expect(onState.mock.calls.filter(([state]) => state.status === 'ready').map(([state]) => state.key)).toEqual([candidate1])
  })

  it('rejects old success and failure after a frozen zoom/source run changes, then retries with the new run', async () => {
    const deferred = new Map()
    const loadCoverage = vi.fn(({ zoom, sourceIdentity }) => new Promise((resolve, reject) => deferred.set(zoom, { resolve, reject, sourceIdentity })))
    const onState = vi.fn()
    const controller = createRouteDemAnalysisController({ loadCoverage, onState })
    const routeIdentity = { routeId: 'route-a', geometryRevision: 1, geometryKey: 'raw' }
    const z12 = createRouteDemRunIdentity({ ...routeIdentity, zoom: 12, sourceIdentity: TERRARIUM_SOURCE_ID })
    const z13 = createRouteDemRunIdentity({ ...routeIdentity, zoom: 13, sourceIdentity: TERRARIUM_SOURCE_ID })

    const readyAt12 = controller.start({ key: z12, points: [{ id: 'a' }], zoom: 12, sourceIdentity: TERRARIUM_SOURCE_ID, analyze: () => ({ status: 'ready', id: 'z12' }) })
    deferred.get(12).resolve({})
    await expect(readyAt12).resolves.toMatchObject({ status: 'ready', key: z12 })

    const staleFailure = controller.start({ key: z12, points: [{ id: 'old' }], zoom: 12, sourceIdentity: TERRARIUM_SOURCE_ID, analyze: () => ({ status: 'ready', id: 'old' }) })
    const retryAt13 = controller.start({ key: z13, points: [{ id: 'new' }], zoom: 13, sourceIdentity: TERRARIUM_SOURCE_ID, analyze: () => ({ status: 'ready', id: 'z13' }) })
    deferred.get(12).reject(new Error('old transport failure'))
    deferred.get(13).resolve({})

    await expect(staleFailure).resolves.toMatchObject({ status: 'stale', key: z12 })
    await expect(retryAt13).resolves.toMatchObject({ status: 'ready', key: z13, analysis: { id: 'z13' } })
    expect(loadCoverage).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 13, sourceIdentity: TERRARIUM_SOURCE_ID }))
    expect(onState.mock.calls.filter(([state]) => state.status === 'error')).toEqual([])
    expect(onState.mock.calls.filter(([state]) => state.status === 'ready').map(([state]) => state.key)).toEqual([z12, z13])
  })

  it('cancels in-flight legacy source and zoom runs before either old result can publish', async () => {
    const deferred = new Map()
    const loadCoverage = vi.fn(({ zoom, sourceIdentity, signal }) => new Promise((resolve, reject) => {
      deferred.set(`${zoom}|${sourceIdentity}`, { resolve, reject, signal })
    }))
    const onState = vi.fn()
    const controller = createRouteDemAnalysisController({ loadCoverage, onState })
    const routeIdentity = { routeId: 'legacy-terrain', geometryRevision: 1, geometryKey: 'raw' }
    const z12 = createRouteDemRunIdentity({ ...routeIdentity, zoom: 12, sourceIdentity: TERRARIUM_SOURCE_ID })
    const z13 = createRouteDemRunIdentity({ ...routeIdentity, zoom: 13, sourceIdentity: TERRARIUM_SOURCE_ID })
    const noise = createRouteDemRunIdentity({ ...routeIdentity, zoom: 13, sourceIdentity: 'unavailable:noise' })

    const original = controller.start({ key: z12, points: [], zoom: 12, sourceIdentity: TERRARIUM_SOURCE_ID, analyze: () => ({ status: 'ready', id: 'z12' }) })
    const zoomChanged = controller.start({ key: z13, points: [], zoom: 13, sourceIdentity: TERRARIUM_SOURCE_ID, analyze: () => ({ status: 'ready', id: 'z13' }) })
    const sourceChanged = controller.start({ key: noise, points: [], zoom: 13, sourceIdentity: 'unavailable:noise', analyze: () => ({ status: 'ready', id: 'noise' }) })

    expect(deferred.get(`12|${TERRARIUM_SOURCE_ID}`).signal.aborted).toBe(true)
    expect(deferred.get(`13|${TERRARIUM_SOURCE_ID}`).signal.aborted).toBe(true)
    deferred.get(`12|${TERRARIUM_SOURCE_ID}`).resolve({})
    deferred.get(`13|${TERRARIUM_SOURCE_ID}`).reject(new Error('old zoom failure'))
    deferred.get('13|unavailable:noise').resolve({})

    await expect(original).resolves.toMatchObject({ status: 'stale', key: z12 })
    await expect(zoomChanged).resolves.toMatchObject({ status: 'stale', key: z13 })
    await expect(sourceChanged).resolves.toMatchObject({ status: 'ready', key: noise })
    expect(onState.mock.calls.filter(([state]) => state.status === 'error')).toEqual([])
    expect(onState.mock.calls.filter(([state]) => state.status === 'ready').map(([state]) => state.key)).toEqual([noise])
  })
})
