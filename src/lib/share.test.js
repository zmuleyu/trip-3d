import { describe, it, expect } from 'vitest'
import { encodeShare, decodeShare } from './share.js'
import { createRoute, addWaypoint } from './route.js'

const ctx = { dem: { lat: 31.05, lon: 102.83, zoom: 12 } }

describe('share codec', () => {
  it('round-trips route + dem context', () => {
    const r = createRoute('四姑娘山')
    addWaypoint(r, 102.83, 31.05, 3850)
    addWaypoint(r, 102.9, 31.02, 4100, '垭口')
    const hash = encodeShare(r, ctx)
    const back = decodeShare(hash)
    expect(back.dem).toEqual(ctx.dem)
    expect(back.name).toBe('四姑娘山')
    expect(back.waypoints).toHaveLength(2)
    expect(back.waypoints[1]).toMatchObject({ lon: 102.9, lat: 31.02, ele: 4100, name: '垭口' })
  })

  it('produces URL-safe base64url without padding', () => {
    const r = createRoute('x')
    addWaypoint(r, 1, 2, 3)
    const hash = encodeShare(r, ctx)
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('rejects malformed payloads', () => {
    expect(() => decodeShare('!!!')).toThrow()
    expect(() => decodeShare(btoa('{"v":99}')).toThrow(/version/))
    expect(() => decodeShare(btoa('{"v":1}')).toThrow(/dem|waypoints|malformed/i))
  })

  it('ta whitelist: accepts 3/5, rejects crafted values, missing → decodes fine', () => {
    const r = createRoute('t')
    addWaypoint(r, -110.1, 37, 900)
    addWaypoint(r, -110.0, 37.01, 950)
    const ctx = { dem: { lat: 36.9, lon: -110.1, zoom: 8, size: 1280 } }
    const hash = encodeShare(r, ctx)
    const obj = decodeShare(hash)
    expect(obj.dem.ta).toBe(5) // 5×5 grid rides along
    // crafted payloads: ta must not allow resource exhaustion
    const mk = (ta) => Buffer.from(JSON.stringify({ v: 1, dem: { lat: 36, lon: -110, zoom: 8, ta }, name: 'x', waypoints: [] }), 'utf8')
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const mkLegacy = () => Buffer.from(JSON.stringify({ v: 1, dem: { lat: 36, lon: -110, zoom: 12 }, name: 'x', waypoints: [] }), 'utf8')
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(() => decodeShare(mk(999))).toThrow()
    expect(() => decodeShare(mk(-5))).toThrow()
    expect(() => decodeShare(mk('5'))).toThrow()
    expect(() => decodeShare(mk(3))).not.toThrow()
    // legacy links without ta still decode
    expect(() => decodeShare(mkLegacy())).not.toThrow()
  })

  it('restores stripped padding for all length remainders', () => {
    // names of 1..6 chars push the b64 length through mod 4 = 0/1/2/3 cycles
    for (const name of ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef']) {
      const r = createRoute(name)
      addWaypoint(r, 102.83, 31.05, 3850)
      expect(decodeShare(encodeShare(r, ctx)).name).toBe(name)
    }
  })

  it('validates every numeric field is finite', () => {
    const bad = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(() => decodeShare(bad({ v: 1, dem: { lat: null, lon: 1, zoom: 12 }, waypoints: [] }))).toThrow(/malformed/)
    expect(() => decodeShare(bad({ v: 1, dem: { lat: 1, lon: 1, zoom: 12 }, waypoints: [[Infinity, 0, 0, 'x']] }))).toThrow(/malformed/)
    expect(() => decodeShare(bad({ v: 1, dem: { lat: 1, lon: 1, zoom: 99 }, waypoints: [] }))).toThrow(/malformed/)
  })

  it('rejects payloads exceeding the waypoint cap (Codex r3: locks H17 fix)', () => {
    const bad = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const wps = Array.from({ length: 33 }, (_, i) => [102 + i * 0.001, 31, 3000, `P${i}`])
    expect(() => decodeShare(bad({ v: 1, dem: { lat: 31, lon: 102, zoom: 12 }, waypoints: wps }))).toThrow(/malformed/)
    const ok = Array.from({ length: 32 }, (_, i) => [102 + i * 0.001, 31, 3000, `P${i}`])
    expect(decodeShare(bad({ v: 1, dem: { lat: 31, lon: 102, zoom: 12 }, waypoints: ok })).waypoints).toHaveLength(32)
  })
})
