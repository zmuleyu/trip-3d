# REVIEW — Codex review(R2 面板重构,2026-08-04)

结论:**REJECT(P0-P2)** → 全部处理。

| # | 问题 | 处理 |
|---|---|---|
| P0/P1 | 裸 revision 绑定:不同线路 revision 碰撞可继承旧吸附几何 | **snapVersion() = `${route.id}:${route.geometryRevision}`**;几何绑定含身份 |
| P1 | 未吸附分段直线 haversine,与渲染样条/总计口径不一 | **computeLegsFromPts**:沿实际渲染几何(采样点 cumDistM/ele 子段)分段,与 routeStats 同源 |
| P1 | SnapResult 原子性/legs 对齐契约 | snapFetch 返回 `{geometry, legs}` 原子对象;分段 fallback 混合 legs(成功段真实+失败段计算);normalizeOsrmLegs 数量不符 → null 回退 |
| P2 | 重命名触发吸附失效+OSRM 重取+跳变 | **双 revision**:geometryRevision 仅几何变更自增;rename 只 bump revision;吸附/天气分别绑定 |
| P2 | mutation helpers 无边界 | remove/moveWaypoint 边界校验,非法 no-op 不 bump;测试锁定 |

## 实施期 E2E 抓到的新问题

| 问题 | 修法 |
|---|---|
| 重命名 Enter+blur 双提交(rev 跳 2) | done 标志防重入 |
| 摘要卡大号时长(启发式)与逐段(真实 OSRM)口径冲突 | 全真实 legs 时大号=ΣdurationS,声明文案区分「路网时长/示意」 |
| LS 持久化使 snap 开关跨会话残留,验收差点误判 | 验收记录明确(非 bug,但写入 E2E 注意事项) |

## E2E 验收(2026-08-04,dev)

| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 122/122(含 guards/geometryRevision/computeLegsFromPts 契约) |
| 构建 | ✅ exit 0 |
| 时间轴 | ✅ 🟢起/⚪经/🔴终+竖线;删除 P2 后 2 点变 start/end |
| 行内操作 | ✅ 下移(P2,P1,P3)、重命名「中点营地」、删除全部生效 |
| 摘要卡 | ✅ 大号 2h53m(全真实时=Σlegs);声明「路网时长,非导航」 |
| 逐段 | ✅ 未吸附=沿样条计算;吸附=「6.3km 1h38m (路网)」真实 OSRM |
| **rename 稳定性** | ✅ rev 3→4、geoRev 不变、吸附显示与 2h53m 不跳变 |
| 视觉 | ✅ 高德式层级(搜索→时间轴→摘要卡→详情→按钮行) |
