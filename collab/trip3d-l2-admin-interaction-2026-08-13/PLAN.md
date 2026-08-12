# PLAN

1. TDD 提取行政 UI 状态纯函数与图层过滤策略。
2. 新建框架无关 DOM 组件：图层卡、模式条、详情卡、零边界状态。
3. 接入 L1 加载结果、层级筛选、当前行政链和缓存元数据。
4. 行政材质切为冷蓝；标签改为透明底 halo 风格。
5. 增加查看模式拾取：独立 raycast/click；普通模式不接管；Esc 退出。
6. 移动端 bottom sheet 与可访问性状态/键盘路径。
7. focused/full tests、build、浏览器四态 E2E、diff 审查。
8. REVIEW/STATE closeout、commit、push、Cloudflare 自动部署、生产资产核对。
