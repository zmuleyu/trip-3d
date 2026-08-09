# REVIEW — W1 天气深化(2026-08-05)

## Codex review 状态
阻塞(usage limit 至 08-08,第 7 次登记)。自检覆盖:
- archiveWindow 窗口边界 TDD(窗内 null/超窗去年/历史去年)
- archive 日期重映射:返回日期按序覆盖为用户行程日期(dates[i]),用户看到行程日非去年日
- 缓存键含指纹+日期+范围+source;LRU cap 20;LS 异常静默
- **范围调整:IDB 持久化 → localStorage(同键缓存)**。理由:单次查询 ~50 个 WeatherDay 小对象,LS 同步 API 足够;IDB 属过度工程
- bandColumns 分段 TDD(等宽/分数界/缺日灰显)
- 天数同步仅在计数变化时触发(用户手改不被覆盖)

## E2E 验收
| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 165/165(archiveWindow 3 + bandColumns 3) |
| 构建 | ✅ exit 0 |
| 档案回填 | ✅ 超窗(+30d)→「历史同期(去年 ERA5 参考)」,日期为行程日 09-08 |
| 天数联动 | ✅ 1 dayEnd → 天数输入自动 2 |
| 同日缓存 | ✅ 首查 ~9s 网络;复查明示 **4ms** 零请求;LS 键 1 |
| 面板守卫 | 旧「须在预报窗口内」拦截已放开(±395d),文案标注超窗行为 |

## 过程记录
- CDP Chrome 被用户两次关闭(桌面占用)→ 远端浏览器短交互完成缓存验证;archive 验证已在 CDP 通过
