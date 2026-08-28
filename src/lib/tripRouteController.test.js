import { describe, expect, it } from 'vitest'
import { routeToGpx } from './gpx.js'
import { createRoute } from './route.js'
import { decodeShare, encodeShare } from './share.js'
import { serializeRoute } from './store.js'
import { TripRouteController } from './tripRouteController.js'

describe('TripRouteController', () => {
  it('owns one route and preserves rename history and revision semantics', () => {
    const controller = new TripRouteController()
    const initialRoute = controller.route

    controller.setName('川西环线')
    expect(controller.route).toBe(initialRoute)
    expect(controller.name).toBe('川西环线')
    expect(controller.revision).toBe(0)
    expect(controller.recordHistory()).toBe(false)
    expect(controller.canUndo()).toBe(false)
  })

  it('owns waypoint mutation, selection, revisions, reverse, close, and clear', () => {
    const controller = new TripRouteController()
    const first = controller.addWaypoint(102.1, 31.1, 3200, '起点')
    const second = controller.addWaypoint(102.2, 31.2, 3400, '终点')
    controller.setSelectedWaypoint(second.id)

    expect(controller.revision).toBe(2)
    expect(controller.geometryRevision).toBe(2)
    expect(controller.reverse()).toBe(true)
    expect(controller.waypoints.map((waypoint) => waypoint.id)).toEqual([second.id, first.id])
    expect(controller.selectedWaypointId).toBe(second.id)
    expect(controller.close()).toBe(true)
    expect(controller.waypoints.at(-1).id).not.toBe(second.id)

    controller.clear()
    expect(controller.waypoints).toEqual([])
    expect(controller.dayEnds).toEqual([])
    expect(controller.selectedWaypointId).toBeNull()
    expect(controller.revision).toBe(5)
    expect(controller.geometryRevision).toBe(5)
  })

  it('replaces a searched endpoint through the controller without creating another route', () => {
    const controller = new TripRouteController()
    const start = controller.addWaypoint(102.1, 31.1, 3200, '原起点')
    const finish = controller.addWaypoint(102.2, 31.2, 3400, '原终点')
    const route = controller.route

    expect(controller.replaceWaypoint(finish.id, 103.1, 32.1, 3500, '新终点')).toMatchObject({ id: finish.id, name: '新终点' })
    expect(controller.route).toBe(route)
    expect(controller.waypoints).toEqual([
      expect.objectContaining({ id: start.id, name: '原起点' }),
      expect.objectContaining({ id: finish.id, lon: 103.1, lat: 32.1, ele: 3500, name: '新终点' }),
    ])
  })

  it('owns day boundaries and derived route stats', () => {
    const controller = new TripRouteController()
    controller.addWaypoint(100, 30, 0, 'A')
    controller.addWaypoint(101, 31, 0, 'B')
    controller.addWaypoint(102, 32, 0, 'C')

    expect(controller.toggleDayBoundary(1)).toBe(true)
    expect(controller.dayNumberAt(1)).toBe(1)
    expect(controller.dayNumberAt(2)).toBe(2)
    expect(controller.dayCount).toBe(2)
    expect(controller.deriveStats([
      { ele: 100, cumDistM: 0 },
      { ele: 140, cumDistM: 1200 },
      { ele: 110, cumDistM: 2400 },
    ])).toEqual({ distanceM: 2400, ascentM: 40, descentM: 30, maxEle: 140, minEle: 100, driveMinutes: 5 })
  })

  it('keeps waypoint preview outside revision and history until commit', () => {
    const controller = new TripRouteController()
    const waypoint = controller.addWaypoint(100, 30, 1200, 'A')
    controller.resetHistory()

    expect(controller.beginWaypointMove(waypoint.id)).toBe(true)
    expect(controller.previewWaypointMove(waypoint.id, { lon: 101, lat: 31, ele: 1400 })).toBe(true)
    expect(controller.waypointPreviewing).toBe(true)
    expect(controller.revision).toBe(1)
    expect(controller.cancelWaypointMove(waypoint.id)).toBe(true)
    expect(controller.waypoints[0]).toMatchObject({ lon: 100, lat: 30, ele: 1200 })

    controller.beginWaypointMove(waypoint.id)
    controller.previewWaypointMove(waypoint.id, { lon: 101, lat: 31, ele: 1400 })
    expect(controller.commitWaypointMove(waypoint.id)).toBe(true)
    expect(controller.revision).toBe(2)
    expect(controller.geometryRevision).toBe(2)
    expect(controller.recordHistory()).toBe(true)
    expect(controller.undo()).toBe(true)
    expect(controller.waypoints[0]).toMatchObject({ lon: 100, lat: 30, ele: 1200 })
  })

  it('accepts only current complete waypoint elevation authority and writes it back without geometry or history mutation', () => {
    const controller = new TripRouteController()
    const first = controller.addWaypoint(100, 30, 0, 'A')
    const second = controller.addWaypoint(101, 31, 900, 'B')
    controller.resetHistory()
    const geometryRevision = controller.geometryRevision
    const revision = controller.revision
    const ready = {
      routeId: controller.id,
      geometryRevision,
      status: 'ready',
      values: { [first.id]: 1180, [second.id]: 1360 },
    }

    expect(controller.waypointElevationsReady({ ...ready, status: 'loading' })).toBe(false)
    expect(controller.waypointElevationsReady({ ...ready, geometryRevision: geometryRevision - 1 })).toBe(false)
    expect(controller.waypointElevationsReady({ ...ready, values: { [first.id]: 1180 } })).toBe(false)
    expect(controller.waypointElevationsReady(ready)).toBe(true)
    expect(controller.applyWaypointElevations(ready)).toBe(true)
    expect(controller.waypoints.map(({ ele }) => ele)).toEqual([1180, 1360])
    expect(controller.geometryRevision).toBe(geometryRevision)
    expect(controller.revision).toBe(revision + 1)
    expect(controller.canUndo()).toBe(false)
    expect(serializeRoute(controller).waypoints.map(({ ele }) => ele)).toEqual([1180, 1360])
    expect(decodeShare(encodeShare(controller, { dem: { lat: 30.5, lon: 100.5, zoom: 12, size: 768 } })).waypoints.map(({ ele }) => ele)).toEqual([1180, 1360])
    expect(routeToGpx(controller)).toContain('<ele>1180</ele>')
    expect(routeToGpx(controller)).toContain('<ele>1360</ele>')
  })

  it('rejects stale elevation writeback without changing canonical waypoint values', () => {
    const controller = new TripRouteController()
    const waypoint = controller.addWaypoint(100, 30, 777, 'A')
    const revision = controller.revision

    expect(controller.applyWaypointElevations({
      routeId: controller.id,
      geometryRevision: controller.geometryRevision - 1,
      status: 'ready',
      values: { [waypoint.id]: 1500 },
    })).toBe(false)
    expect(controller.waypoints[0].ele).toBe(777)
    expect(controller.revision).toBe(revision)
  })

  it('replaces the owned route without changing its storage/share shape', () => {
    const replacement = createRoute('导入线路', 'car')
    replacement.downsampled = true
    const controller = new TripRouteController()
    controller.addWaypoint(100, 30, 1, '旧点')
    controller.setSelectedWaypoint(controller.waypoints[0].id)

    expect(controller.replaceRoute(replacement)).toBe(replacement)
    expect(controller.route).toBe(replacement)
    expect(controller.selectedWaypointId).toBeNull()
    expect(controller.snapshot()).toEqual(replacement)
    expect(controller.canUndo()).toBe(false)
  })

  it('remains wire-compatible with storage, share links, and GPX consumers', () => {
    const controller = new TripRouteController()
    const first = controller.addWaypoint(102.1, 31.1, 3200, '起点')
    controller.addWaypoint(102.2, 31.2, 3400, '终点')
    controller.setName('川西测试线')
    controller.setDayBoundaries([first.id])
    const context = { dem: { lat: 31.15, lon: 102.15, zoom: 12, size: 768 } }

    const controllerRecord = serializeRoute(controller)
    const routeRecord = serializeRoute(controller.route)
    expect({ ...controllerRecord, updatedAt: 0 }).toEqual({ ...routeRecord, updatedAt: 0 })
    expect(encodeShare(controller, context)).toBe(encodeShare(controller.route, context))
    expect(routeToGpx(controller)).toBe(routeToGpx(controller.route))
  })

  it('records mode mutations and delegates undo and redo to the owned history', () => {
    const controller = new TripRouteController()
    controller.setMode('car', { bumpRevision: true })
    expect(controller.recordHistory()).toBe(true)
    expect(controller.mode).toBe('car')

    expect(controller.undo()).toBe(true)
    expect(controller.mode).toBe('straight')
    expect(controller.redo()).toBe(true)
    expect(controller.mode).toBe('car')
  })
})
