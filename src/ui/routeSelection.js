export function waypointRouteSelection(waypointId) {
  return waypointId ? { kind: 'waypoint', waypointId } : null
}

export function segmentRouteSelection(route, segmentIndex) {
  const from = route?.waypoints?.[segmentIndex]
  const to = route?.waypoints?.[segmentIndex + 1]
  return from && to ? { kind: 'segment', fromId: from.id, toId: to.id } : null
}

export function sameRouteSelection(a, b) {
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'waypoint') return a.waypointId === b.waypointId
  return a.fromId === b.fromId && a.toId === b.toId
}

export function reconcileRouteSelection(selection, route) {
  const waypoints = route?.waypoints ?? []
  if (!selection || waypoints.length < 2) return null
  if (selection.kind === 'waypoint') {
    return waypoints.some((waypoint) => waypoint.id === selection.waypointId) ? selection : null
  }
  if (selection.kind === 'segment') {
    const fromIndex = waypoints.findIndex((waypoint) => waypoint.id === selection.fromId)
    return fromIndex >= 0 && waypoints[fromIndex + 1]?.id === selection.toId ? selection : null
  }
  return null
}

export function dismissRouteSelection(selection, selectedWaypointId = null) {
  return {
    selection: null,
    selectedWaypointId: null,
    changed: !!selection || !!selectedWaypointId,
  }
}

export function routeSelectionIndex(selection, route) {
  const waypoints = route?.waypoints ?? []
  if (selection?.kind === 'waypoint') return waypoints.findIndex((waypoint) => waypoint.id === selection.waypointId)
  if (selection?.kind === 'segment') {
    const index = waypoints.findIndex((waypoint) => waypoint.id === selection.fromId)
    return index >= 0 && waypoints[index + 1]?.id === selection.toId ? index : -1
  }
  return -1
}
