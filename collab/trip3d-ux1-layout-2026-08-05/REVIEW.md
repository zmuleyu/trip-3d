# UX1 收尾(2026-08-05)

## 修复映射
| 项 | 修法 | 验证 |
|---|---|---|
| P0-1 日照×小地图重叠 | body.sun-open 时 overview 上移(bottom 196px) | ✅ CDP 复拍:上下独立排列 |
| P0-2 遥测压 rail | hud-brt left 34→62px | ✅ 间距清晰 |
| P0-3 面板透底 | .ui-panel 0.96 白+blur8 | ✅ 复拍无杂字 |
| P1-1 按钮分区 | 编辑行(撤销/重做/清空danger/反向/闭环)+主行(保存primary/导入GPX);分享/高德/导出GPX 迁分享 tab | ✅ 面板两行整齐 |
| P2-2 激活态 | layer-btn.on 橙底白图+阴影;基础微阴影 | ✅ 日照钮橙底 |

159/159 + build ✓。Codex review 阻塞同前(runbook)。
