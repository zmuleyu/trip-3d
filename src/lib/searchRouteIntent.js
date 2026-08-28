function activeId(controller, id) {
  return id && controller.hasWaypoint(id) ? id : null
}

export function assignSearchRouteRole({ controller, roleIds, role, place, elevation }) {
  const startId = activeId(controller, roleIds.startId)
    ?? (controller.waypoints[0]?.id !== activeId(controller, roleIds.endId) ? controller.waypoints[0]?.id : null)
  const endId = activeId(controller, roleIds.endId)
    ?? (controller.waypoints.length >= 2 ? controller.waypoints.at(-1)?.id : null)
  const name = place.name || '地点'
  let waypoint = null

  if (role === 'start') {
    waypoint = startId
      ? controller.replaceWaypoint(startId, place.lon, place.lat, elevation, name)
      : controller.insertWaypoint(0, place.lon, place.lat, elevation, name)
    if (waypoint) roleIds.startId = waypoint.id
  } else if (role === 'end') {
    waypoint = endId
      ? controller.replaceWaypoint(endId, place.lon, place.lat, elevation, name)
      : controller.addWaypoint(place.lon, place.lat, elevation, name)
    if (waypoint) roleIds.endId = waypoint.id
  } else if (role === 'via') {
    if (!startId || !endId) return { waypoint: null, reason: 'missing-endpoints' }
    const endIndex = controller.waypoints.findIndex((candidate) => candidate.id === endId)
    waypoint = controller.insertWaypoint(endIndex, place.lon, place.lat, elevation, name)
  }

  return { waypoint, reason: waypoint ? null : 'waypoint-limit' }
}
