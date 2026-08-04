# GOAL — trip-3d 部署 Cloudflare Pages

## 最终目标
trip-3d 上线 CF Pages(trip-3d.pages.dev),生产环境全链路 E2E 通过。

## 任务
| # | 任务 | 验证 |
|---|---|---|
| D1 | 署名脚注(OSM/FOSSGIS/Open-Meteo/Mapzen,合规硬要求) | 页面可见 |
| D2 | build 验证 + wrangler pages deploy | 生产 URL 200 |
| D3 | 生产 E2E:打点/搜索/吸附/天气/分享复原 | 全通过 |
| D4 | closeout(STATE/followups/README badge) | commit+push |

## 约束
- 自动构建(Git 集成)为增强项,本期可先直接部署(Wrangler),集成后置
- 失败回滚:删 Pages 项目即可,仓库不受影响
