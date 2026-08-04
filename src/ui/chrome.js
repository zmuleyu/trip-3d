// UI chrome: left icon rail, flyout panel, layer buttons, toast.
// Framework-free DOM components matching the mockup (dist/ui-mockup.html).
// Style lives in src/style.css (.ui-*).

// ---------------------------------------------------------------- rail
// items: [{ id, icon, label, badge?, disabled?, onSelect(id) }]
// settingsItem: { id, icon, label, onSelect(id) } pinned to bottom
export function createRail({ items, settingsItem }) {
  const el = document.createElement('nav')
  el.className = 'ui-rail'
  const logo = document.createElement('div')
  logo.className = 'ui-rail-logo'
  logo.textContent = 'T3'
  el.appendChild(logo)

  const btns = new Map()
  const mkBtn = (item, extraClass = '') => {
    const b = document.createElement('button')
    b.className = `ui-rail-btn ${extraClass}`.trim()
    b.dataset.tab = item.id
    b.innerHTML = `<span class="ico">${item.icon}</span><span class="lbl">${item.label}</span>`
    if (item.badge) {
      const badge = document.createElement('span')
      badge.className = 'ui-rail-badge'
      badge.textContent = item.badge
      b.appendChild(badge)
    }
    if (item.disabled) b.classList.add('disabled')
    b.onclick = () => { if (!item.disabled) item.onSelect(item.id) }
    btns.set(item.id, b)
    return b
  }
  for (const it of items) el.appendChild(mkBtn(it))
  const spacer = document.createElement('div')
  spacer.className = 'ui-rail-spacer'
  el.appendChild(spacer)
  if (settingsItem) el.appendChild(mkBtn(settingsItem, 'ui-rail-gear'))

  document.body.appendChild(el)
  return {
    el,
    setActive(id) {
      for (const [k, b] of btns) b.classList.toggle('active', k === id)
    },
    clearActive() {
      for (const b of btns.values()) b.classList.remove('active')
    },
  }
}

// ---------------------------------------------------------------- flyout panel
// One panel host; content swapped per tab. Returns host + mount API.
export function createPanelHost() {
  const el = document.createElement('section')
  el.className = 'ui-panel hidden'
  document.body.appendChild(el)
  let currentId = null
  return {
    el,
    get currentId() { return currentId },
    show(id, title, hint, contentEl) {
      currentId = id
      el.replaceChildren()
      const h = document.createElement('h2')
      h.textContent = title
      if (hint) {
        const s = document.createElement('span')
        s.className = 'ui-panel-hint'
        s.textContent = hint
        h.appendChild(s)
      }
      el.appendChild(h)
      el.appendChild(contentEl)
      el.classList.remove('hidden')
    },
    hide() {
      currentId = null
      el.classList.add('hidden')
    },
  }
}

// ---------------------------------------------------------------- layer buttons
// buttons: [{ id, icon, tip, initial, onToggle(id, on) }] → circular toggles, top-right
export function createLayerButtons({ buttons }) {
  const el = document.createElement('div')
  el.className = 'ui-layers'
  const map = new Map()
  for (const b of buttons) {
    const btn = document.createElement('button')
    btn.className = 'ui-layer-btn'
    btn.textContent = b.icon
    btn.dataset.id = b.id
    const tip = document.createElement('span')
    tip.className = 'ui-layer-tip'
    tip.textContent = b.tip
    btn.appendChild(tip)
    let on = !!b.initial
    btn.classList.toggle('on', on)
    btn.onclick = () => {
      on = !on
      btn.classList.toggle('on', on)
      b.onToggle(b.id, on)
    }
    map.set(b.id, { btn, isOn: () => on, set(v) { on = v; btn.classList.toggle('on', v) } })
    el.appendChild(btn)
  }
  document.body.appendChild(el)
  return { el, get: (id) => map.get(id) }
}

// ---------------------------------------------------------------- toast
export function createToast() {
  const el = document.createElement('div')
  el.className = 'ui-toast hidden'
  document.body.appendChild(el)
  let timer = null
  return {
    show(text, ms = 2200) {
      el.textContent = text
      el.classList.remove('hidden')
      clearTimeout(timer)
      timer = setTimeout(() => el.classList.add('hidden'), ms)
    },
  }
}
