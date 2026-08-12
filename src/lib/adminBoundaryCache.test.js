import { describe, it, expect, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createAdminBoundaryCache } from './adminBoundaryCache.js'

const dbName = () => `trip3d-admin-test-${crypto.randomUUID()}`

describe('admin boundary IndexedDB cache', () => {
  it('second fetch hits cache and avoids network', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ v: 1 }) }))
    const cache = createAdminBoundaryCache({ indexedDB: new IDBFactory(), dbName: dbName(), fetchImpl })
    await expect(cache.fetchJson('https://datav/a.json')).resolves.toEqual({ v: 1 })
    await expect(cache.fetchJson('https://datav/a.json')).resolves.toEqual({ v: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('expired entry refetches', async () => {
    let now = 1_000
    let version = 0
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ v: ++version }) }))
    const cache = createAdminBoundaryCache({ indexedDB: new IDBFactory(), dbName: dbName(), fetchImpl, ttlMs: 100, now: () => now })
    expect(await cache.fetchJson('u')).toEqual({ v: 1 })
    now = 1_101
    expect(await cache.fetchJson('u')).toEqual({ v: 2 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('LRU pruning retains only maxEntries most recently used URLs', async () => {
    let now = 0
    const cache = createAdminBoundaryCache({ indexedDB: new IDBFactory(), dbName: dbName(), fetchImpl: async (url) => ({ ok: true, json: async () => ({ url }) }), maxEntries: 2, now: () => ++now })
    await cache.fetchJson('a')
    await cache.fetchJson('b')
    await cache.fetchJson('a') // touch a; b becomes LRU
    await cache.fetchJson('c')
    expect(await cache.keys()).toEqual(['a', 'c'])
  })

  it('IndexedDB unavailable falls back to network without blocking', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ live: true }) }))
    const cache = createAdminBoundaryCache({ indexedDB: null, fetchImpl })
    await expect(cache.fetchJson('u')).resolves.toEqual({ live: true })
    await expect(cache.fetchJson('u')).resolves.toEqual({ live: true })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rejects non-ok network responses and never caches them', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }))
    const cache = createAdminBoundaryCache({ indexedDB: new IDBFactory(), dbName: dbName(), fetchImpl })
    await expect(cache.fetchJson('u')).rejects.toThrow('503')
    await expect(cache.fetchJson('u')).rejects.toThrow('503')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
