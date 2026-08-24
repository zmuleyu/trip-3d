import { iconSvg } from './icons.js'

export function createPlannerWorkspace({ onView, onExpand, onSearch, onPrimary, onWeather, onMoreAction } = {}) {
  const el = document.createElement('div')
  el.className = 'ui-planner-workspace hidden'
  el.innerHTML = `
    <header class="ui-planner-bar">
      <div class="ui-planner-brand"><b>TRIP <em>3D</em></b></div>
      <form class="ui-command-search" role="search">
        <input type="search" aria-label="搜索地点、线路或营地" placeholder="搜索地点、线路、营地">
        <button type="submit" aria-label="搜索">${iconSvg('search')}</button>
      </form>
      <div class="ui-trip-identity"><b>未命名线路</b><span>尚未设置日期</span></div>
      <div class="ui-view-switch" role="group" aria-label="规划视图">
        <button type="button" data-view="2d">地图</button>
        <button type="button" data-view="3d">地形</button>
      </div>
      <button type="button" class="ui-planner-primary">继续规划</button>
      <button type="button" class="ui-planner-weather" aria-label="天气">${iconSvg('weather')}<span>天气</span></button>
      <button type="button" class="ui-planner-layer-toggle" aria-controls="ui-layer-tools" aria-expanded="false" aria-label="打开图层工具">${iconSvg('layers')}<span>图层</span></button>
      <button type="button" class="ui-planner-more" aria-label="更多和进阶设置">${iconSvg('more')}<span>更多</span></button>
    </header>
    <div class="ui-planner-more-menu hidden" role="menu" aria-label="更多操作">
      <button type="button" role="menuitem" data-more-action="library">线路库</button>
      <button type="button" role="menuitem" data-more-action="share">分享</button>
      <button type="button" role="menuitem" data-more-action="import">导入 GPX</button>
      <button type="button" role="menuitem" data-more-action="export">导出 GPX</button>
      <button type="button" role="menuitem" data-more-action="settings">进阶设置</button>
    </div>
    <div class="ui-route-coverage hidden" role="alert">
      <span class="ui-coverage-dot"></span>
      <div><b>路线超出当前地形数据范围</b><span data-field="coverage-detail"></span></div>
      <button type="button">扩展地形范围</button>
    </div>
  `
  let view = '2d'
  const buttons = [...el.querySelectorAll('[data-view]')]
  const search = el.querySelector('.ui-command-search')
  const searchInput = search.querySelector('input')
  const primary = el.querySelector('.ui-planner-primary')
  search.addEventListener('submit', (event) => { event.preventDefault(); onSearch?.(searchInput.value) })
  primary.addEventListener('click', () => onPrimary?.())
  el.querySelector('.ui-planner-weather').addEventListener('click', () => onWeather?.())
  const more = el.querySelector('.ui-planner-more')
  const moreMenu = el.querySelector('.ui-planner-more-menu')
  const setMoreOpen = (open) => {
    moreMenu.classList.toggle('hidden', !open)
    more.setAttribute('aria-expanded', String(open))
  }
  more.addEventListener('click', () => setMoreOpen(more.getAttribute('aria-expanded') !== 'true'))
  moreMenu.addEventListener('click', (event) => {
    const action = event.target.closest('[data-more-action]')?.dataset.moreAction
    if (!action) return
    setMoreOpen(false)
    onMoreAction?.(action)
  })
  const layerToggle = el.querySelector('.ui-planner-layer-toggle')
  const setLayersOpen = (open) => {
    document.body.classList.toggle('planner-layers-open', open)
    layerToggle.setAttribute('aria-expanded', String(open))
    layerToggle.setAttribute('aria-label', open ? '关闭图层工具' : '打开图层工具')
  }
  layerToggle.addEventListener('click', () => setLayersOpen(layerToggle.getAttribute('aria-expanded') !== 'true'))
  const applyView = (next, notify = false) => {
    view = next === '3d' ? '3d' : '2d'
    for (const button of buttons) {
      const active = button.dataset.view === view
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    }
    el.classList.toggle('view-3d', view === '3d')
    if (notify) onView?.(view)
  }
  buttons.forEach((button) => button.addEventListener('click', () => applyView(button.dataset.view, true)))
  el.querySelector('.ui-route-coverage button').addEventListener('click', () => onExpand?.())
  applyView('2d')
  return {
    el,
    get view() { return view },
    setVisible(on) { el.classList.toggle('hidden', !on); if (!on) { setLayersOpen(false); setMoreOpen(false) } },
    setLayersOpen,
    setView(next) { applyView(next) },
    setPrimaryLabel(label) { primary.textContent = label || '继续规划' },
    updateTrip({ name, dateText, saved } = {}) {
      const identity = el.querySelector('.ui-trip-identity')
      identity.querySelector('b').textContent = name || '未命名线路'
      identity.querySelector('span').textContent = `${dateText || '尚未设置日期'}${saved == null ? '' : saved ? ' · 已保存' : ' · 未保存'}`
    },
    setCoverage(coverage) {
      const alert = el.querySelector('.ui-route-coverage')
      const blocked = coverage && !coverage.covered
      alert.classList.toggle('hidden', !blocked)
      if (blocked) {
        el.querySelector('[data-field="coverage-detail"]').textContent =
          ` ${coverage.outsideCount}/${coverage.total} 个采样点在范围外；高程与坡度已暂停。`
      }
    },
  }
}
