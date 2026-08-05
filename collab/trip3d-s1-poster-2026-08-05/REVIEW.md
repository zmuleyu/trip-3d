# REVIEW — S1 海报卡+分享面板(2026-08-05)

## Codex review 状态
阻塞(usage limit 至 08-08,runbook 第 4 次登记)。自检覆盖:
- 截图可靠性:同帧 composer.render() 后同步 toDataURL,免 preserveDrawingBuffer(性能不降)
- QR 容量:分享链接(hash 短)远小于 amap 链接,M 级足够;M→L 降级链路复用
- 版式数学 TDD(layoutPoster 区块均在画布内、fitCrop cover 双向)
- 文案口径:无真实 legs 时标「示意」,不伪造精确(测试锁定)

## E2E 验收
| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 154/154(poster 5) |
| 构建 | ✅ exit 0 |
| 分享 tab | ✅ ↗ 启用;摘要行「8m(示意) · 4.6 km · ↑39m ↓76m · 3 点 · 1 天」;四出口+海报按钮 |
| 海报 PNG | ✅ blob 1.78MB,魔数 89 50 4E 47;视觉:标题/8m 大字号/统计行/QR+扫码提示/attribution 三段式版式清晰 |
| 二维码弹层 | showQrOverlay 抽取复用(amap/分享两路) |
