// Isolates the retained Three-era tools without creating another trip model.
// Every dependency is a port so the adapter cannot own MapLibre, providers,
// storage/share codecs, or TripRouteController mutation.
export function createLegacyTerrainToolsAdapter({
  getTripSnapshot,
  getPosterSnapshot,
  getFlyoverSnapshot,
  poster,
  flyover,
  terrain,
  camera,
  requestLegacyFrames,
}) {
  let rebuildPending = false
  let rebuildQueued = false
  let flyState = { active: false, recorder: null, chunks: [], elapsed: 0, duration: 0, path: null, ground: null, discard: false }
  let flyPreviousCamera = null

  const wakeLegacyFrames = () => requestLegacyFrames?.()

  async function exportPoster() {
    const trip = getTripSnapshot()
    if (!trip?.waypoints || trip.waypoints.length < 2) {
      poster.unavailable()
      return { status: 'route-insufficient' }
    }
    if (poster.isReady?.() === false) {
      poster.notReady?.()
      return { status: 'terrain-not-ready' }
    }
    poster.pending()
    const snapshot = getPosterSnapshot()
    const image = await poster.captureImage()
    const canvas = poster.render({ image, ...snapshot })
    poster.download(canvas, trip.name)
    return { status: 'downloaded' }
  }

  function startFlyover() {
    if (flyState.active) return { status: 'already-active' }
    const snapshot = getFlyoverSnapshot()
    if (!snapshot?.points || snapshot.points.length < 2) {
      flyover.routeInsufficient()
      return { status: 'route-insufficient' }
    }
    if (flyover.isReady?.() === false) {
      flyover.notReady?.()
      return { status: 'terrain-not-ready' }
    }
    if (!flyover.isSupported()) {
      flyover.unsupported()
      return { status: 'unsupported' }
    }

    const duration = flyover.durationFor(snapshot.points)
    // This is a short-lived render path, not a mirrored route/trip state.
    const path = flyover.resample(snapshot.points, Math.max(60, Math.round(duration * 12)))
    let recorder
    try {
      recorder = flyover.createRecorder()
    } catch {
      flyover.unsupported()
      return { status: 'unsupported' }
    }

    const chunks = []
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = () => {
      if (!flyState.discard && chunks.length) flyover.download(chunks, snapshot.name)
    }
    flyState = {
      active: true,
      recorder,
      chunks,
      elapsed: 0,
      duration,
      path,
      ground: flyover.ground,
      discard: false,
    }
    flyPreviousCamera = flyover.captureCamera()
    camera.cancelMotion()
    flyover.activate()
    recorder.start(250)
    wakeLegacyFrames()
    flyover.started(duration)
    return { status: 'active', duration }
  }

  function stopFlyover(finish) {
    if (!flyState.active) return false
    flyState.discard = !finish
    flyState.active = false
    try { flyState.recorder.stop() } catch { /* recorder may already be stopped */ }
    flyover.deactivate(flyPreviousCamera)
    return true
  }

  function tickFlyover(dt) {
    if (!flyState.active) return false
    flyState.elapsed += dt
    const fraction = Math.min(1, flyState.elapsed / flyState.duration)
    const index = Math.min(flyState.path.length - 1, Math.floor(fraction * (flyState.path.length - 1)))
    flyover.applyFrame(flyState.path, index, flyState.ground)
    flyover.setProgress(fraction)
    if (fraction >= 1) stopFlyover(true)
    return true
  }

  function rebuildTerrain() {
    if (rebuildPending) {
      rebuildQueued = true
      return { status: 'queued' }
    }
    rebuildPending = true
    terrain.showLoading()
    terrain.schedule(() => {
      terrain.rebuild()
      terrain.refreshRoute()
      terrain.reloadAdminIfNeeded()
      terrain.refreshStaticShadow()
      rebuildPending = false
      if (rebuildQueued) {
        rebuildQueued = false
        rebuildTerrain()
        return
      }
      terrain.hideLoading()
      terrain.resolveWaiters()
    })
    return { status: 'scheduled' }
  }

  return {
    exportPoster,
    startFlyover,
    stopFlyover,
    tickFlyover,
    get flyoverActive() { return flyState.active },
    get rebuildState() { return { rebuildPending, rebuildQueued } },
    rebuildTerrain,
    wakeCamera: wakeLegacyFrames,
  }
}
