// Snapshot-based undo/redo for route editing. Waypoints are ≤32 tiny objects —
// JSON deep-copy snapshots are simpler and safer than inverse ops.
export function createHistory(limit = 50) {
  let undoStack = []
  let redoStack = []
  let lastSnap = null

  const snap = (route) => JSON.parse(JSON.stringify({
    waypoints: route.waypoints,
    dayEnds: route.dayEnds ?? [],
  }))

  const apply = (route, s) => {
    route.waypoints = JSON.parse(JSON.stringify(s.waypoints))
    route.dayEnds = [...s.dayEnds]
    // invalidate async consumers bound to the pre-undo state
    route.revision++
    route.geometryRevision++
  }

  return {
    reset(route) {
      undoStack = []
      redoStack = []
      lastSnap = snap(route)
    },
    // call after every route mutation; dedups unchanged states, clears redo
    record(route) {
      const s = snap(route)
      if (lastSnap && JSON.stringify(s) === JSON.stringify(lastSnap)) return false
      if (lastSnap) undoStack.push(lastSnap)
      if (undoStack.length > limit) undoStack.shift()
      lastSnap = s
      redoStack = []
      return true
    },
    undo(route) {
      if (!undoStack.length) return false
      redoStack.push(snap(route))
      const s = undoStack.pop()
      lastSnap = s
      apply(route, s)
      return true
    },
    redo(route) {
      if (!redoStack.length) return false
      undoStack.push(snap(route))
      const s = redoStack.pop()
      lastSnap = s
      apply(route, s)
      return true
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  }
}
