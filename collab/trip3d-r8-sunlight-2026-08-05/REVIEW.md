# REVIEW — R8 日照分析(2026-08-05)

## Codex review 状态
阻塞(usage limit 至 08-08,同 R6/R7 runbook 登记)。自检覆盖:
- 太阳算法真值对锁定(赤道春分/北京夏至冬至/夜间/方位 0-360 全域)
- 遮阴不用 mesh 射线(2M 三角形 O(n) 过慢),改 DEM 地平线步进(µs 级)
- 场景方位约定换算:太阳方位(北顺)→ placeSun 参数(az−90)
- 夜间/日落:elevation≤0 → 全遮阴 + 光强 5%(微光可读)
- 时区近似:round(lon/15)(中国 +8、美国西南 −7 均正确)

## 实现
- `sun.js`:sunPosition(NOAA 近似)/shadeFraction(注入式,TDD 6)
- ☀ 日照分析快捷开关 → 面板(日期+时间滑杆+方位/高度读数)
- applySun:真实太阳方位驱动 directional light + VSM 阴影;时间输入 180ms 防抖
- 逐段遮阴:legs 采样 ≤10 点/段,sunBlockedAt DEM 步进;行尾「· 遮阴 xx%」

## E2E 验收
| 项 | 结果 |
|---|---|
| 单元测试 | ✅ 149/149(sun 6) |
| 构建 | ✅ exit 0 |
| 上午 10:00 | 方位 113° 高度 53°(东南高空,正确);平地遮阴 0% |
| 傍晚 19:10 | 方位 291° 高度 0°(西北日落,正确);遮阴 100% |
| 光强联动 | 低日角自动衰减,夜间 5% 微光 |

## 过程修复
- patch 误删 osrmLegs 守卫(demKey)与 legs 兜底条件 → 当场恢复
- panels.js legs 变量名 r/row 不一致 → 修正
