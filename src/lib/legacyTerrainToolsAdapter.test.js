import { describe, expect, it, vi } from 'vitest'
import { createLegacyTerrainToolsAdapter } from './legacyTerrainToolsAdapter.js'

function setup({ route = { name: '测试线路', waypoints: [{ id: 'a' }, { id: 'b' }] }, supported = true, ready = true, deferTerrain = false } = {}) {
  const requestLegacyFrames = vi.fn()
  const scheduledTerrainWork = []
  const schedule = vi.fn((work) => {
    if (deferTerrain) scheduledTerrainWork.push(work)
    else work()
  })
  const recorder = { start: vi.fn(), stop: vi.fn() }
  const ports = {
    poster: { unavailable: vi.fn(), isReady: () => ready, notReady: vi.fn(), pending: vi.fn(), captureImage: vi.fn(async () => 'image'), render: vi.fn(() => 'canvas'), download: vi.fn() },
    flyover: {
      routeInsufficient: vi.fn(), isReady: () => ready, notReady: vi.fn(), isSupported: () => supported, unsupported: vi.fn(), durationFor: () => 12,
      resample: vi.fn(() => [{ x: 0, z: 0 }, { x: 1, z: 1 }]), ground: vi.fn(() => 0), createRecorder: vi.fn(() => recorder),
      captureCamera: vi.fn(() => ({ pos: {}, target: {} })), activate: vi.fn(), deactivate: vi.fn(), applyFrame: vi.fn(),
      setProgress: vi.fn(), started: vi.fn(), download: vi.fn(),
    },
    terrain: {
      showLoading: vi.fn(), schedule, rebuild: vi.fn(), refreshRoute: vi.fn(), reloadAdminIfNeeded: vi.fn(),
      refreshStaticShadow: vi.fn(), hideLoading: vi.fn(), resolveWaiters: vi.fn(),
    },
    camera: { cancelMotion: vi.fn() },
  }
  const adapter = createLegacyTerrainToolsAdapter({
    getTripSnapshot: () => route,
    getPosterSnapshot: () => ({ route, stats: { distanceM: 10 }, legs: [], weather: null, profile: 'foot' }),
    getFlyoverSnapshot: () => ({ points: [{ cumDistM: 0 }, { cumDistM: 1200 }], name: route.name }),
    ...ports,
    requestLegacyFrames,
  })
  return { adapter, ports, recorder, requestLegacyFrames, schedule, scheduledTerrainWork }
}

describe('LegacyTerrainToolsAdapter', () => {
  it('keeps poster data/download reachable through one on-demand trip snapshot', async () => {
    const loading = setup({ ready: false })
    await expect(loading.adapter.exportPoster()).resolves.toEqual({ status: 'terrain-not-ready' })
    expect(loading.ports.poster.notReady).toHaveBeenCalledOnce()
    expect(loading.ports.poster.captureImage).not.toHaveBeenCalled()

    const { adapter, ports } = setup()

    await expect(adapter.exportPoster()).resolves.toEqual({ status: 'downloaded' })
    expect(ports.poster.pending).toHaveBeenCalledOnce()
    expect(ports.poster.render).toHaveBeenCalledWith(expect.objectContaining({ image: 'image', route: expect.objectContaining({ name: '测试线路' }) }))
    expect(ports.poster.download).toHaveBeenCalledWith('canvas', '测试线路')
  })

  it('keeps truthful flyover availability and wakes legacy frames only for active recording', () => {
    const loading = setup({ ready: false })
    expect(loading.adapter.startFlyover()).toEqual({ status: 'terrain-not-ready' })
    expect(loading.ports.flyover.notReady).toHaveBeenCalledOnce()
    expect(loading.requestLegacyFrames).not.toHaveBeenCalled()

    const unsupported = setup({ supported: false })
    expect(unsupported.adapter.startFlyover()).toEqual({ status: 'unsupported' })
    expect(unsupported.ports.flyover.unsupported).toHaveBeenCalledOnce()
    expect(unsupported.requestLegacyFrames).not.toHaveBeenCalled()

    const { adapter, ports, recorder, requestLegacyFrames } = setup()
    expect(adapter.startFlyover()).toEqual({ status: 'active', duration: 12 })
    expect(recorder.start).toHaveBeenCalledWith(250)
    expect(ports.camera.cancelMotion).toHaveBeenCalledOnce()
    expect(requestLegacyFrames).toHaveBeenCalledOnce()
    expect(adapter.flyoverActive).toBe(true)
    adapter.tickFlyover(6)
    expect(ports.flyover.applyFrame).toHaveBeenCalledOnce()
    adapter.stopFlyover(false)
    expect(recorder.stop).toHaveBeenCalledOnce()
  })

  it('keeps real-terrain rebuild and retained camera work behind ports without idle RAF work', () => {
    const { adapter, ports, requestLegacyFrames, schedule } = setup()

    expect(requestLegacyFrames).not.toHaveBeenCalled()
    expect(adapter.rebuildTerrain()).toEqual({ status: 'scheduled' })
    expect(schedule).toHaveBeenCalledOnce()
    expect(ports.terrain.rebuild).toHaveBeenCalledOnce()
    expect(requestLegacyFrames).not.toHaveBeenCalled()

    adapter.wakeCamera()
    expect(requestLegacyFrames).toHaveBeenCalledOnce()
  })

  it('preserves the existing rebuild metadata keys through queued terrain work', () => {
    const { adapter, scheduledTerrainWork } = setup({ deferTerrain: true })

    expect(adapter.rebuildState).toEqual({ rebuildPending: false, rebuildQueued: false })
    expect(adapter.rebuildTerrain()).toEqual({ status: 'scheduled' })
    expect(adapter.rebuildState).toEqual({ rebuildPending: true, rebuildQueued: false })
    expect(adapter.rebuildTerrain()).toEqual({ status: 'queued' })
    expect(adapter.rebuildState).toEqual({ rebuildPending: true, rebuildQueued: true })

    scheduledTerrainWork.shift()()
    expect(adapter.rebuildState).toEqual({ rebuildPending: true, rebuildQueued: false })
    scheduledTerrainWork.shift()()
    expect(adapter.rebuildState).toEqual({ rebuildPending: false, rebuildQueued: false })
  })
})
