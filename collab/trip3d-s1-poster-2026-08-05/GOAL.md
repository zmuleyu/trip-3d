# GOAL — S1 分享闭环第一波:海报卡 + 分享面板

## 最终目标
↗ 分享 tab 从占位变实:
1. **分享面板**:线路摘要(名称/时长/里程/爬升/天气指数)+ 聚合出口(复制链接/二维码/导出GPX/高德链接,复用既有动作)+ 两个导出按钮(海报卡 PNG / 飞越视频 S2 占位 disabled)
2. **海报卡 PNG**:1080×1350(4:5)——同帧 composer.render() 后同步 toDataURL 截 3D 图 → 合成:截图裁切填充 + 顶部/底部渐变蒙版 + 线路名大字 + 统计行(时长/里程/↑↓/最高/天气指数)+ 迷你天气色带(有结果时)+ 分享链接 QR + 数据 attribution
3. **装配纯函数 TDD**:buildPosterData(route, stats, legs, wx) → 文案/数值格式化;layoutPoster(W,H) → 各区块坐标;文本截断规则
4. 下载:a[download] 触发,E2E 验证 blob 字节为 PNG 头

## 非目标
多模板/竖横多尺寸、视频(S2)、OG meta、海报内嵌 inset 地图

## 验收
- TDD 全绿(buildPosterData/layoutPoster)
- E2E:乌兰哈达环线 → 海报下载,PNG magic bytes ✓;面板四出口可用
- build ✓;closeout+发布(Codex review 阻塞期:自检+runbook)
