# REVIEW — L1 行政区划图层(2026-08-09)

## Codex review 状态
阻塞(第 10 次登记)。自检:
- DataV 层级结构:省 outline({ad}.json)/省级 _full=市级/市级 _full=县级——按需三层下钻
- clipRingToBbox:S-H 裁剪 + **包含判定**(pointInRing 中心→环全包视口返回 null,否则退化成整幅矩形框)
- 标签锚点=裁剪后环中点(原始 centroid 常飞在视口外)
- 境外降级:Nominatim reverse→provinceAdcode null→toast+按钮回弹
- demKey 代际契约:加载中途切地形丢弃(key 校验 ×2)

## E2E 验收(远端浏览器实测)
| 项 | 结果 |
|---|---|
| 单元 | ✅ 176/176(adminBoundaries 9:adcode 表/extract/裁剪/包含/crossing) |
| 境外路径 | ✅ 纪念碑谷→「境外区域暂未接入」+按钮回弹 |
| z12 乌兰哈达 | ✅ 零段(视口完全在察哈尔右翼后旗内,地理正确) |
| z10 乌兰哈达 | ✅ 7 段渲染(省界实线+市/县虚线)+7 标签;橙色像素 1309 证据 |
| 管线实测 | adcode 150000→乌兰察布市 150900 下钻→11 县→clip 保 5 县(商都/察右后/察右中/四子王/兴和) |

## 范围记录
境外(Natural Earth)未接入 → followups;IDB 缓存未做(会话内内存缓存足够,YAGNI)。
