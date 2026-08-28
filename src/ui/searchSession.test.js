import { describe, expect, it } from 'vitest'
import { createSearchSession, SEARCH_SESSION_STATES } from './searchSession.js'

describe('search session', () => {
  it('keeps place selection transient until a caller explicitly assigns a role', () => {
    const session = createSearchSession()
    const place = { name: '人民公园', context: '成都市 · 青羊区 · 四川省', category: '公园' }

    expect(session.begin('人民公园').state).toBe(SEARCH_SESSION_STATES.SEARCHING)
    expect(session.resolve([place]).state).toBe(SEARCH_SESSION_STATES.RESULTS)
    const selected = session.select(place)

    expect(selected.state).toBe(SEARCH_SESSION_STATES.PLACE_SELECTION)
    expect(selected.selected).toEqual(place)
    expect(selected.message).toContain('青羊区')
  })

  it('states a retryable failure without retaining a stale place selection', () => {
    const session = createSearchSession()
    session.begin('锦里')
    session.select({ name: '锦里', context: '成都市 · 武侯区 · 四川省', category: '景点' })

    expect(session.fail()).toMatchObject({ state: SEARCH_SESSION_STATES.ERROR, selected: null, message: expect.stringContaining('Photon 备用') })
  })

  it('keeps provider and fallback metadata transient and visible in the result message', () => {
    const session = createSearchSession()
    session.begin('成都')
    const source = { kind: 'photon', label: 'Photon 备用' }
    const place = { name: '成都', context: '成都市 · 锦江区 · 四川省', category: '城市', source }
    expect(session.resolve([place], { source, fallbackUsed: true })).toMatchObject({
      source,
      fallbackUsed: true,
      message: expect.stringContaining('搜索来源：Photon 备用'),
    })
    expect(session.select(place).message).toContain('搜索来源：Photon 备用')
  })

  it('closes the command popover without discarding cached results', () => {
    const session = createSearchSession()
    session.begin('人民公园')
    session.resolve([{ name: '人民公园' }])
    session.select({ name: '人民公园' })
    const closed = session.dismiss()
    expect(closed.state).toBe(SEARCH_SESSION_STATES.IDLE)
    expect(closed.results).toHaveLength(1)
    expect(closed.selected).toBeNull()
  })
})
