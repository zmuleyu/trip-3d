# GOAL — R1 amap 链接互操作(导入/导出/二维码)

## 最终目标
1. **GCJ-02 转换模块**:gcj02ToWgs84 / wgs84ToGcj02,境外直通,TDD(真值对锁定)
2. **amap 链接解析**:parseAmapLink(/ssr/dir 格式)→ {from, vias[], to},TDD(用户乌兰哈达真实链接为 fixture)
3. **导入 UI**:规划面板「导入链接」→ 粘贴 → 转换 → 带名途经点入列(界外自动载 DEM 流程复用 searchAdd 链路)
4. **导出**:route → buildAmapLink(WGS→GCJ)→ 剪贴板 + 二维码(qrcode-generator,~20KB)
5. E2E:导入乌兰哈达链接(6 点带名)→ 吸附 → 导出链接坐标抽查

## 非目标
其他分享格式(小程序/二维码识别)、amap API(key 系,占位不变)、布局重构(R2)

## 决策(已确认)
- GCJ-02 公开算法,米级误差可接受;境外点直通不转
- 导出 type=0(驾车,高德自行重路由;点位是本体)
- 二维码 qrcode-generator(kazuhikoarase,MIT)npm 依赖
