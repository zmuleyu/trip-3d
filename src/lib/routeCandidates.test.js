import { describe, expect, it } from 'vitest'
import { createRouteCandidateId, isCurrentRouteCandidate, routeCandidatePathKey, weatherResultMatchesPath } from './routeCandidates.js'
import { TripRouteController } from './tripRouteController.js'
import { routeToGpx } from './gpx.js'
import { normalizeOsrmLegs } from './legs.js'
import { encodeShare } from './share.js'
import { serializeRoute } from './store.js'

describe('transient route candidate identity', () => {
  it('changes the derived-path and weather binding from candidate 0 to 1 without a Trip revision', () => {
    const context = { routeId: 'trip-1', geometryRevision: 4, mode: 'car', requestId: 9 }
    const first = { ...context, index: 0, id: createRouteCandidateId({ ...context, index: 0 }), geometry: [[1, 1], [2, 2]] }
    const second = { ...context, index: 1, id: createRouteCandidateId({ ...context, index: 1 }), geometry: [[1, 1], [3, 3], [2, 2]] }
    const firstPath = routeCandidatePathKey({ version: 'trip-1:4', resultId: 3, candidate: first })
    const secondPath = routeCandidatePathKey({ version: 'trip-1:4', resultId: 3, candidate: second })

    expect(isCurrentRouteCandidate(second, context)).toBe(true)
    expect(secondPath).not.toBe(firstPath)
    expect(second.geometry).not.toEqual(first.geometry)
    expect(weatherResultMatchesPath({ revision: 12, pathKey: firstPath, result: {} }, { revision: 12, pathKey: secondPath })).toBe(false)
  })

  it('keeps the Trip history and export wire unchanged while candidate 1 supplies the active legs', () => {
    const trip = new TripRouteController()
    trip.addWaypoint(113, 41, 120, '起点')
    trip.addWaypoint(114, 41, 140, '终点')
    trip.resetHistory()
    const before = trip.snapshot()
    const gpx = routeToGpx(trip.route)
    const share = encodeShare(trip.route, { dem: { lat: 41, lon: 113.5, zoom: 12, size: 768 } })
    const stored = serializeRoute(trip.route)
    const selected = { legs: [{ distanceM: 24000, durationS: 1800 }] }

    expect(normalizeOsrmLegs(selected.legs, trip.waypoints)).toEqual([expect.objectContaining({ distanceM: 24000, durationS: 1800, real: true })])
    expect(trip.snapshot()).toEqual(before)
    expect(trip.geometryRevision).toBe(before.geometryRevision)
    expect(trip.canUndo()).toBe(false)
    expect(routeToGpx(trip.route)).toBe(gpx)
    expect(encodeShare(trip.route, { dem: { lat: 41, lon: 113.5, zoom: 12, size: 768 } })).toBe(share)
    expect(serializeRoute(trip.route)).toEqual(stored)
  })
})
