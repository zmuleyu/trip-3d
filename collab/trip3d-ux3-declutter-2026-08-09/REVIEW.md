# REVIEW — UX3 视觉降噪(2026-08-09)

## Codex review 状态
阻塞(第 9 次登记)。自检:
- panelHost 重构:头部三件套(title/summary/chev)持久化,show() 只换 body——折叠状态跨 tab 保留
- focus-mode 在 tick 每帧 toggle(classList.toggle 无变化时零成本),单点控制不遗漏
- POI 门控阈值 34(世界单位):宽景自动清爽;近景检查不受影响
- 遥测=planning-only:mode.onChange 单点驱动

## E2E 验收(远端浏览器实测)
| 项 | 结果 |
|---|---|
| 单元/全量 | ✅ 167/167 + build ✓ |
| 面板折叠 | ✅ chev 切换 body 显隐;header 摘要实时(未命名线路 · 2.1km · 2点) |
| 自动折叠/展开 | 进规划展开、离规划收起(showTab 接线) |
| 焦点模式 | ✅ start tour → focus-mode+面板 opacity 0;stop → 恢复 opacity 1 |
| 遥测规则 | 规划 tab 显示,其余隐藏(mode.onChange) |
| POI 降权 | 路线存在时 tag 0.45;远距(>34)自动隐藏 |
