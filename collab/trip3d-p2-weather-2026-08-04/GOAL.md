# GOAL — trip-3d P2 天气推演(基本功能)

## 最终目标
启用 🌦 天气 tab,实现「沿线路的天气推演」基本功能闭环:
- OpenMeteoProvider:Open-Meteo 预报 API(16 天,逐日),海拔订正,免 key,署名
- 天气面板:出发日期+行程天数选择 → 代表点(首/末/最高 3 点)逐日天气卡 + 出行天气指数
- 剖面浮卡叠加逐日晴雨色带(行程日轴)
- WeatherDay 数据模型带 source 字段('forecast'),为 P3 archive 回填预留

## 验收标准
1. `npm test` 全绿(36 既有 + 新增 provider/helpers/index 测试)
2. `npm run build` exit 0
3. E2E:天气 tab 可用;面板选日期查询出卡(真实 API 或网络不可用时优雅降级);指数显示;剖面卡晴雨色带渲染;无回归
4. 合规:页面带 Open-Meteo 署名;非商用定位不变

## 非目标
- archive 历史回填、行程状态机(P3)
- 分钟级降水/彩云/和风(P4)
- RainViewer 降水贴图、场景天气粒子(后续评估)
- 天气数据 IndexedDB 持久化(P3 随行程归档;本期内存+localStorage 面板状态)
- 每日空间分段色带(需行程日程模型,followups)

## 已确认决策
- 取样点:代表点 3 个(首/末/最高海拔,去重)
- 色带:按行程第 N 天铺(等宽列),出发日期在天气面板选择
- 天气卡:全部放 🌦 面板,规划面板不嵌
