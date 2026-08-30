const readyStatuses = new Set(['ready', 'fallback-ready'])

const finite = (value) => Number.isFinite(value)

function sampleElevation(points, distanceM) {
  if (!Array.isArray(points) || points.length < 2 || !finite(distanceM)) return null
  if (!points.every((point) => finite(point?.cumDistM) && finite(point?.ele))) return null
  const first = points[0]
  const last = points.at(-1)
  const distance = Math.max(first.cumDistM, Math.min(last.cumDistM, distanceM))
  for (let index = 1; index < points.length; index++) {
    const next = points[index]
    if (distance > next.cumDistM) continue
    const previous = points[index - 1]
    const span = next.cumDistM - previous.cumDistM
    const fraction = span > 0 ? (distance - previous.cumDistM) / span : 0
    const elevationM = previous.ele + (next.ele - previous.ele) * fraction
    return finite(elevationM) ? elevationM : null
  }
  return last.ele
}

function usableSegments(route, segments) {
  const expected = Math.max(0, (route?.waypoints?.length ?? 0) - 1)
  if (!expected || !Array.isArray(segments) || segments.length !== expected) return []
  const valid = segments.every((segment, index) => (
    segment?.index === index
    && segment?.selection?.kind === 'segment'
    && finite(segment.startM)
    && finite(segment.endM)
    && segment.endM > segment.startM
  ))
  return valid ? segments : []
}

function selectedFact(selectedSegment) {
  if (!selectedSegment || !finite(selectedSegment.startM) || !finite(selectedSegment.endM)) return null
  return {
    ...selectedSegment,
    distanceM: selectedSegment.endM - selectedSegment.startM,
  }
}

function availability(analysis, segments, resilience) {
  const facts = []
  const elevationAvailable = analysis?.status === 'ready'
    && Array.isArray(analysis.points)
    && analysis.points.length >= 2
    && analysis.points.every((point) => finite(point?.ele) && finite(point?.cumDistM))
  if (elevationAvailable && analysis?.grade?.status === 'ready') facts.push('高程与坡度可用')
  else if (elevationAvailable) facts.push('高程可用，坡度暂不可用')
  else facts.push('高程暂不可用')

  const durationsAvailable = segments.length > 0 && segments.every((segment) => segment.leg?.real && finite(segment.leg.durationS))
  facts.push(durationsAvailable ? '路线时长可用' : '路线时长不可用')
  facts.push(resilience?.status === 'fallback-ready' ? '3D 不可用，2D 分析可用' : '3D 分析可用')
  return facts.join('；')
}

function unavailableMessage(status) {
  const state = {
    incomplete: '至少添加起点和终点。',
    preparing: '正在准备路线分析。',
    stale: '路线分析已过期。',
    failed: '路线分析暂不可用。',
  }[status] ?? '路线分析暂不可用。'
  return `${state}恢复操作在高程剖面中。`
}

// Presentation-only facts for the Analyze Inspector. Lifecycle and selection
// stay with the existing resilience and A2 owners.
export function deriveRouteOverview({ route, segments, analysis, resilience, selectedSegment = null } = {}) {
  const status = resilience?.status ?? 'incomplete'
  if (!readyStatuses.has(status)) {
    return { status, ready: false, message: unavailableMessage(status), selected: null, longest: null, elevation: null, availability: null }
  }

  const verifiedSegments = usableSegments(route, segments)
  const withDistance = verifiedSegments.map((segment) => ({ ...segment, distanceM: segment.endM - segment.startM }))
  const longest = withDistance.length
    ? withDistance.reduce((best, segment) => segment.distanceM > best.distanceM ? segment : best)
    : null
  const elevationCandidates = withDistance.map((segment) => {
    const startElevationM = sampleElevation(analysis?.points, segment.startM)
    const endElevationM = sampleElevation(analysis?.points, segment.endM)
    return finite(startElevationM) && finite(endElevationM)
      ? { ...segment, elevationDeltaM: endElevationM - startElevationM }
      : null
  }).filter(Boolean)
  const elevation = elevationCandidates.length === withDistance.length && elevationCandidates.length
    ? elevationCandidates.reduce((best, segment) => Math.abs(segment.elevationDeltaM) > Math.abs(best.elevationDeltaM) ? segment : best)
    : null

  return {
    status,
    ready: true,
    message: null,
    selected: selectedFact(selectedSegment),
    longest,
    elevation,
    availability: availability(analysis, withDistance, resilience),
  }
}
