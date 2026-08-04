# PLAN — trip-3d UI 交互改造

| # | 任务 | 验证 | 依赖 |
|---|---|---|---|
| U1 | 控制面初始化(collab 目录 GOAL/PLAN/STATE/CHECKPOINT) | 文件存在 | — |
| U2 | `src/ui/mode.js` 模式状态机 + TDD | mode.test.js 全绿 | U1 |
| U3 | `src/ui/chrome.js` 轨道/面板/toast/图层钮组件 + CSS | build exit 0(未被引用也可构建) | U2 |
| U4 | main.js 手术:删 fRoute folder、删旧 RouteHud 条、lil-gui 搬进设置抽屉、接 mode/rail/panels | build exit 0 + E2E 打点 | U3 |
| U5 | 规划面板/线路库面板/剖面浮卡(迁移 RouteHud 逻辑+折叠) | E2E 全链路 | U4 |
| U6 | 全量验收:test+build+E2E 截图 | GOAL 验收标准 1-4 | U5 |
| U7 | 收尾:commit、plan 文档记录、followups 更新 | git log | U6 |

## 关键实现决策
- **lil-gui 搬迁**:设置抽屉容器 `appendChild(gui.domElement)` + CSS 覆盖(position static,width 100%),不改 lil-gui 内部
- **图层钮**:按住 GUI 对应 controller 引用,圆钮调用 `controller.setValue(0|saved)`,复用既有 onChange 链路(uContourOpacity/uGridOpacity/labels.visible/hud2.setVisible)
- **mode 驱动**:`params.planning` 保留为打点监听检查的 flag,由 mode 状态机写入;删掉 lil-gui 里的 checkbox;ESC keydown 退出
- **面板更新钩子**:现有 `updateRouteHud(route, stats, pts)` 改名为 `updateRouteUI`,同步刷规划面板途经点列表+剖面卡
- **toast**:保存成功→toast+自动切📁;分享成功→toast

## 阻塞点
- 无外部凭证需求;无跨仓写入;单 repo 隔离实施
