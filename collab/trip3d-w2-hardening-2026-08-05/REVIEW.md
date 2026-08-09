# REVIEW — W2 工程稳健三件套(2026-08-05)

## Codex review 状态
阻塞(第 8 次登记)。自检:
- lz-string:z: 前缀区分新旧线格式;legacy base64url 兼容解码;ECU charset URL 安全(测试锁定);32 点长线路压缩率 <60%
- manualChunks:three 独立 chunk 493KB(可长缓存),app 391KB
- snap 加固:HTTP 400/413/414 触发分段模式;分段 4 路并行(原串行 ~n×300ms);段缓存复用;直线兜底 real:false 不缓存

## 实施期抓到的生产 bug(R5 回归)
**`history` 变量遮蔽 window.history**:R5 引入的撤销栈实例名 history 使 onShare 的 history.replaceState 抛 TypeError,分享链接自 R5 起静默失效(E2E 当时未覆盖该按钮)。修复:实例改名 routeHistory,History API 显式 window.history。E2E 复验通过(#r=z: 链接生成+toast)。

## E2E 验收
| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 167/167(share 9:压缩往返/legacy/ta 白名单等) |
| 构建 | ✅ exit 0;three chunk 拆分确认 |
| 压缩全链路 | ✅ 生成 #r=z: 链接(234 字符)→ 新开页 → 2 途经点还原+规划模式自动进入 |
| 回归修复 | ✅ 分享链接恢复工作 |
