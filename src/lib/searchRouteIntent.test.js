import { describe, expect, it } from 'vitest'
import { TripRouteController } from './tripRouteController.js'
import { assignSearchRouteRole } from './searchRouteIntent.js'

const place = (name, lon) => ({ name, lon, lat: 30 })

describe('search route intent seam', () => {
  it('keeps an end selected first when a later start is assigned', () => {
    const controller = new TripRouteController()
    const roleIds = { startId: null, endId: null }
    const route = controller.route

    assignSearchRouteRole({ controller, roleIds, role: 'end', place: place('终点', 102), elevation: 200 })
    assignSearchRouteRole({ controller, roleIds, role: 'start', place: place('起点', 101), elevation: 100 })

    expect(controller.route).toBe(route)
    expect(controller.waypoints.map((waypoint) => waypoint.name)).toEqual(['起点', '终点'])
    expect(roleIds).toEqual(expect.objectContaining({ startId: controller.waypoints[0].id, endId: controller.waypoints[1].id }))
  })

  it('requires both endpoints before a via point and inserts it before the end', () => {
    const controller = new TripRouteController()
    const roleIds = { startId: null, endId: null }
    expect(assignSearchRouteRole({ controller, roleIds, role: 'via', place: place('途经点', 101.5), elevation: 150 }).reason).toBe('missing-endpoints')

    assignSearchRouteRole({ controller, roleIds, role: 'start', place: place('起点', 101), elevation: 100 })
    assignSearchRouteRole({ controller, roleIds, role: 'end', place: place('终点', 102), elevation: 200 })
    assignSearchRouteRole({ controller, roleIds, role: 'via', place: place('途经点', 101.5), elevation: 150 })
    expect(controller.waypoints.map((waypoint) => waypoint.name)).toEqual(['起点', '途经点', '终点'])
  })
})
