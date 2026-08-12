export function nextLayerButtonAction({ on, panelOpen = false, repeatOpensPanel = false }) {
  if (repeatOpensPanel && on) return { on: true, panelOpen: !panelOpen, toggled: false }
  return { on: !on, panelOpen: false, toggled: true }
}
