import { describe, expect, it } from 'vitest'
import { adminLoadTerminal } from './adminLayerState.js'

describe('admin boundary load terminal state', () => {
  it('turns a request without terrain into a retryable error', () => {
    expect(adminLoadTerminal({ hasTerrain: false })).toEqual({ state: 'error', message: '地形尚未就绪，请稍后重试' })
  })

  it('turns a stale terrain key into a retryable error instead of leaving loading active', () => {
    expect(adminLoadTerminal({ keyCurrent: false })).toEqual({ state: 'error', message: '地形已切换，请重试' })
  })

  it('ignores a superseded request without overwriting newer state', () => {
    expect(adminLoadTerminal({ requestCurrent: false })).toEqual({ state: 'ignored', message: '' })
  })
})
