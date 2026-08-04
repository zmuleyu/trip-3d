# CHECKPOINT — trip-3d UI 交互改造

**State**: IN_PROGRESS · U1 完成,U2 进行中
**恢复点**: 控制面已建(GOAL/PLAN/STATE 于本目录);基线 bd9a32b 全绿(32 tests + build)
**下一步**: U2 — `src/ui/mode.test.js`(RED)→ `src/ui/mode.js`(GREEN)→ commit
**设计事实**: 预览稿已获用户确认(dist/ui-mockup.html);方案=左轨道+飞出面板+设置抽屉+剖面浮卡+mode 状态机;lil-gui 整体进抽屉不重写;图层钮走 controller.setValue 复用 onChange 链
**Session**: 本主会话(单 writer)
