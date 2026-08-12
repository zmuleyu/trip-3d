const LEVEL_LABELS = { auto: '自动', province: '省', city: '市', district: '县' }

export function createAdminBoundaryUI({ onEnabled, onLevel, onInspect, onCloseSelection, onFocus } = {}) {
  const el = document.createElement('section')
  el.className = 'admin-panel hidden'
  el.setAttribute('aria-label', '行政区划图层设置')
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = `
    <header class="admin-head"><span class="admin-sq"></span><h2>行政区划</h2><button type="button" class="admin-switch" data-action="enabled" aria-label="关闭行政区划" aria-pressed="true"></button></header>
    <div class="admin-body">
      <div class="admin-eyebrow">CURRENT AREA / 当前区域</div>
      <div class="admin-crumb" data-field="breadcrumb">区域识别中…</div>
      <div class="admin-eyebrow">LEVEL / 显示层级</div>
      <div class="admin-levels" role="group" aria-label="行政区划显示层级">
        ${Object.entries(LEVEL_LABELS).map(([value, label]) => `<button type="button" data-level="${value}">${label}</button>`).join('')}
      </div>
      <div class="admin-row"><span>行政标签</span><b>智能</b></div>
      <div class="admin-row"><span>当前视图</span><b data-field="segments">—</b></div>
      <div class="admin-legend" aria-label="边界图例"><span><i class="province"></i>省界</span><span><i class="city"></i>市界</span><span><i class="district"></i>县界</span></div>
      <button type="button" class="admin-inspect" data-action="inspect">进入查看区划模式</button>
      <footer class="admin-source"><span>DATAV · 中国范围</span><span data-field="cache">缓存状态未知</span></footer>
    </div>`

  const modebar = document.createElement('div')
  modebar.className = 'admin-modebar hidden'
  modebar.setAttribute('role', 'status')
  modebar.innerHTML = '<span class="admin-pulse"></span><b>查看区划中</b><span>点击区域查看详情</span><kbd>ESC 退出</kbd>'

  const empty = document.createElement('div')
  empty.className = 'admin-empty hidden'
  empty.setAttribute('role', 'status')

  const detail = document.createElement('aside')
  detail.className = 'admin-detail hidden'
  detail.setAttribute('aria-label', '选中行政区详情')
  detail.innerHTML = '<h3 data-field="name"></h3><p data-field="parents"></p><dl><dt>行政代码</dt><dd data-field="adcode">—</dd><dt>当前状态</dt><dd>已选中</dd><dt>交互说明</dt><dd>规划打点已暂停</dd></dl><div class="admin-actions"><button type="button" data-action="focus">聚焦此区域</button><button type="button" data-action="close-selection">关闭</button></div>'

  el.querySelector('[data-action="enabled"]').onclick = () => onEnabled?.(false)
  for (const button of el.querySelectorAll('[data-level]')) button.onclick = () => onLevel?.(button.dataset.level)
  el.querySelector('[data-action="inspect"]').onclick = () => onInspect?.()
  detail.querySelector('[data-action="close-selection"]').onclick = () => onCloseSelection?.()
  detail.querySelector('[data-action="focus"]').onclick = () => onFocus?.()

  document.body.append(el, modebar, empty, detail)
  return {
    el, modebar, empty, detail,
    setPanelOpen(open) {
      el.classList.toggle('hidden', !open)
      el.setAttribute('aria-hidden', String(!open))
    },
    update({ enabled = false, breadcrumb = [], level = 'auto', segmentCount = 0, cacheStatus = '缓存状态未知', inspecting = false, emptyMessage = '', selected = null, panelOpen = true } = {}) {
      this.setPanelOpen(enabled && panelOpen)
      el.querySelector('[data-field="breadcrumb"]').textContent = breadcrumb.length ? breadcrumb.join(' › ') : '区域识别中…'
      const inferredViewLevel = breadcrumb.length >= 3 ? '县级' : breadcrumb.length === 2 ? '市级' : breadcrumb.length === 1 ? '省级' : '—'
      el.querySelector('[data-field="segments"]').textContent = `${inferredViewLevel} · ${segmentCount} 段`
      el.querySelector('[data-field="cache"]').textContent = cacheStatus
      for (const button of el.querySelectorAll('[data-level]')) {
        const active = button.dataset.level === level
        button.classList.toggle('active', active)
        button.setAttribute('aria-pressed', String(active))
      }
      const inspectButton = el.querySelector('[data-action="inspect"]')
      inspectButton.textContent = inspecting ? '退出查看区划模式' : '进入查看区划模式'
      inspectButton.classList.toggle('active', inspecting)
      modebar.classList.toggle('hidden', !inspecting)
      empty.textContent = emptyMessage
      empty.classList.toggle('hidden', !enabled || segmentCount > 0 || !emptyMessage)
      detail.classList.toggle('hidden', !selected)
      if (selected) {
        detail.querySelector('[data-field="name"]').textContent = selected.name ?? '未命名行政区'
        detail.querySelector('[data-field="parents"]').textContent = selected.parents?.join(' · ') ?? ''
        detail.querySelector('[data-field="adcode"]').textContent = selected.adcode || '—'
      }
    },
  }
}
