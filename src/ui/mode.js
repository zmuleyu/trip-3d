// Mode machine: browse | planning. Drives click-to-place listeners and UI chrome.
// Pure module (no DOM) — key handling is delegated to handleKey so it's testable.
export const MODES = Object.freeze({ BROWSE: 'browse', PLANNING: 'planning' })

export function createModeMachine({ onChange } = {}) {
  let mode = MODES.BROWSE
  const set = (next) => {
    if (next === mode) return
    mode = next
    onChange?.(mode)
  }
  return {
    get mode() { return mode },
    isPlanning: () => mode === MODES.PLANNING,
    enterPlanning: () => set(MODES.PLANNING),
    exitPlanning: () => set(MODES.BROWSE),
    togglePlanning: () => set(mode === MODES.PLANNING ? MODES.BROWSE : MODES.PLANNING),
    // returns true when the key was consumed
    handleKey(key) {
      if (key === 'Escape' && mode === MODES.PLANNING) {
        set(MODES.BROWSE)
        return true
      }
      return false
    },
  }
}
