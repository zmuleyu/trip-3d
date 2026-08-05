# REVIEW — S2 飞越视频(2026-08-05)

## Codex review 状态
阻塞(usage limit 至 08-08,第 5 次登记)。自检覆盖:
- 相机路径:弧长重采样 TDD(等距/端点/退化);look-ahead 末端 clamp;高度=地形+2.6,前视点+0.35
- 时长口径:里程/400m/s,clamp 12-60s(TDD)
- 录制仲裁:flyState.active 最高优先级(tick 中压过 tour/tween/controls);开始时 tour/tween 强制停、controls.enabled=false;结束/取消恢复前一帧相机
- 取消语义:discard 不落盘;onstop 仅 finish 时打包下载
- 兼容:MediaRecorder 缺失/vp9 不支持→vp8 回退;6Mbps
- 已知边界:录制中编辑路线不中断(path 取开始时刻快照),v1 可接受

## E2E 验收(本地 CDP Chrome,远端 Browserbase 掉线替代)
| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 159/159(flyover 5) |
| 构建 | ✅ exit 0 |
| 录制闭环 | ✅ 3 点→分享 tab→录制:overlay 进度可见,12s 完成,webm 8.16MB,EBML 魔数 1A45DFA3 ✓ |
| 远端浏览器教训 | Browserbase 会话反复掉 about:blank;改本地 CDP Chrome(9222)驱动,DEM 就绪需等 __exp.dem(不只 __exp) |
