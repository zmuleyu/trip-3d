import { iconSvg } from './icons.js'

export function createPlannerWorkspace({ onView, onExpand, onSearch, onPrimary, onWeather, onMoreAction, onSpineExpand } = {}) {
  const el = document.createElement('div')
  el.className = 'ui-planner-workspace hidden'
  el.innerHTML = `
    <header class="ui-planner-bar">
      <div class="ui-planner-brand-island">
        <div class="ui-planner-brand"><b>TRIP <em>3D</em></b></div>
        <form class="ui-command-search" role="search">
          <input type="search" aria-label="搜索地点、线路或营地" placeholder="搜索地点、线路、营地">
          <button type="submit" aria-label="搜索">${iconSvg('search')}</button>
        </form>
      </div>
      <div class="ui-trip-identity"><b>未命名线路</b><span>尚未设置日期</span></div>
      <div class="ui-planner-action-island">
        <div class="ui-view-switch" role="group" aria-label="规划视图">
          <button type="button" data-view="2d">2D 地图</button>
          <button type="button" data-view="3d">3D 地形</button>
        </div>
        <button type="button" class="ui-planner-primary">开始规划</button>
        <button type="button" class="ui-planner-more" aria-label="更多和进阶设置">${iconSvg('more')}<span>更多</span></button>
      </div>
      <div class="ui-planner-context-tools" aria-label="地图快捷工具">
        <button type="button" class="ui-planner-weather" aria-label="天气">${iconSvg('weather')}<span>天气</span></button>
        <button type="button" class="ui-planner-layer-toggle" aria-controls="ui-layer-tools" aria-expanded="false" aria-label="打开图层工具">${iconSvg('layers')}<span>图层</span></button>
      </div>
    </header>
    <div class="ui-planner-more-menu hidden" role="menu" aria-label="更多操作">
      <span class="ui-planner-more-label" role="presentation">线路传输</span>
      <button type="button" role="menuitem" data-more-action="import">导入 GPX</button>
      <button type="button" role="menuitem" data-more-action="export">导出 GPX</button>
      <span class="ui-planner-more-label" role="presentation">显示</span>
      <button type="button" role="menuitem" data-more-action="settings">进阶设置</button>
    </div>
    <div class="ui-route-coverage hidden" role="alert">
      <span class="ui-coverage-dot"></span>
      <div><b>路线超出当前地形数据范围</b><span data-field="coverage-detail"></span></div>
      <button type="button">扩展地形范围</button>
    </div>
    <section class="ui-trip-spine" aria-label="行程记录">
      <button type="button" class="ui-trip-spine-title">${iconSvg('planning')}<span>行程记录</span></button>
      <div class="ui-trip-spine-days"></div>
      <button type="button" class="ui-trip-spine-expand">展开详情</button>
    </section>
  `
  let view = '2d'
  const buttons = [...el.querySelectorAll('[data-view]')]
  const search = el.querySelector('.ui-command-search')
  const searchInput = search.querySelector('input')
  const primary = el.querySelector('.ui-planner-primary')
  const spine = el.querySelector('.ui-trip-spine')
  const spineDays = spine.querySelector('.ui-trip-spine-days')
  search.addEventListener('submit', (event) => { event.preventDefault(); onSearch?.(searchInput.value) })
  primary.addEventListener('click', () => onPrimary?.())
  spine.querySelector('.ui-trip-spine-title').addEventListener('click', () => onSpineExpand?.())
  spine.querySelector('.ui-trip-spine-expand').addEventListener('click', () => onSpineExpand?.())
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
    setPrimaryLabel(label) {
      primary.textContent = label || '编辑路线'
      primary.classList.toggle('has-route', primary.textContent === '编辑路线')
    },
    setJourneySpine({ route, legs = [], weatherDays = [] } = {}) {
      spineDays.replaceChildren()
      const points = route?.waypoints ?? []
      if (points.length < 2) {
        const empty = document.createElement('span')
        empty.className = 'ui-trip-spine-empty'
        empty.textContent = '在地图设置起点，开始记录行程'
        spineDays.appendChild(empty)
        return
      }
      const endIndexes = (route.dayEnds ?? [])
        .map((id) => points.findIndex((point) => point.id === id))
        .filter((index) => index > 0 && index < points.length - 1)
        .sort((a, b) => a - b)
      const boundaries = [...endIndexes, points.length - 1]
      let startIndex = 0
      boundaries.forEach((endIndex, index) => {
        const day = document.createElement('article')
        day.className = 'ui-trip-spine-day'
        const weather = weatherDays[index]
        const date = weather?.date?.slice?.(5)?.replace('-', '月')
        const dayLegs = legs.slice(startIndex, endIndex)
        const distanceM = dayLegs.reduce((sum, leg) => sum + (Number(leg.distanceM) || 0), 0)
        const weatherText = weather
          ? `${weather.isRain ? '有雨' : '天气稳定'} ${Number.isFinite(weather.tempMax) ? `${Math.round(weather.tempMax)}°` : '温度未知'}`
          : '天气未加载'
        const label = document.createElement('b')
        label.textContent = `D${index + 1}${date ? ` · ${date}日` : ''}`
        const routeText = document.createElement('span')
        routeText.textContent = `${points[startIndex].name} → ${points[endIndex].name}`
        const detail = document.createElement('small')
        detail.textContent = `${distanceM ? `${(distanceM / 1000).toFixed(1)} km · ` : ''}${weatherText}`
        day.append(label, routeText, detail)
        spineDays.appendChild(day)
        startIndex = endIndex
      })
    },
    updateTrip({ name, dateText, saved } = {}) {
      const identity = el.querySelector('.ui-trip-identity')
      identity.dataset.saved = saved == null ? '' : String(!!saved)
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
