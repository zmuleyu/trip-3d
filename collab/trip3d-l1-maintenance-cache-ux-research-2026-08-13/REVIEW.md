# REVIEW — L1 maintenance + cache + UX research

## 变更审查

- UX3/L1 旧 STATE 的 `head` 与 `next_action` 已与历史真实提交校正。
- followups 删除 7 项已交付内容：ERA5、天气缓存、天气空间分段、分享压缩、TooBig 防御、Three manualChunks、区划 IDB 缓存。
- `adminBoundaryCache.js`：原生 IndexedDB、URL key、TTL 30 天、LRU 48 条、同 URL in-flight 去重；IDB 不可用/读写失败自动降级，不改变网络错误可见性。
- DataV 的省 outline、省 `_full`、市 `_full` 三类请求全部接入缓存；Nominatim reverse 保持即时请求。
- UI/UX 研究只形成讨论稿，没有修改产品 UI。

## 验证

- RED：缓存模块不存在，focused suite import fail。
- GREEN：缓存测试 5/5；全量 181/181（27 files）；Vite build 成功。
- 浏览器 E2E：乌兰哈达 z10 首次加载后 IDB 写入 3 个 DataV URL；页面重载后 DataV fetch 计数 0，仍渲染 7 段边界，按钮 active。
- `git diff --check` 通过。

## 研究证据

浏览器直读 Google Maps Platform、Mapbox Boundaries、高德 DistrictLayer、CesiumJS 官方文档。Web search/web extract 后端当次未配置或 DNS 判定失败，已在研究稿中明确，不使用二手摘要替代官方证据。

## 风险

- 30 天 TTL 到期后必须联网刷新；尚未实现 stale-while-revalidate。
- 当前缓存仅 DataV 中国区划；境外 Natural Earth 仍是 followup。
- UI 推荐方案需要用户拍板后另开 UI Goal。
