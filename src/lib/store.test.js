// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openRouteStore, serializeRoute, hydrateRoute } from './store.js'
import { createRoute, addWaypoint } from './route.js'

describe('route store', () => {
  let store
  let dbName
  beforeEach(async () => {
    // unique DB per test — no deleteDatabase blocked-by-open-connection hangs
    dbName = `trip3d-test-${crypto.randomUUID()}`
    store = await openRouteStore(dbName)
  })
  afterEach(async () => {
    store.close()
    await new Promise((res, rej) => {
      const q = indexedDB.deleteDatabase(dbName)
      q.onsuccess = () => res()
      q.onerror = () => rej(q.error)
    })
  })

  it('serialize/hydrate round-trip strips runtime fields only', () => {
    const r = createRoute('四姑娘山 D3', 'foot')
    addWaypoint(r, 102.83, 31.05, 3850)
    addWaypoint(r, 102.9, 31.02, 4100, '垭口')
    const h = hydrateRoute(serializeRoute(r))
    expect(h.name).toBe('四姑娘山 D3')
    expect(h.waypoints).toHaveLength(2)
    expect(h.waypoints[1].name).toBe('垭口')
    expect(h.waypoints[1].ele).toBe(4100)
    expect(h.mode).toBe('foot')
    expect(hydrateRoute({ id: 'legacy', name: '旧线路', waypoints: [] }).mode).toBe('straight')
  })

  it('save / list / load / delete', async () => {
    const r = createRoute('A')
    addWaypoint(r, 102.8, 31.0, 3800)
    await store.save(r)
    const r2 = createRoute('B')
    await store.save(r2)
    const list = await store.list()
    expect(list.map((x) => x.name).sort()).toEqual(['A', 'B'])
    const loaded = await store.load(r.id)
    expect(loaded.name).toBe('A')
    expect(loaded.waypoints).toHaveLength(1)
    await store.remove(r.id)
    expect((await store.list()).map((x) => x.name)).toEqual(['B'])
  })

  it('list returns summary without full waypoint payloads sorted by updatedAt desc', async () => {
    const a = createRoute('old')
    await store.save(a)
    await new Promise((r) => setTimeout(r, 5))
    const b = createRoute('new')
    await store.save(b)
    const list = await store.list()
    expect(list[0].name).toBe('new')
    expect(list[0].waypointCount).toBe(0)
    expect(list[0].waypoints).toBeUndefined()
  })
})
