# REVIEW — Codex review(搜索+吸附 PLAN,2026-08-04)

结论:**REJECT(8 条)** → 全部处理。本轮价值极高,两条 Critical 都是「先实施后必然返工」级。

| # | 问题 | 处理 |
|---|---|---|
| C1 | Nominatim 防抖下拉=官方明令禁止的 autocomplete;1req/s 为全应用全局 | 改**显式触发**(搜索按钮/Enter,无防抖自动搜);客户端 1.1s 节流;结果区常驻 `© OpenStreetMap contributors`;photon 作 fallback |
| C2 | OSRM 官方 demo `/foot/` 实为驾车图(实测 25km/h 暴露) | 换 **FOSSGIS routing.openstreetmap.de/routed-foot**(浏览器实测 17.3km/13847s≈4.5km/h,真步行图,CORS 通);provider 注释固化证据 |
| H3 | routeFingerprint 低精度(4 位+加权和)会碰撞,不能承担几何提交 | 引入 **route.revision**(每次变更自增,无碰撞);吸附/天气全部改绑 revision;fingerprint 保留但不再用于异步提交 |
| H4 | loadRealTerrain 无「重建完成」契约,busy 静默 return | **whenTerrainBuilt(gen) 代际契约**:loadRealTerrain 起始 terrainGen++,rebuild 完成回调统一 resolve;界外打点/飞达全程 gen 比较防串线 |
| H5 | 分段 Promise 缓存永久缓存失败、key 缺语义 | **成功才入缓存**;在途 dedup 与结果缓存分离;key 含 provider+profile+方向;单段失败降级直线且**不写缓存** |
| M6 | 31 段并发与 1req/s 冲突 | 改**整线路单请求**(≤32 坐标);NoRoute 时才逐段顺序 fallback;400ms 编辑防抖 |
| M7 | samplePolyline 契约未锁 | nSamples<2 throw、端点保留、退化输入、与 sampleRoutePath 同构,全部入测试;统计口径=采样几何 cumDistM(单一事实源) |
| M8 | pathPts 缓存 world 坐标会绑死旧 geo | 缓存 **WGS-84 geometry**;refreshRoute 每次用当前 getter 重采样;demKey 绑定防跨区域复用 |

## 实施期 E2E 抓到的新 bug(review 之外)

| 问题 | 定位 | 修法 |
|---|---|---|
| 界外加点静默失败 | `lonLatToWorld` 未导入 main.js(async 函数内 ReferenceError → unhandled rejection 无迹) | 补导入;E2E 复验通过 |

## E2E 验收(G8,2026-08-04)

| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 92/92 |
| 构建 | ✅ exit 0 |
| 搜索 | ✅ 「四姑娘山」→ 四姑娘山镇(真实 Nominatim,署名常驻) |
| 界外打点 | ✅ 自动加载四川 DEM → 途经点「四姑娘山镇 3158m」落位 |
| 路网吸附 | ✅ 已吸附(582 点);22.6km 真实里程(↑3022m ↓2079m 最高 4554m);视觉确认沿山谷蜿蜒 |
| 多点天气 | ✅ 全部途经点模式:3 点逐日卡(四姑娘山镇 🌦5.4 / P2 🌧1.4 / P3 🌧1.4);指数 26 较差(雨季合理) |
| 无回归 | ✅ 打点/撤销/规划面板/剖面均正常 |
