# REVIEW — 2D 精确规划 + 3D 地形预览 Mockup

## 交付

- `docs/mockups/planner-dual-workspace-option-b-2026-08-23.html`
- `docs/mockups/assets/trip3d-route-clean-2026-08-23.png`（生产 WebGL 路线画布）
- `desktop-mockup.png`、`coverage-mockup.png`、`mobile-mockup.png`（浏览器实截图）

## 设计结果

1. 桌面主态保持 Explore：3D 地形主视觉 + 最近路线摘要，默认不堆操作面板。
2. 路线规划进入 Operate：左侧行程与交通模式、中央 2D 精确规划、右侧同步 3D 预览、底部统一分析托盘。
3. 超覆盖态阻断伪精确统计：路线越出 DEM 后，高程/坡度/爬升隐藏或停用，并提供“扩展地形范围”恢复动作。
4. 移动端使用 bottom sheet + bottom nav，地图保留约半屏，图层和视图开关不与 sheet 重叠。
5. 视觉沿用纸张白、深墨与唯一橙色路线主视觉；正文使用可读 sans，坐标/指标才使用 mono。

## 验证

- 1440×1000：桌面规划与超覆盖态无横向溢出。
- 390×844：移动端无横向溢出；所有 mobile button ≥44px。
- 键盘：1–4 切换状态，Escape 返回主态。
- 2D/3D 视图切换、路线模式、分析 tab 可点击。
- prefers-reduced-motion=reduce 时动画名为 none。
- Accessibility tree：0 个无名称 button/textbox。
- 浏览器捕获：0 `error` / `unhandledrejection`。

## Slop 自检

0/10：没有技术渐变、等权 feature cards、玻璃拟态、中心 hero 或错误 surface；纹理与斜线仅用于真实地形和 DEM 超覆盖语义。

## 边界

- 这是拍板 mockup，不是生产实现；`src/` 未修改。
- 路由 provider、路线数据模型、DEM 自动扩展与分享几何仍需后续实施 Goal。
