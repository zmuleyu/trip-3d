# REVIEW — Codex review(P2 PLAN,2026-08-04)

结论:**REJECT(12 条)** → 全部处理,映射如下。处理后实施,W6-W7 落地后 E2E 通过。

| # | 问题 | 处理 |
|---|---|---|
| 1 | 三代表点聚合规则未定义 | `aggregateTripDays()` 安全导向「最差点」规则(max precip/wind,min tempMin,max code)+ 测试;tripIndex 按日最差点聚合 |
| 2 | 16 天窗口未落实为日期边界 | 面板 date input min/max = 本地今日 ~ 今日+15;越界拒绝查询并提示;timezone=auto 由 API 按目的地取日 |
| 3 | 天气状态无归属,旧线路残留 | `weatherState{fingerprint,requestId,result}`;`routeFingerprint()` 绑版本;updateRouteUI 指纹不符即清色带;requestId 防慢响应覆盖 |
| 4 | 旧式字段名 weathercode/windspeed_10m_max | 改官方名 `weather_code`/`wind_speed_10m_max`(请求、映射、fixture、断言全部同步) |
| 5 | API 错误形态/响应校验不足 | res.ok 检查、body.error 检查、daily 缺失检查、**数组等长校验**(新增 length mismatch 测试) |
| 6 | 工厂注入签名冲突 | KINDS 改零参工厂;open-meteo 注册;providers.test 更新(unknown kind + 注册形态两条) |
| 7 | weather panel 接线笼统 | showTab('weather') 分支;轨道启用(去 disabled/badge);route 经 getter 现场读取(runWeatherQuery 闭包) |
| 8 | 晴雨规则边界 | 显式 RAIN_CODES 集合;非有限/负值降水归一化为 0(新增 4 断言) |
| 9 | 指数单位/空值边界 | windMax 注释锁定 km/h(provider 默认单位);dailyIndex 空值防御(?? 0 / ?? 99);0°C 不扣分为有意(0 是冰点非严寒) |
| 10 | elevation 输入有效性 | provider 仅 Number.isFinite(ele) 时带 elevation 参数;代表点来自 route.waypoints(非稠密采样) |
| 11 | profileCard 第三参语义 | 明确定义:第三参传入=画色带,缺省=清色带;色带标注日期刻度明示「行程日轴」;每次 clearRect 全清 |
| 12 | 验收测试不够具体 | 新增:length mismatch、非有限降水、同日冲突聚合、指纹变化、0.9/1.0 边界;E2E 覆盖查询/失效/重查/三态 |

## E2E 验收(W8,2026-08-04)

| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 66/66 |
| 构建 | ✅ exit 0 |
| 天气 tab 启用 | ✅ 面板渲染(日期/天数/查询/署名) |
| 真实 API 查询 | ✅ 3 日卡(08-04 ☀ 24~38°C 0.0mm 风29)+指数「99 极佳,最差日 98」 |
| 代表点去重 | ✅ 3 途经点→2 代表点 |
| 色带渲染 | ✅ 行程日轴色带(canvas 像素验证 [239,234,214,179]) |
| 指纹失效 | ✅ 加第 4 点后色带 alpha=0 清除 |
| 失效后重查 | ✅ 重新绑定,色带恢复 |
| 视觉 | ✅ 面板/色带/轨道高亮/卡片全部确认(截图存档) |
