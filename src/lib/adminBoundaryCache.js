// Persistent cache for DataV administrative-boundary GeoJSON.
// Native IndexedDB only; all storage failures degrade to direct network fetches.

const DAY = 24 * 60 * 60 * 1000

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

async function fetchNetwork(fetchImpl, url) {
  const response = await fetchImpl(url)
  if (!response?.ok) throw new Error(`Admin boundary request failed: ${response?.status ?? 'network'}`)
  return response.json()
}

export function createAdminBoundaryCache({
  indexedDB = globalThis.indexedDB,
  dbName = 'trip3d-admin-boundaries-v1',
  fetchImpl = globalThis.fetch,
  ttlMs = 30 * DAY,
  maxEntries = 48,
  now = () => Date.now(),
} = {}) {
  let dbPromise = null
  let storageDisabled = !indexedDB
  const inflight = new Map()

  function openDb() {
    if (storageDisabled) return Promise.resolve(null)
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1)
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains('geojson')) req.result.createObjectStore('geojson', { keyPath: 'url' })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
      }).catch(() => {
        storageDisabled = true
        return null
      })
    }
    return dbPromise
  }

  async function read(db, url) {
    const tx = db.transaction('geojson', 'readonly')
    return requestResult(tx.objectStore('geojson').get(url))
  }

  async function write(db, entry) {
    const tx = db.transaction('geojson', 'readwrite')
    tx.objectStore('geojson').put(entry)
    await transactionDone(tx)
  }

  async function touch(db, entry, usedAt) {
    await write(db, { ...entry, usedAt })
  }

  async function prune(db) {
    const readTx = db.transaction('geojson', 'readonly')
    const entries = await requestResult(readTx.objectStore('geojson').getAll())
    if (entries.length <= maxEntries) return
    entries.sort((a, b) => (a.usedAt ?? a.storedAt) - (b.usedAt ?? b.storedAt))
    const tx = db.transaction('geojson', 'readwrite')
    const store = tx.objectStore('geojson')
    for (const entry of entries.slice(0, entries.length - maxEntries)) store.delete(entry.url)
    await transactionDone(tx)
  }

  async function fetchJson(url) {
    if (inflight.has(url)) return inflight.get(url)
    const task = (async () => {
      let db = await openDb()
      if (db) {
        try {
          const entry = await read(db, url)
          const usedAt = now()
          if (entry && usedAt - entry.storedAt <= ttlMs) {
            try { await touch(db, entry, usedAt) } catch { /* cache hit remains usable */ }
            return entry.data
          }
        } catch {
          storageDisabled = true
          try { db.close() } catch { /* no-op */ }
          db = null
        }
      }

      // Exactly one network request. A subsequent IDB write failure must not
      // issue a duplicate request — the freshly fetched data is already valid.
      const data = await fetchNetwork(fetchImpl, url)
      if (db) {
        const usedAt = now()
        try {
          await write(db, { url, data, storedAt: usedAt, usedAt })
          await prune(db)
        } catch {
          storageDisabled = true
          try { db.close() } catch { /* no-op */ }
        }
      }
      return data
    })()
    inflight.set(url, task)
    try { return await task } finally { inflight.delete(url) }
  }

  async function keys() {
    const db = await openDb()
    if (!db) return []
    const tx = db.transaction('geojson', 'readonly')
    const result = await requestResult(tx.objectStore('geojson').getAllKeys())
    return result.sort()
  }

  return { fetchJson, keys }
}
