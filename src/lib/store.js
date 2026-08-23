// Route persistence: IndexedDB CRUD + (de)serialization.
import { normalizeRouteMode } from './routePlanning.js'

const DB_VERSION = 1
const STORE = 'routes'

export function serializeRoute(route) {
  return {
    id: route.id,
    name: route.name,
    mode: normalizeRouteMode(route.mode),
    createdAt: route.createdAt,
    updatedAt: Date.now(),
    revision: route.revision ?? 0,
    waypoints: route.waypoints.map(({ id, lon, lat, ele, name }) => ({ id, lon, lat, ele, name })),
    dayEnds: route.dayEnds ?? [],
  }
}

export function hydrateRoute(rec) {
  return {
    id: rec.id,
    name: rec.name,
    mode: normalizeRouteMode(rec.mode),
    createdAt: rec.createdAt,
    revision: rec.revision ?? 0,
    geometryRevision: rec.geometryRevision ?? 0,
    waypoints: (rec.waypoints ?? []).map((w, i) => ({
      id: w.id ?? crypto.randomUUID(), // preserve ids so dayEnds references survive
      lon: w.lon, lat: w.lat, ele: w.ele, name: w.name ?? `P${i + 1}`,
    })),
    dayEnds: rec.dayEnds ?? [],
  }
}

export function openRouteStore(dbName = 'trip3d') {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = (mode, fn) =>
        new Promise((res, rej) => {
          const t = db.transaction(STORE, mode)
          const out = fn(t.objectStore(STORE))
          t.oncomplete = () => res(out?.result ?? out)
          t.onerror = () => rej(t.error)
        })
      resolve({
        save: (route) => tx('readwrite', (s) => s.put(serializeRoute(route))),
        load: (id) =>
          new Promise((res, rej) => {
            const t = db.transaction(STORE, 'readonly')
            const q = t.objectStore(STORE).get(id)
            q.onsuccess = () => (q.result ? res(hydrateRoute(q.result)) : res(null))
            q.onerror = () => rej(q.error)
          }),
        list: () =>
          new Promise((res, rej) => {
            const t = db.transaction(STORE, 'readonly')
            const q = t.objectStore(STORE).getAll()
            q.onsuccess = () => {
              const items = q.result
                .map(({ id, name, updatedAt, waypoints }) => ({
                  id, name, updatedAt, waypointCount: waypoints?.length ?? 0,
                }))
                .sort((a, b) => b.updatedAt - a.updatedAt)
              res(items)
            }
            q.onerror = () => rej(q.error)
          }),
        remove: (id) => tx('readwrite', (s) => s.delete(id)),
        close: () => db.close(),
      })
    }
  })
}
