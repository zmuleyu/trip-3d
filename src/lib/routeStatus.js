export function routeProviderStatus({ state, routed = 0, total = 0 } = {}) {
  if (state === 'calculating') return '正在计算路线…'
  if (state === 'unavailable') return '路网暂不可用：当前为直线示意，无时长。可切换“直线”继续或稍后重试。'
  if (total > 0 && routed < total) return '部分路段暂不可用：当前为直线示意，无时长。可切换“直线”继续或稍后重试。'
  return `路线可用：路网覆盖 ${routed}/${total} 段`
}
