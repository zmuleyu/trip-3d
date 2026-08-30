import { describe, expect, it } from 'vitest'
import { dismissRouteSelection, reconcileRouteSelection, segmentRouteSelection, waypointRouteSelection } from './routeSelection.js'

const route = { waypoints: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }

describe('transient route selection', () => {
  it('keeps only waypoint and adjacent segment identities that still exist', () => {
    expect(reconcileRouteSelection(waypointRouteSelection('b'), route)).toEqual({ kind: 'waypoint', waypointId: 'b' })
    expect(reconcileRouteSelection(segmentRouteSelection(route, 1), route)).toEqual({ kind: 'segment', fromId: 'b', toId: 'c' })
    expect(reconcileRouteSelection({ kind: 'waypoint', waypointId: 'missing' }, route)).toBeNull()
    expect(reconcileRouteSelection({ kind: 'segment', fromId: 'a', toId: 'c' }, route)).toBeNull()
  })

  it('clears automatically when the route no longer has a selectable segment', () => {
    expect(reconcileRouteSelection(waypointRouteSelection('a'), { waypoints: [{ id: 'a' }] })).toBeNull()
  })

  it('clears transient and waypoint selection together without creating route history', () => {
    expect(dismissRouteSelection({ kind: 'waypoint', waypointId: 'b' }, 'b')).toEqual({
      selection: null,
      selectedWaypointId: null,
      changed: true,
    })
    expect(dismissRouteSelection(null, null).changed).toBe(false)
  })
})
