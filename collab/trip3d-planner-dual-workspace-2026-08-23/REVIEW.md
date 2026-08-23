# REVIEW — 2D 精确规划 + 3D 地形预览生产实施

## 变更

- 路线模式升级为一等字段：`straight | foot | car`；线路库、分享、历史撤销/重做保持一致。
- 直线模式不再用驾车 40km/h 启发式冒充总时长；混合/失败路段显示路网覆盖比例，直线回退段不计时。
- 2D OSM 规划工作区支持直接点击加点；右侧 3D 预览以 5fps 同步 WebGL 画布，可切回全屏 3D。
- DEM 超覆盖时停止高程、坡度、爬升和剖面，保留可信测地距离；3×3 fit 不足时回退 5×5，仍过宽则明确要求拆分线路。
- DEM 加载改为 latest-request-wins，实际 `dem` 作为缓存键来源；并发位置切换不会让旧请求覆盖新请求。
- 桌面 2D/3D 宽度约 74/26；移动端使用 bottom sheet + bottom nav，地图持续可见。
- 设置抽屉关闭时 `inert + aria-hidden`；天气/分享不继承规划折叠态；输入可访问名称与 chevron `aria-expanded` 完整。

## TDD / 门禁

- `npm test`：37 个测试文件，最终 233 项测试全绿。
- `npm run build`：Vite 构建成功。
- `git diff --check`：通过。
- 静态安全扫描：无硬编码 secret/token、eval/new Function/document.write。
- 独立最终评审：通过；security、logic、UI actionable findings 均为空。

## CDP E2E

- 桌面 1440×1000：2D 主工作区 690px、3D 预览 375px；步行路网 1/1 段，可信时长与高程可见。
- 移动 390×844：无横向溢出；bottom sheet/nav 正确；所有可见规划控件和展开后的高德导入控件均 ≥44px。
- 超覆盖：57.7km 距离保留，高程/剖面隐藏；扩展后 Z10 3×3 DEM 覆盖恢复。
- DEM 并发：Grand Canyon 请求后立即发 Mount Fuji 请求，最终仅 Fuji 提交（requestId 1→3，terrainGen 1→2）。
- 模式撤销：400ms 路由 debounce 前立即撤销，route.mode、snap on/profile、按钮同步恢复 foot。
- 设置：关闭时 lil-gui 控件退出 AX 树；打开可见，Escape 后恢复 inert。
- 天气/分享：从规划切换后默认展开。

## 生产验收

- URL：`https://trip-3d.pages.dev/`
- JS：`assets/index-CC9ji_d0.js`
- CSS：`assets/index-i5EfTseN.css`
- JS SHA256：`f2b48b96f7e829fd940f2b8e6fd5432d7f504bae5046873f9f4997d15438dcf2`
- CSS SHA256：`e0e810cc3df589e9059622ff0c60546641ea0cbdb5d9ff89104e05b1af3b0e91`
- 生产下载与本地 dist 逐字节一致。
- 生产桌面、移动和超覆盖三条路径实驾均 0 JS 错误。

## 已知边界

- 步行/驾车仍依赖公共 FOSSGIS OSRM，无 SLA；重度公开使用应自托管。
- 跨全球/日期变更线且超出 Z8 5×5 容量的路线不会伪装覆盖，界面要求拆分线路。
