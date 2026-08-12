# GOAL — L1 maintenance + admin boundary cache + UX research

## 目标
依次完成：
1. 校正 UX3/L1 已完成控制面中的 HEAD/next_action 漂移。
2. 清理 `docs/followups.md` 中已经交付的事项。
3. 为 DataV 行政区划 GeoJSON 增加 IndexedDB 持久缓存，保持失败自动回退。
4. 检索热门同类产品，形成行政区划图层 UI/UX 与交互优化讨论稿；本 Goal 不直接实施 UI 改版。

## 验收
- UX3/L1 STATE 与真实 HEAD/状态一致。
- followups 不再包含 W1/W2/已完成项。
- 缓存具备 TDD：命中、过期、LRU、IDB 不可用回退；全量测试/build 绿。
- 研究稿有可验证来源、模式对比、适用于 trip-3d 的方案和待用户拍板选项。
- closeout、commit、push、生产部署核验完成。

## 非目标
- 境外 Natural Earth 图层实现。
- 未经用户确认直接修改行政区划 UI/视觉设计。
