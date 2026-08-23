import { iconSvg } from './icons.js'

const SETTING_LABELS = {
  source: '地形来源',
  demLocation: '预设地点',
  demLat: '纬度',
  demLon: '经度',
  demZoom: '地图精度',
  demExaggeration: '垂直比例',
  routeSlopeColors: '坡度渐变',
  routeArrows: '方向箭头',
  routeTicks: '距离刻度',
  exposure: '曝光',
  contrast: '对比度',
  saturation: '饱和度',
  fogNear: '雾效起点',
  fogFar: '雾效终点',
}

const LAYER_LABELS = {
  contour: '等高线',
  grid: '测量网格',
  labels: '山峰标签',
  mapov: '路网叠加',
  admin: '行政区划',
  sun: '日照分析',
  hud: 'HUD 信息',
}

function createRow(label, control, hint = '') {
  const row = document.createElement('label')
  row.className = 'settings-row'
  const copy = document.createElement('span')
  copy.className = 'settings-row-copy'
  const title = document.createElement('b')
  title.textContent = label
  copy.appendChild(title)
  if (hint) {
    const description = document.createElement('small')
    description.textContent = hint
    copy.appendChild(description)
  }
  row.append(copy, control)
  return row
}

function createSection(title, description = '') {
  const section = document.createElement('section')
  section.className = 'settings-section'
  const head = document.createElement('div')
  head.className = 'settings-section-head'
  const heading = document.createElement('h3')
  heading.textContent = title
  head.appendChild(heading)
  if (description) {
    const note = document.createElement('p')
    note.textContent = description
    head.appendChild(note)
  }
  section.appendChild(head)
  return section
}

export function createSettingsPanel({ presets = [], advancedEl, onClose, onSetting, onLayer, onLoad } = {}) {
  const el = document.createElement('div')
  el.className = 'settings-native'

  const header = document.createElement('header')
  header.className = 'settings-header'
  const headingWrap = document.createElement('div')
  const eyebrow = document.createElement('span')
  eyebrow.textContent = 'TRIP / 3D'
  const heading = document.createElement('h2')
  heading.textContent = '显示与地形设置'
  headingWrap.append(eyebrow, heading)
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'settings-close'
  close.setAttribute('aria-label', '关闭设置')
  close.innerHTML = '<span aria-hidden="true">×</span>'
  close.onclick = () => onClose?.()
  header.append(headingWrap, close)
  el.appendChild(header)

  const body = document.createElement('div')
  body.className = 'settings-body'
  el.appendChild(body)

  const controls = new Map()
  const layerControls = new Map()

  const select = (key, options) => {
    const input = document.createElement('select')
    input.setAttribute('aria-label', SETTING_LABELS[key])
    for (const [value, label] of options) {
      const option = document.createElement('option')
      option.value = String(value)
      option.textContent = label
      input.appendChild(option)
    }
    input.onchange = () => onSetting?.(key, input.value, { commit: true })
    controls.set(key, input)
    return input
  }

  const number = (key, { min, max, step }) => {
    const input = document.createElement('input')
    input.type = 'number'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.setAttribute('aria-label', SETTING_LABELS[key])
    input.onchange = () => onSetting?.(key, Number(input.value), { commit: true })
    controls.set(key, input)
    return input
  }

  const range = (key, { min, max, step, digits = 2 }) => {
    const wrap = document.createElement('span')
    wrap.className = 'settings-range'
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.setAttribute('aria-label', SETTING_LABELS[key])
    const output = document.createElement('output')
    output.htmlFor = input.id
    const emit = (commit) => {
      output.value = Number(input.value).toFixed(digits)
      onSetting?.(key, Number(input.value), { commit })
    }
    input.oninput = () => emit(false)
    input.onchange = () => emit(true)
    wrap.append(input, output)
    controls.set(key, { input, output, digits })
    return wrap
  }

  const toggle = (key, label, target = controls) => {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'settings-switch'
    input.setAttribute('aria-label', label)
    input.onchange = () => {
      if (target === layerControls) onLayer?.(key, input.checked)
      else onSetting?.(key, input.checked, { commit: true })
    }
    target.set(key, input)
    return input
  }

  const terrain = createSection('地形范围', '选择数据范围与地形比例。经纬度修改后由“加载地形”提交。')
  terrain.append(
    createRow(SETTING_LABELS.source, select('source', [['real', '真实地形 DEM'], ['noise', '程序化地形']])),
    createRow(SETTING_LABELS.demLocation, select('demLocation', presets.map((name) => [name, name]))),
  )
  const coords = document.createElement('div')
  coords.className = 'settings-coordinate-grid'
  coords.append(
    createRow(SETTING_LABELS.demLat, number('demLat', { min: -85, max: 85, step: .0001 })),
    createRow(SETTING_LABELS.demLon, number('demLon', { min: -180, max: 180, step: .0001 })),
  )
  terrain.append(
    coords,
    createRow(SETTING_LABELS.demZoom, select('demZoom', [8, 9, 10, 11, 12, 13, 14].map((z) => [z, `Z${z}`])), '数值越高，覆盖范围越小、细节越多'),
    createRow(SETTING_LABELS.demExaggeration, range('demExaggeration', { min: .5, max: 5, step: .1, digits: 1 })),
  )
  const terrainAction = document.createElement('button')
  terrainAction.type = 'button'
  terrainAction.className = 'settings-primary'
  terrainAction.textContent = '加载当前地形'
  terrainAction.onclick = () => onLoad?.()
  const terrainStatus = document.createElement('p')
  terrainStatus.className = 'settings-status hidden'
  terrainStatus.setAttribute('role', 'status')
  terrainStatus.setAttribute('aria-live', 'polite')
  terrain.append(terrainAction, terrainStatus)
  body.appendChild(terrain)

  const route = createSection('路线与地图', '路线表达和常用地图图层保持即时同步。')
  const routeToggles = document.createElement('div')
  routeToggles.className = 'settings-toggle-list'
  for (const key of ['routeSlopeColors', 'routeArrows', 'routeTicks']) {
    routeToggles.appendChild(createRow(SETTING_LABELS[key], toggle(key, SETTING_LABELS[key])))
  }
  route.appendChild(routeToggles)
  const layerGrid = document.createElement('div')
  layerGrid.className = 'settings-layer-grid'
  for (const [key, label] of Object.entries(LAYER_LABELS)) {
    const item = document.createElement('label')
    item.className = 'settings-layer-item'
    item.append(toggle(key, label, layerControls), document.createTextNode(label))
    layerGrid.appendChild(item)
  }
  route.appendChild(layerGrid)
  body.appendChild(route)

  const display = createSection('基础显示', '调整画面明暗和雾效，不改变路线数据。')
  display.append(
    createRow(SETTING_LABELS.exposure, range('exposure', { min: .2, max: 3, step: .02 })),
    createRow(SETTING_LABELS.contrast, range('contrast', { min: -.2, max: .5, step: .01 })),
    createRow(SETTING_LABELS.saturation, range('saturation', { min: -1, max: 0, step: .02 })),
    createRow(SETTING_LABELS.fogNear, range('fogNear', { min: 5, max: 60, step: .5, digits: 1 })),
    createRow(SETTING_LABELS.fogFar, range('fogFar', { min: 15, max: 90, step: .5, digits: 1 })),
  )
  body.appendChild(display)

  const advanced = document.createElement('details')
  advanced.className = 'settings-advanced'
  const summary = document.createElement('summary')
  summary.innerHTML = `${iconSvg('settings')}<span><b>实验参数</b><small>材质、镜头、运动、Tour 与性能</small></span>`
  advanced.appendChild(summary)
  if (advancedEl) advanced.appendChild(advancedEl)
  body.appendChild(advanced)

  return {
    el,
    closeButton: close,
    sync({ params = {}, layers = {} } = {}) {
      for (const [key, control] of controls) {
        const value = params[key]
        if (value == null) continue
        if (control.input) {
          control.input.value = String(value)
          control.output.value = Number(value).toFixed(control.digits)
        } else if (control.type === 'checkbox') {
          control.checked = !!value
        } else if (document.activeElement !== control) {
          control.value = String(value)
        }
      }
      for (const [key, control] of layerControls) control.checked = !!layers[key]
    },
    setTerrainStatus(kind, text) {
      terrainAction.disabled = kind === 'loading'
      terrainAction.textContent = kind === 'loading' ? '正在加载地形…' : '加载当前地形'
      terrainStatus.classList.toggle('hidden', !text)
      terrainStatus.dataset.kind = kind || ''
      terrainStatus.textContent = text || ''
    },
  }
}
