export function routeProviderStatus({ state, routed = 0, total = 0, source = 'OSM/FOSSGIS 公共路由' } = {}) {
  if (state === 'calculating') return `${source} · 正在计算…`
  if (state === 'unavailable') return '公共路由暂不可用 · 当前为直线示意 · 无时长'
  if (total > 0 && routed < total) return `${source} · 部分路段为直线示意 · 无时长`
  return `${source} · 路网覆盖 ${routed}/${total} 段`
}
