import { iconSvg } from './icons.js'

let popoverSequence = 0

export function createSearchPopover({ onSelect, onRole, onDismiss } = {}) {
  const el = document.createElement('section')
  el.className = 'ui-search-popover hidden'
  el.id = `ui-search-popover-${++popoverSequence}`
  el.setAttribute('aria-label', '地点搜索结果')

  const dismiss = document.createElement('button')
  dismiss.type = 'button'
  dismiss.className = 'ui-search-popover-close'
  dismiss.setAttribute('aria-label', '关闭地点搜索结果')
  dismiss.innerHTML = iconSvg('close')
  dismiss.addEventListener('click', () => onDismiss?.())

  const body = document.createElement('div')
  body.className = 'ui-search-popover-body'
  el.append(dismiss, body)

  const focusables = () => [...el.querySelectorAll('button:not(:disabled)')]
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onDismiss?.({ restoreFocus: true })
      return
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const items = focusables()
    const current = items.indexOf(document.activeElement)
    if (!items.length || current < 0) return
    event.preventDefault()
    items[(current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus()
  })

  const status = (message, kind = '') => {
    const copy = document.createElement('p')
    copy.className = `ui-search-popover-status ${kind}`.trim()
    copy.setAttribute('role', kind === 'is-error' ? 'alert' : 'status')
    copy.textContent = message
    body.appendChild(copy)
  }

  return {
    el,
    update(session = {}) {
      const open = session.state && session.state !== 'idle'
      el.classList.toggle('hidden', !open)
      el.setAttribute('aria-busy', String(session.state === 'searching'))
      body.replaceChildren()
      if (!open) return
      if (session.state === 'searching' || session.state === 'empty' || session.state === 'error') {
        status(session.message ?? '搜索地点、线路或营地', session.state === 'error' ? 'is-error' : '')
        return
      }
      if (session.state === 'place-selection' && session.selected) {
        const place = session.selected
        const placeCopy = document.createElement('div')
        placeCopy.className = 'ui-search-place-copy'
        const name = document.createElement('b')
        name.textContent = place.name
        const detail = document.createElement('span')
        detail.textContent = [place.context, place.category].filter(Boolean).join(' · ')
        placeCopy.append(name, detail)
        const actions = document.createElement('div')
        actions.className = 'ui-search-place-actions'
        for (const [role, label, primary] of [
          ['start', '设为起点', true], ['end', '设为终点', false], ['via', '添加途经点', false], ['view', '仅查看', false],
        ]) {
          const button = document.createElement('button')
          button.type = 'button'
          button.textContent = label
          button.classList.toggle('primary', primary)
          button.addEventListener('click', () => onRole?.(role))
          actions.appendChild(button)
        }
        body.append(placeCopy, actions)
        const attribution = document.createElement('small')
        attribution.className = 'ui-search-attribution'
        attribution.textContent = '© OpenStreetMap contributors'
        body.appendChild(attribution)
        return
      }
      if (session.state === 'results') {
        status(session.message ?? `找到 ${session.results?.length ?? 0} 个地点`)
        const list = document.createElement('div')
        list.className = 'ui-search-results'
        for (const place of session.results ?? []) {
          const row = document.createElement('button')
          row.type = 'button'
          row.className = 'ui-search-result'
          row.dataset.searchResult = ''
          const copy = document.createElement('span')
          const name = document.createElement('b')
          name.textContent = place.name
          const context = document.createElement('span')
          context.textContent = place.context
          copy.append(name, context)
          const category = document.createElement('small')
          category.textContent = place.category
          row.append(copy, category)
          row.addEventListener('click', () => onSelect?.(place))
          list.appendChild(row)
        }
        body.appendChild(list)
        const attribution = document.createElement('small')
        attribution.className = 'ui-search-attribution'
        attribution.textContent = '© OpenStreetMap contributors'
        body.appendChild(attribution)
      }
    },
    focusFirstResult() { el.querySelector('[data-search-result]')?.focus() },
  }
}
