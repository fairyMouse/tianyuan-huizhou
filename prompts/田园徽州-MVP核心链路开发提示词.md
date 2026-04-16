# 任务：实现田园徽州 MVP 核心链路

## 范围（只做这些，不要扩展）

实现一个最小可用的端到端流程：

```
首页 → 上传照片 → 选择品类 → 生成中 → 结果页
```

**砍掉的部分**（后续迭代）：

- 风格模板选择
- 产品信息表单
- 文案生成（结果页只展示一张合成主图）
- 品牌一致性认证模块
- 历史记录

**核心目标**：让一个农户能在小程序里上传一张产品照片，30 秒内得到一张带徽派背景的品牌化主图。

---

## 页面详细设计

### 1. 首页 (pages/index/index.tsx)

**视觉**：

- 顶部 60% 高度：宣纸米白背景 + 中央显示"田园徽州 · AI"宋体标题（text-display） + 副标题"为黟县农户的产品，赋予品牌的力量"（text-subtitle, text-ink-light）
- 中部装饰：一个简化的水墨远山 SVG（横跨屏幕，opacity 60%）
- 底部 30% 高度：朱砂红主按钮"开始打造产品品牌"，带印章感（圆角较小，配宋体字）
- 按钮下方小字（text-caption, text-ink-mute）："仅需一张照片，5 秒生成"

**交互**：

- 点击主按钮 → 跳转到 `pages/upload`

### 2. 上传页 (pages/upload/index.tsx)

**视觉**：

- 顶部标题（text-headline, font-serif）："上传产品照片"
- 副文（text-body, text-ink-light）："建议在自然光下拍摄，背景简洁更佳"
- 中部：一个虚线边框的大上传区（占屏幕高度 40%），中央显示相机图标 + "点击拍照或从相册选择"
- 已上传时：替换为图片预览，右上角小图标"重新选择"
- 底部：朱砂红主按钮"下一步"，未上传时禁用（opacity 0.4）

**交互**：

- 点击上传区 → 调用 `Taro.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] })`
- 选择后图片存入 projectStore 的 `productImage`
- 点击下一步 → 跳转到 `pages/category`

### 3. 品类选择页 (pages/category/index.tsx)

**视觉**：

- 顶部标题"这是什么产品？"
- 副文"选择最接近的品类，让 AI 更懂你的产品"
- 主体：2 列网格展示 10 个品类卡片
  - 每张卡片：宣纸深背景 (`bg-paper-deep`) + 圆角 12rpx + 居中文字（品类名，宋体，text-subtitle）
  - 选中态：边框变朱砂红 (`border-2 border-cinnabar`) + 文字加粗
- 底部：朱砂红主按钮"开始生成"（fixed 在屏幕底部）

**交互**：

- 点击品类 → 选中态切换，存入 projectStore 的 `category`
- 点击"开始生成" → 跳转到 `pages/generating`

### 4. 生成中页 (pages/generating/index.tsx)

**视觉**：

- 全屏宣纸米白背景
- 中央：一个慢速旋转的徽派窗格 SVG（旋转动画 8s 一圈，体现"克制"）
- 下方文字（text-title, font-serif）："正在为您的产品赋予徽韵"
- 进度提示文字（text-body, text-ink-mute），每 5 秒切换一次：
  - "正在解析产品轮廓..."
  - "正在调和徽州色彩..."
  - "正在合成品牌画面..."
  - "即将完成..."

**交互**：

- 进入页面立即触发 `services/api.ts` 的 `generateImage()` 函数
- 成功后 `Taro.redirectTo` 到 `pages/result`，结果存入 projectStore 的 `resultImage`
- 失败时显示错误并提供"返回重试"按钮

### 5. 结果页 (pages/result/index.tsx)

**视觉**：

- 顶部标题"为您生成的品牌主图"
- 主体：居中展示生成的图片（宽度 686rpx，1:1 比例），带细边框和轻微阴影
- 图片下方两行文字：
  - "✓ 已应用「田园徽州」品牌规范" (text-jade, text-body)
  - 品类名称 (text-ink-mute, text-caption)
- 底部两个按钮（横向并列）：
  - 次要按钮"重新生成"（徽州青边框样式）
  - 主按钮"保存到相册"（朱砂红）

**交互**：

- "保存到相册"调用 `Taro.saveImageToPhotosAlbum`
- "重新生成"返回 `pages/upload`，清空 projectStore

---

## 技术实现要点

### projectStore (stores/projectStore.ts)

```typescript
import { create } from "zustand"

interface ProjectState {
  productImage: string | null
  category: string | null
  resultImage: string | null

  setProductImage: (img: string) => void
  setCategory: (cat: string) => void
  setResultImage: (img: string) => void
  reset: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  productImage: null,
  category: null,
  resultImage: null,
  setProductImage: (img) => set({ productImage: img }),
  setCategory: (cat) => set({ category: cat }),
  setResultImage: (img) => set({ resultImage: img }),
  reset: () => set({ productImage: null, category: null, resultImage: null })
}))
```

### 图片合成方案（MVP 阶段）

**为了快速跑通，先用本地 Canvas 合成 + 预设背景模板**，不调用云端 AI 生成图。

具体方案：

1. 在 `src/assets/templates/` 放 4 张徽派背景模板（先用占位图，标注 `template-1.png` 到 `template-4.png`，后续我会替换为 Midjourney 生成的真图）
2. 用户上传图后，用 Canvas 将原图缩放居中合成到模板上
3. 右下角合成"田园徽州"印章 SVG
4. 输出合成后的图片路径

**简化的 mock 逻辑**（写在 `services/api.ts`）：

```typescript
import Taro from "@tarojs/taro"

export async function generateImage(productImage: string, category: string): Promise<string> {
  // MVP阶段：在小程序端用Canvas直接合成，不走后端
  // 模拟3秒生成时间，体现AI感
  await new Promise((resolve) => setTimeout(resolve, 3000))

  // TODO: 实际Canvas合成逻辑
  // 1. 加载选中的背景模板（根据category选择不同模板）
  // 2. 加载用户上传的产品图
  // 3. 在Canvas上绘制：背景 + 居中的产品图（带阴影）+ 右下角印章
  // 4. 导出为临时文件路径

  return await composeImage(productImage, category)
}

async function composeImage(productImage: string, category: string): Promise<string> {
  // 实现Canvas合成
  // 返回 Taro.canvasToTempFilePath 的结果
}
```

请实现完整的 Canvas 合成函数，使用 Taro 的 Canvas 2D 接口。

### 路由配置 (app.config.ts)

```typescript
export default {
  pages: [
    "pages/index/index",
    "pages/upload/index",
    "pages/category/index",
    "pages/generating/index",
    "pages/result/index"
  ],
  window: {
    backgroundColor: "#F5F0E8",
    backgroundTextStyle: "dark",
    navigationBarBackgroundColor: "#F5F0E8",
    navigationBarTitleText: "田园徽州",
    navigationBarTextStyle: "black"
  }
}
```

---

## 必须创建的组件

### HuiButton (components/HuiButton/index.tsx)

```typescript
interface HuiButtonProps {
  type?: "primary" | "secondary" // 朱砂红 / 徽州青边框
  disabled?: boolean
  loading?: boolean
  onClick: () => void
  children: React.ReactNode
}
```

按下态用 hoverClass，禁用态 opacity 0.4，加载态显示 loading icon。

### HuiSeal (components/HuiSeal/index.tsx)

"田园徽州"印章 SVG 组件，朱砂红色，方形带传统印章质感。用于结果图右下角和应用内品牌标识。

### MountainDecor (components/MountainDecor/index.tsx)

水墨远山 SVG 装饰组件，宽度 100%，高度可配置。仅在首页使用。

---

## 交付清单

完成后请告诉我：

1. ✅ 项目初始化命令（一次性可执行的 bash 脚本）
2. ✅ 五个页面的完整代码
3. ✅ projectStore 完整实现
4. ✅ services/api.ts 完整 Canvas 合成逻辑
5. ✅ HuiButton / HuiSeal / MountainDecor 三个核心组件
6. ✅ tailwind.config.js 完整配置
7. ✅ constants/categories.ts 品类清单
8. ✅ 微信开发者工具的预览步骤
9. ✅ 当前还需要我提供的素材清单（如背景模板图、字体文件等）

完成后**不要主动添加任何超出范围的功能**。

---

## 验收标准

我会在微信开发者工具中走一遍完整流程：

- 能上传一张照片
- 能选择品类
- 能看到 3 秒的生成动画
- 结果页能看到一张合成图（即使背景是占位图也行）
- 能点击保存（弹出授权）

只要这条链路跑通，MVP 第一阶段就完成了。
