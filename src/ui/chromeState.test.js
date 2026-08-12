import { describe, it, expect } from 'vitest'
import { nextLayerButtonAction } from './chromeState.js'

describe('layer button action policy', () => {
  it('turns an off layer on with the first click', () => {
    expect(nextLayerButtonAction({ on: false, panelOpen: false, repeatOpensPanel: true }))
      .toEqual({ on: true, panelOpen: false, toggled: true })
  })

  it('opens and closes the panel on repeated clicks without disabling the layer', () => {
    expect(nextLayerButtonAction({ on: true, panelOpen: false, repeatOpensPanel: true }))
      .toEqual({ on: true, panelOpen: true, toggled: false })
    expect(nextLayerButtonAction({ on: true, panelOpen: true, repeatOpensPanel: true }))
      .toEqual({ on: true, panelOpen: false, toggled: false })
  })

  it('keeps legacy toggle behavior for ordinary layer buttons', () => {
    expect(nextLayerButtonAction({ on: true, panelOpen: false, repeatOpensPanel: false }))
      .toEqual({ on: false, panelOpen: false, toggled: true })
  })
})
