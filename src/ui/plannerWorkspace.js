export function createPlannerWorkspace({ onView, onExpand } = {}) {
  const el = document.createElement('div')
  el.className = 'ui-planner-workspace hidden'
  el.innerHTML = `
    <header class="ui-planner-bar">
      <div class="ui-planner-brand"><b>TRIP / 3D</b><span>精确规划</span></div>
      <div class="ui-view-switch" role="group" aria-label="规划视图">
        <button type="button" data-view="2d">2D 规划</button>
        <button type="button" data-view="3d">3D 预览</button>
      </div>
      <span class="ui-planner-status">地图与地形同步</span>
    </header>
    <div class="ui-route-coverage hidden" role="alert">
      <span class="ui-coverage-dot"></span>
      <div><b>路线超出当前地形数据范围</b><span data-field="coverage-detail"></span></div>
      <button type="button">扩展地形范围</button>
    </div>
    <canvas class="ui-3d-preview-canvas" width="640" height="400" aria-label="实时 3D 地形预览"></canvas>
    <div class="ui-3d-preview-label">3D 地形预览</div>
  `
  let view = '2d'
  let lastPreviewAt = -Infinity
  const buttons = [...el.querySelectorAll('[data-view]')]
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
    setVisible(on) { el.classList.toggle('hidden', !on) },
    setView(next) { applyView(next) },
    drawPreview(sourceCanvas, now = performance.now()) {
      if (!sourceCanvas || now - lastPreviewAt < 200) return
      lastPreviewAt = now
      const preview = el.querySelector('.ui-3d-preview-canvas')
      preview.getContext('2d')?.drawImage(sourceCanvas, 0, 0, preview.width, preview.height)
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
