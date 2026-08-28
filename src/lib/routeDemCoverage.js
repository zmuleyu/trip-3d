import { TERRARIUM_SOURCE_ID, TERRARIUM_TILE_SIZE, TERRARIUM_TILE_URL_TEMPLATE } from '../dem.js'

export const ROUTE_DEM_MAX_NEW_TILES = 24
export const ROUTE_DEM_MAX_CONCURRENCY = 4
export const ROUTE_DEM_CACHE_TILES = 48
export const ROUTE_DEM_DECODED_TILE_BYTES = TERRARIUM_TILE_SIZE * TERRARIUM_TILE_SIZE * Float32Array.BYTES_PER_ELEMENT
export const ROUTE_DEM_CACHE_RAW_BYTES = ROUTE_DEM_CACHE_TILES * ROUTE_DEM_DECODED_TILE_BYTES

const MAX_MERCATOR_LAT = 85.05112878
const DECODE_YIELD_PIXELS = 16_384

const tileKey = ({ z, x, y }) => `${z}/${x}/${y}`
const scopedTileKey = (sourceIdentity, tile) => `${sourceIdentity}:${tileKey(tile)}`
const tileUrl = ({ z, x, y }) => TERRARIUM_TILE_URL_TEMPLATE
  .replace('{z}', z)
  .replace('{x}', x)
  .replace('{y}', y)

const abortError = () => {
  const error = new Error('路线地形补齐已取消')
  error.name = 'AbortError'
  error.code = 'cancelled'
  return error
}

export class RouteDemError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'RouteDemError'
    this.code = code
    Object.assign(this, details)
  }
}

export function createRouteDemRunIdentity({ routeId, geometryRevision, geometryKey = 'raw', zoom, sourceIdentity = TERRARIUM_SOURCE_ID } = {}) {
  if (!routeId || !Number.isInteger(geometryRevision) || geometryRevision < 0 || !geometryKey || !Number.isFinite(zoom) || !sourceIdentity) {
    throw new RouteDemError('run-unavailable', '路线地形状态无效')
  }
  return `route:${routeId}:geometry:${geometryRevision}:${geometryKey}:z${zoom}:source:${sourceIdentity}`
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now()
}

function defaultYieldControl() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function normalizeLongitude(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

function wrapTileX(x, n) {
  return ((x % n) + n) % n
}

export function lonLatToGlobalPixel(lon, lat, zoom) {
  const n = 2 ** zoom
  const limitedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat))
  const latRad = limitedLat * Math.PI / 180
  return {
    x: ((normalizeLongitude(lon) + 180) / 360) * n * TERRARIUM_TILE_SIZE,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TERRARIUM_TILE_SIZE,
  }
}

function tileForGlobalPixel(px, py, zoom) {
  const n = 2 ** zoom
  const maxPixel = n * TERRARIUM_TILE_SIZE - 1
  const y = Math.max(0, Math.min(maxPixel, py))
  return {
    z: zoom,
    x: wrapTileX(Math.floor(px / TERRARIUM_TILE_SIZE), n),
    y: Math.floor(y / TERRARIUM_TILE_SIZE),
  }
}

export function enumerateRouteDemTiles(points, zoom) {
  const unique = new Map()
  for (const point of points ?? []) {
    if (!Number.isFinite(point?.lon) || !Number.isFinite(point?.lat)) continue
    const pixel = lonLatToGlobalPixel(point.lon, point.lat, zoom)
    const x0 = Math.floor(pixel.x)
    const y0 = Math.floor(pixel.y)
    for (const [px, py] of [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]]) {
      const tile = tileForGlobalPixel(px, py, zoom)
      unique.set(tileKey(tile), tile)
    }
  }
  return [...unique.values()].sort((a, b) => a.y - b.y || a.x - b.x)
}

export async function decodeTerrariumRgba(rgba, {
  size = TERRARIUM_TILE_SIZE,
  yieldEvery = DECODE_YIELD_PIXELS,
  yieldControl = defaultYieldControl,
  clock = nowMs,
  signal,
} = {}) {
  if (!rgba || rgba.length !== size * size * 4) throw new RouteDemError('decode-failed', '高程数据格式无效')
  const startedAt = clock()
  let chunkStartedAt = startedAt
  let maxChunkMs = 0
  let minM = Infinity
  let maxM = -Infinity
  let sum = 0
  const data = new Float32Array(size * size)
  for (let index = 0; index < data.length; index++) {
    if (signal?.aborted) throw abortError()
    const rgbaIndex = index * 4
    const meters = rgba[rgbaIndex] * 256 + rgba[rgbaIndex + 1] + rgba[rgbaIndex + 2] / 256 - 32768
    data[index] = meters
    minM = Math.min(minM, meters)
    maxM = Math.max(maxM, meters)
    sum += meters
    if ((index + 1) % yieldEvery === 0 && index + 1 < data.length) {
      maxChunkMs = Math.max(maxChunkMs, clock() - chunkStartedAt)
      await yieldControl()
      chunkStartedAt = clock()
    }
  }
  const finishedAt = clock()
  maxChunkMs = Math.max(maxChunkMs, finishedAt - chunkStartedAt)
  return {
    data,
    size,
    minM,
    maxM,
    meanM: sum / data.length,
    decodedBytes: data.byteLength,
    decodeMs: finishedAt - startedAt,
    maxChunkMs,
  }
}

export async function decodeTerrariumBlob(blob, options = {}) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new RouteDemError('decode-failed', '当前浏览器无法解码路线高程数据')
  }
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = TERRARIUM_TILE_SIZE
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new RouteDemError('decode-failed', '当前浏览器无法读取路线高程数据')
    context.drawImage(bitmap, 0, 0, TERRARIUM_TILE_SIZE, TERRARIUM_TILE_SIZE)
    const rgba = context.getImageData(0, 0, TERRARIUM_TILE_SIZE, TERRARIUM_TILE_SIZE).data
    return decodeTerrariumRgba(rgba, options)
  } finally {
    bitmap.close?.()
  }
}

function bilinearSample(tiles, lon, lat, zoom, sourceIdentity) {
  const pixel = lonLatToGlobalPixel(lon, lat, zoom)
  const n = 2 ** zoom
  const maxPixel = n * TERRARIUM_TILE_SIZE - 1
  const x0 = Math.floor(pixel.x)
  const y0 = Math.max(0, Math.min(maxPixel, Math.floor(pixel.y)))
  const x1 = x0 + 1
  const y1 = Math.min(maxPixel, y0 + 1)
  const fx = pixel.x - x0
  const fy = pixel.y - Math.floor(pixel.y)
  const valueAt = (globalX, globalY) => {
    const tile = tileForGlobalPixel(globalX, globalY, zoom)
    const decoded = tiles.get(scopedTileKey(sourceIdentity, tile))
    if (!decoded) return Number.NaN
    const wrappedPixelX = ((globalX % (n * TERRARIUM_TILE_SIZE)) + n * TERRARIUM_TILE_SIZE) % (n * TERRARIUM_TILE_SIZE)
    const localX = wrappedPixelX % TERRARIUM_TILE_SIZE
    const localY = globalY % TERRARIUM_TILE_SIZE
    return decoded.data[localY * TERRARIUM_TILE_SIZE + localX]
  }
  const a = valueAt(x0, y0)
  const b = valueAt(x1, y0)
  const c = valueAt(x0, y1)
  const d = valueAt(x1, y1)
  if (![a, b, c, d].every(Number.isFinite)) return Number.NaN
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

export function createRouteDemCoverage({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  decodeTile = decodeTerrariumBlob,
  maxNewTiles = ROUTE_DEM_MAX_NEW_TILES,
  maxConcurrency = ROUTE_DEM_MAX_CONCURRENCY,
  cacheTiles = ROUTE_DEM_CACHE_TILES,
} = {}) {
  const cache = new Map()
  const pending = new Map()
  const queue = []
  let active = 0
  let peakActive = 0
  let totalRequests = 0
  let lastLoad = null

  const cacheGet = (key) => {
    const value = cache.get(key)
    if (!value) return null
    cache.delete(key)
    cache.set(key, value)
    return value
  }

  const cacheSet = (key, value) => {
    cache.delete(key)
    cache.set(key, value)
    while (cache.size > cacheTiles) cache.delete(cache.keys().next().value)
  }

  const reusablePending = (key) => {
    const entry = pending.get(key)
    return entry && !entry.controller.signal.aborted ? entry : null
  }

  const pump = () => {
    while (active < maxConcurrency && queue.length) {
      const entry = queue.shift()
      if (entry.controller.signal.aborted) {
        if (pending.get(entry.key) === entry) pending.delete(entry.key)
        entry.reject(abortError())
        continue
      }
      active++
      peakActive = Math.max(peakActive, active)
      totalRequests++
      ;(async () => {
        try {
          if (typeof fetchImpl !== 'function') throw new RouteDemError('unavailable', '当前浏览器无法请求路线高程数据')
          const response = await fetchImpl(tileUrl(entry.tile), { signal: entry.controller.signal })
          if (!response?.ok) throw new RouteDemError('unavailable', '路线高程暂不可用', { status: response?.status ?? null })
          const decoded = await decodeTile(await response.blob(), { signal: entry.controller.signal, tile: entry.tile })
          if (entry.controller.signal.aborted) throw abortError()
          cacheSet(entry.key, decoded)
          entry.resolve(decoded)
        } catch (error) {
          entry.reject(error?.name === 'AbortError' ? abortError() : error)
        } finally {
          active--
          if (pending.get(entry.key) === entry) pending.delete(entry.key)
          pump()
        }
      })()
    }
  }

  const createPending = (tile, sourceIdentity) => {
    const key = scopedTileKey(sourceIdentity, tile)
    let resolve
    let reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    const entry = { key, tile, promise, resolve, reject, controller: new AbortController(), consumers: new Set() }
    pending.set(key, entry)
    queue.push(entry)
    return entry
  }

  const releaseConsumer = (entries, consumer) => {
    for (const entry of entries) {
      entry.consumers.delete(consumer)
      if (!entry.consumers.size && pending.get(entry.key) === entry) entry.controller.abort()
    }
  }

  return {
    async load({ points, zoom, sourceIdentity = TERRARIUM_SOURCE_ID, signal } = {}) {
      if (signal?.aborted) throw abortError()
      if (sourceIdentity !== TERRARIUM_SOURCE_ID) {
        throw new RouteDemError('source-unavailable', '路线地形来源暂不可用')
      }
      const tiles = enumerateRouteDemTiles(points, zoom)
      const missing = tiles.filter((tile) => {
        const key = scopedTileKey(sourceIdentity, tile)
        return !cache.has(key) && !reusablePending(key)
      })
      if (missing.length > maxNewTiles) {
        throw new RouteDemError('budget-exceeded', '路线跨度超出本次补齐范围', {
          requestedTiles: missing.length,
          maxNewTiles,
        })
      }

      const consumer = Symbol('route-dem-consumer')
      const entries = []
      const values = new Map()
      const waits = []
      for (const tile of tiles) {
        const key = scopedTileKey(sourceIdentity, tile)
        const cached = cacheGet(key)
        if (cached) {
          values.set(key, cached)
          continue
        }
        const entry = reusablePending(key) ?? createPending(tile, sourceIdentity)
        entry.consumers.add(consumer)
        entries.push(entry)
        waits.push(entry.promise.then((decoded) => values.set(key, decoded)))
      }
      pump()

      let onAbort
      const cancelled = new Promise((_, reject) => {
        onAbort = () => reject(abortError())
        signal?.addEventListener('abort', onAbort, { once: true })
      })
      try {
        await (signal ? Promise.race([Promise.all(waits), cancelled]) : Promise.all(waits))
      } catch (error) {
        if (error?.name === 'AbortError') throw abortError()
        throw error instanceof RouteDemError
          ? error
          : new RouteDemError('unavailable', '路线高程暂不可用', { cause: error })
      } finally {
        signal?.removeEventListener('abort', onAbort)
        releaseConsumer(entries, consumer)
      }

      const latitude = (points ?? []).reduce((sum, point) => sum + point.lat, 0) / Math.max(points?.length ?? 0, 1)
      const metersPerPixel = (156543.03392 * Math.cos(latitude * Math.PI / 180)) / 2 ** zoom
      const decoded = [...values.values()]
      lastLoad = {
        tileCount: tiles.length,
        newRequests: missing.length,
        decodedBytes: decoded.reduce((sum, tile) => sum + (tile.decodedBytes ?? tile.data?.byteLength ?? 0), 0),
        totalDecodeMs: decoded.reduce((sum, tile) => sum + (tile.decodeMs ?? 0), 0),
        maxChunkMs: Math.max(0, ...decoded.map((tile) => tile.maxChunkMs ?? 0)),
      }
      return {
        sourceIdentity,
        metersPerPixel,
        sample: (lon, lat) => bilinearSample(values, lon, lat, zoom, sourceIdentity),
        ...lastLoad,
      }
    },
    stats() {
      return {
        cacheSize: cache.size,
        cacheBytes: [...cache.values()].reduce((sum, tile) => sum + (tile.decodedBytes ?? tile.data?.byteLength ?? 0), 0),
        pending: pending.size,
        active,
        peakActive,
        totalRequests,
        lastLoad,
      }
    },
  }
}

export function createRouteDemAnalysisController({ loadCoverage, onState } = {}) {
  let version = 0
  let current = null

  const isCurrent = (run) => current === run && run.version === version && !run.controller.signal.aborted

  return {
    get currentKey() { return current?.key ?? null },
    cancel() {
      version++
      current?.controller.abort()
      current = null
    },
    async start({ key, routeId, geometryRevision, points, zoom, sourceIdentity, analyze } = {}) {
      this.cancel()
      const run = { key, routeId, geometryRevision, zoom, sourceIdentity, version, controller: new AbortController() }
      run.version = version
      current = run
      onState?.({ status: 'loading', key, routeId, geometryRevision, zoom, sourceIdentity, version: run.version })
      try {
        const coverage = await loadCoverage({ points, zoom, sourceIdentity, signal: run.controller.signal })
        if (!isCurrent(run)) return { status: 'stale', key }
        const analysis = await analyze(coverage)
        if (!isCurrent(run)) return { status: 'stale', key }
        if (analysis?.status !== 'ready') throw new RouteDemError('unavailable', '路线高程暂不可用')
        const state = { status: 'ready', key, routeId, geometryRevision, zoom, sourceIdentity, analysis, coverage }
        current = null
        onState?.(state)
        return state
      } catch (error) {
        if (!isCurrent(run) || error?.name === 'AbortError' || error?.code === 'cancelled') return { status: 'stale', key }
        const routeError = error instanceof RouteDemError
          ? error
          : new RouteDemError('unavailable', '路线高程暂不可用', { cause: error })
        const state = { status: 'error', key, routeId, geometryRevision, zoom, sourceIdentity, error: routeError }
        current = null
        onState?.(state)
        return state
      }
    },
  }
}
