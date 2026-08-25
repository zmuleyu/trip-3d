export function createFrameScheduler({
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
  onFrame,
} = {}) {
  if (typeof onFrame !== 'function') throw new TypeError('onFrame is required')

  let running = false
  let frameHandle = null
  let frameCount = 0

  const run = (time) => {
    frameHandle = null
    if (!running) return
    frameCount++
    onFrame(time)
    if (running) frameHandle = requestFrame(run)
  }

  return {
    start() {
      if (running) return false
      running = true
      frameHandle = requestFrame(run)
      return true
    },
    stop() {
      if (!running) return false
      running = false
      if (frameHandle != null) cancelFrame(frameHandle)
      frameHandle = null
      return true
    },
    get running() { return running },
    get frameCount() { return frameCount },
  }
}
