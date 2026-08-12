// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAdminBoundaryUI } from './adminPanel.js'

beforeEach(() => { document.body.replaceChildren() })

describe('admin boundary panel', () => {
  it('renders current area, level, segment count and cache source', () => {
    const ui = createAdminBoundaryUI()
    ui.update({ enabled: true, breadcrumb: ['内蒙古自治区', '乌兰察布市', '察哈尔右翼后旗'], level: 'auto', segmentCount: 7, cacheStatus: '已缓存' })
    expect(ui.el.textContent).toContain('内蒙古自治区 › 乌兰察布市 › 察哈尔右翼后旗')
    expect(ui.el.textContent).toContain('县级 · 7 段')
    expect(ui.el.textContent).toContain('已缓存')
    expect(ui.el.getAttribute('aria-hidden')).toBe('false')
  })

  it('emits level and inspect actions through native buttons', () => {
    const onLevel = vi.fn()
    const onInspect = vi.fn()
    const ui = createAdminBoundaryUI({ onLevel, onInspect })
    ui.el.querySelector('[data-level="district"]').click()
    ui.el.querySelector('[data-action="inspect"]').click()
    expect(onLevel).toHaveBeenCalledWith('district')
    expect(onInspect).toHaveBeenCalledOnce()
  })

  it('shows a persistent zero-boundary explanation and inspect mode bar', () => {
    const ui = createAdminBoundaryUI()
    ui.update({ enabled: true, breadcrumb: ['察哈尔右翼后旗'], segmentCount: 0, emptyMessage: '当前视图完全位于察哈尔右翼后旗内；缩小地图可查看边界。', inspecting: true })
    expect(ui.empty.textContent).toContain('当前视图完全位于察哈尔右翼后旗内')
    expect(ui.empty.classList.contains('hidden')).toBe(false)
    expect(ui.modebar.classList.contains('hidden')).toBe(false)
    expect(ui.modebar.textContent).toContain('ESC 退出')
  })

  it('uses a dialog-like bottom sheet on narrow screens', () => {
    const ui = createAdminBoundaryUI()
    expect(ui.el.classList.contains('admin-panel')).toBe(true)
    expect(ui.el.querySelector('[data-action="inspect"]').tagName).toBe('BUTTON')
    expect(ui.el.querySelector('[data-action="inspect"]').getAttribute('type')).toBe('button')
  })
})
