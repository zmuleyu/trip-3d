// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { routeToGpx, gpxToRoute } from './gpx.js'
import { createRoute, addWaypoint, MAX_WAYPOINTS } from './route.js'

const sample = () => {
  const r = createRoute('四姑娘山 D3')
  addWaypoint(r, 102.83, 31.05, 3850)
  addWaypoint(r, 102.9, 31.02, 4100, '垭口')
  return r
}

describe('gpx', () => {
  it('exports valid GPX 1.1 with rte/rtept', () => {
    const g = routeToGpx(sample())
    expect(g).toContain('<gpx version="1.1"')
    expect(g).toContain('<rte>')
    expect(g).toContain('lat="31.05"')
    expect(g).toContain('<ele>3850</ele>')
    expect(g).toContain('<name>垭口</name>')
  })

  it('escapes XML entities in names', () => {
    const r = createRoute('A & B <trail>')
    addWaypoint(r, 1, 2, 3, 'P<1>')
    const g = routeToGpx(r)
    expect(g).toContain('A &amp; B &lt;trail&gt;')
    expect(g).toContain('P&lt;1&gt;')
  })

  it('round-trip: gpxToRoute(routeToGpx(r)) preserves waypoints', () => {
    const r = sample()
    const back = gpxToRoute(routeToGpx(r))
    expect(back.name).toBe('四姑娘山 D3')
    expect(back.waypoints).toHaveLength(2)
    expect(back.waypoints[0].lon).toBeCloseTo(102.83, 6)
    expect(back.waypoints[1].ele).toBe(4100)
    expect(back.waypoints[1].name).toBe('垭口')
  })

  it('parses namespaced GPX and wpt-only files', () => {
    const g = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="x">
  <wpt lat="31.05" lon="102.83"><ele>3850</ele><name>Summit</name></wpt>
</gpx>`
    const r = gpxToRoute(g)
    expect(r.waypoints).toHaveLength(1)
    expect(r.waypoints[0].name).toBe('Summit')
  })

  it('throws on empty/invalid GPX', () => {
    expect(() => gpxToRoute('<gpx></gpx>')).toThrow(/no waypoints/i)
    expect(() => gpxToRoute('not xml')).toThrow(/invalid/i)
  })

  it('imports tracks denser than MAX_WAYPOINTS with documented downsampling that PRESERVES endpoints', () => {
    const r = gpxToRoute(bigTrackGpx(200))
    expect(r.waypoints.length).toBe(MAX_WAYPOINTS)
    expect(r.downsampled).toBe(true)
    expect(r.originalPointCount).toBe(200)
    // endpoint preservation: first kept point = first trackpoint, last = last
    expect(r.waypoints[0].lat).toBeCloseTo(31, 6)
    expect(r.waypoints[0].ele).toBe(3000)
    expect(r.waypoints.at(-1).lat).toBeCloseTo(31 + 199 * 0.001, 4)
    expect(r.waypoints.at(-1).ele).toBe(3000 + 199)
  })

  it('rejects non-finite / out-of-range coordinates, defaults missing ele to 0', () => {
    const mk = (attrs) => `<?xml version="1.0"?><gpx version="1.1" creator="x"><rte><rtept ${attrs}/></rte></gpx>`
    expect(() => gpxToRoute(mk('lat="abc" lon="102"'))).toThrow(/invalid coordinate/)
    expect(() => gpxToRoute(mk('lat="95" lon="102"'))).toThrow(/invalid coordinate/)
    expect(() => gpxToRoute(mk('lat="31" lon="-200"'))).toThrow(/invalid coordinate/)
    expect(() => gpxToRoute(mk('lon="102"'))).toThrow(/invalid coordinate/)
    const ok = gpxToRoute(mk('lat="31" lon="102"')) // ele missing → 0 by policy
    expect(ok.waypoints[0].ele).toBe(0)
  })
})

function bigTrackGpx(n) {
  const pts = Array.from({ length: n }, (_, i) => `<trkpt lat="${31 + i * 0.001}" lon="102.8"><ele>${3000 + i}</ele></trkpt>`).join('')
  return `<?xml version="1.0"?><gpx version="1.1" creator="x" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>T</name><trkseg>${pts}</trkseg></trk></gpx>`
}
