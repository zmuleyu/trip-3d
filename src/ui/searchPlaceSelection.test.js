import { describe, expect, it, vi } from 'vitest'
import { createSearchSession } from './searchSession.js'
import { selectSearchPlace } from './searchPlaceSelection.js'

describe('search place selection', () => {
  it('publishes the selected place and focuses the map without mutating the trip route', () => {
    const session = createSearchSession()
    const place = { name: '人民公园', context: '成都市 · 青羊区', category: '公园', lon: 104.063, lat: 30.67 }
    session.begin('人民公园')
    session.resolve([place])
    const route = { waypoints: [{ id: 'a', lon: 1, lat: 2 }] }
    const before = JSON.stringify(route)
    const publish = vi.fn()
    const focus = vi.fn()

    const snapshot = selectSearchPlace({ session, place, publish, focus })

    expect(snapshot.state).toBe('place-selection')
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ selected: place }))
    expect(focus).toHaveBeenCalledWith(place.lon, place.lat)
    expect(JSON.stringify(route)).toBe(before)
  })
})
