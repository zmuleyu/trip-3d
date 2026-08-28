import {
  addWaypoint,
  closeLoop,
  createRoute,
  dayNumberAt,
  insertWaypoint,
  moveWaypoint,
  normalizeDayEnds,
  removeWaypoint,
  reverseWaypoints,
  routeStats,
  toggleDayEnd,
} from './route.js'
import { createHistory } from './history.js'
import { analyzeRouteElevation } from './routeAnalysis.js'
import { normalizeRouteMode, routeDistanceMeters } from './routePlanning.js'

// Owns the single mutable Trip route without depending on a renderer, provider,
// persistence codec, DOM surface, or file format. Read consumers may use this
// controller as the route contract; writes stay behind the methods below.
export class TripRouteController {
  #route
  #history
  #selectedWaypointId = null
  #waypointMoveDraft = null

  constructor({ route = createRoute(), historyLimit = 50 } = {}) {
    this.#route = route
    this.#history = createHistory(historyLimit)
    normalizeDayEnds(this.#route)
    this.#history.reset(this.#route)
  }

  get route() { return this.#route }
  get id() { return this.#route.id }
  get name() { return this.#route.name }
  get mode() { return this.#route.mode }
  get waypoints() { return this.#route.waypoints }
  get dayEnds() { return this.#route.dayEnds }
  get revision() { return this.#route.revision }
  get geometryRevision() { return this.#route.geometryRevision }
  get createdAt() { return this.#route.createdAt }
  get downsampled() { return this.#route.downsampled }
  get originalPointCount() { return this.#route.originalPointCount }
  get sourceKind() { return this.#route.sourceKind }
  get selectedWaypointId() { return this.#selectedWaypointId }
  get waypointPreviewing() { return this.#waypointMoveDraft?.previewing === true }

  replaceRoute(nextRoute, { resetHistory = true } = {}) {
    if (!nextRoute?.waypoints) throw new TypeError('TripRouteController requires a route')
    this.#route = nextRoute
    this.#selectedWaypointId = null
    this.#waypointMoveDraft = null
    normalizeDayEnds(this.#route)
    if (resetHistory) this.#history.reset(this.#route)
    return this.#route
  }

  reset(name = '未命名线路', mode = 'straight', options) {
    return this.replaceRoute(createRoute(name, mode), options)
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.#route))
  }

  setSelectedWaypoint(id) {
    const next = id && this.#route.waypoints.some((waypoint) => waypoint.id === id) ? id : null
    if (this.#selectedWaypointId === next) return false
    this.#selectedWaypointId = next
    return true
  }

  hasWaypoint(id) {
    return this.#route.waypoints.some((waypoint) => waypoint.id === id)
  }

  reconcileSelection() {
    if (this.#selectedWaypointId && !this.#route.waypoints.some((waypoint) => waypoint.id === this.#selectedWaypointId)) {
      this.#selectedWaypointId = null
    }
    if (this.#waypointMoveDraft && !this.#route.waypoints.some((waypoint) => waypoint.id === this.#waypointMoveDraft.id)) {
      this.#waypointMoveDraft = null
    }
    return this.#selectedWaypointId
  }

  setName(name) {
    this.#route.name = name
  }

  setMode(mode, { bumpRevision = false } = {}) {
    this.#route.mode = normalizeRouteMode(mode)
    if (bumpRevision) this.#route.revision++
    return this.#route.mode
  }

  bumpRevision({ geometry = false } = {}) {
    this.#route.revision++
    if (geometry) this.#route.geometryRevision++
  }

  waypointElevationsReady(authority) {
    return authority?.status === 'ready' &&
      authority.routeId === this.#route.id &&
      authority.geometryRevision === this.#route.geometryRevision &&
      this.#route.waypoints.every((waypoint) => Number.isFinite(authority.values?.[waypoint.id]))
  }

  applyWaypointElevations(authority) {
    if (!this.waypointElevationsReady(authority)) return false
    let changed = false
    for (const waypoint of this.#route.waypoints) {
      const elevation = authority.values[waypoint.id]
      if (waypoint.ele === elevation) continue
      waypoint.ele = elevation
      changed = true
    }
    if (changed) this.#route.revision++
    return changed
  }

  addWaypoint(lon, lat, ele, name) {
    return addWaypoint(this.#route, lon, lat, ele, name)
  }

  insertWaypoint(index, lon, lat, ele, name) {
    return insertWaypoint(this.#route, index, lon, lat, ele, name)
  }

  removeWaypoint(index) {
    const changed = removeWaypoint(this.#route, index)
    if (changed) this.reconcileSelection()
    return changed
  }

  moveWaypoint(from, to) {
    return moveWaypoint(this.#route, from, to)
  }

  renameWaypoint(index, name) {
    const waypoint = this.#route.waypoints[index]
    if (!waypoint) return false
    waypoint.name = name
    this.#route.revision++
    return true
  }

  replaceWaypoint(id, lon, lat, ele, name) {
    const waypoint = this.#route.waypoints.find((candidate) => candidate.id === id)
    if (!waypoint) return null
    Object.assign(waypoint, { lon, lat, ele, name: name || waypoint.name })
    this.bumpRevision({ geometry: true })
    return waypoint
  }

  clear() {
    this.#route.waypoints = []
    this.#route.dayEnds = []
    this.#selectedWaypointId = null
    this.#waypointMoveDraft = null
    this.bumpRevision({ geometry: true })
  }

  reverse() {
    const changed = reverseWaypoints(this.#route)
    if (changed) this.reconcileSelection()
    return changed
  }

  close() {
    return closeLoop(this.#route)
  }

  toggleDayBoundary(index) {
    return toggleDayEnd(this.#route, index)
  }

  setDayBoundaries(ids, { bumpRevision = false } = {}) {
    this.#route.dayEnds = Array.isArray(ids) ? [...ids] : []
    normalizeDayEnds(this.#route)
    if (bumpRevision) this.#route.revision++
  }

  normalizeDayBoundaries() {
    normalizeDayEnds(this.#route)
  }

  dayNumberAt(index) {
    return dayNumberAt(this.#route, index)
  }

  get dayCount() {
    return (this.#route.dayEnds?.length ?? 0) + 1
  }

  deriveStats(points) {
    return routeStats(points)
  }

  deriveDistance(coordinates = this.#route.waypoints) {
    return routeDistanceMeters(coordinates)
  }

  analyzeElevation(options = {}, { route = this.#route } = {}) {
    return analyzeRouteElevation({ ...options, route })
  }

  beginWaypointMove(id) {
    const waypoint = this.#route.waypoints.find((candidate) => candidate.id === id)
    if (!waypoint) return false
    this.#waypointMoveDraft = { id, values: { ...waypoint }, previewing: false }
    return true
  }

  previewWaypointMove(id, { lon, lat, ele }) {
    const waypoint = this.#route.waypoints.find((candidate) => candidate.id === id)
    if (!waypoint || this.#waypointMoveDraft?.id !== id) return false
    waypoint.lon = lon
    waypoint.lat = lat
    waypoint.ele = ele
    this.#waypointMoveDraft.previewing = true
    return true
  }

  commitWaypointMove(id) {
    if (!this.#route.waypoints.some((waypoint) => waypoint.id === id)) {
      this.#waypointMoveDraft = null
      return false
    }
    this.bumpRevision({ geometry: true })
    if (this.#waypointMoveDraft?.id === id) this.#waypointMoveDraft = null
    return true
  }

  cancelWaypointMove(id) {
    const waypoint = this.#route.waypoints.find((candidate) => candidate.id === id)
    if (waypoint && this.#waypointMoveDraft?.id === id) Object.assign(waypoint, this.#waypointMoveDraft.values)
    if (this.#waypointMoveDraft?.id === id) this.#waypointMoveDraft = null
    return !!waypoint
  }

  resetHistory() {
    this.#history.reset(this.#route)
  }

  recordHistory() {
    return this.#history.record(this.#route)
  }

  undo() {
    const changed = this.#history.undo(this.#route)
    if (changed) this.reconcileSelection()
    return changed
  }

  redo() {
    const changed = this.#history.redo(this.#route)
    if (changed) this.reconcileSelection()
    return changed
  }

  canUndo() { return this.#history.canUndo() }
  canRedo() { return this.#history.canRedo() }
}
