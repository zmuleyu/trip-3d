# PLAN — trip-3d P2 天气推演(基本功能)

| # | 任务 | 验证 | 依赖 |
|---|---|---|---|
| W1 | 控制面初始化 | 文件存在 | — |
| W2 | PLAN 文档 + Codex review 后台 | review 结论 | W1 |
| W3 | `src/providers/openmeteo.js` 实现(fixture TDD) | openmeteo.test.js 绿 | W1 |
| W4 | `src/lib/weather.js` helpers:代表点/晴雨规则/行程日 + TDD | weather.test.js 绿 | W3 |
| W5 | `src/lib/tripIndex.js` 出行指数算法 + TDD | tripIndex.test.js 绿 | W4 |
| W6 | `src/ui/weatherPanel.js` + main.js 接线(轨道启用/查询/卡片/错误态) | build + E2E | W3-5 |
| W7 | 剖面卡晴雨色带(profileCard 扩展 + 接线) | E2E 视觉 | W6 |
| W8 | review 发现回补 + 全量验收 + closeout | GOAL 标准 1-4 | W7 |

## 关键技术事实
- API: `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max&timezone=auto&start_date=&end_date=&elevation=`
- provider 构造注入 fetchImpl(测试用 fixture,生产用全局 fetch);接口对齐骨架 `daily(point, fromISO, toISO) → WeatherDay[]`
- WeatherDay: `{ date, point:{lon,lat,ele}, tempMax, tempMin, precipMm, weatherCode, windMax, source:'forecast' }`
- 晴雨规则: `precipMm >= 1 || weathercode ∈ [51..67, 71..77, 80..99]`
- 指数: 100 − min(60, precip*8) − min(20, max(0,wind−30)*1.5) − (tempMin<0 ? 10:0) − (code∈[95,99] ? 15:0),clamp [0,100]
- 色带: profileCard.update(stats, pts, weatherDays?) — weatherDays 存在时顶部铺等宽列(雨 #7ec8f7 / 非雨 #f0ead6)
- 面板状态(日期/天数)存 localStorage;WeatherDay 不持久化
- 查询为显式按钮触发(控制请求量);加载/错误/空线路三态

## 阻塞点
- 网络不可用环境(远程浏览器/离线)——面板必须优雅降级(错误提示,不崩)
