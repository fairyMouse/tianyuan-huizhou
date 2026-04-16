# Task: 田园徽州 主图合成模块 v3(完全重写,替换 v1/v2)

## 背景与设计原则

之前 v1/v2 的核心问题不在代码,在**品类→模板的映射逻辑错了**:
- v1 把 "黟县香榧" 映射到 "水墨远山",理由是 "黟县=山区" —— 这是**地理逻辑**
- 但电商主图的目的是**让人想买**,不是**展示产地** —— 应该用**消费心智逻辑**
- 一张深棕木桌的坚果特写照片,配水墨远山背景,无论怎么调滤镜都救不回来

v3 的设计原则:
1. **消费心智优先**: 按 "消费者看到产品会联想到什么场景" 来匹配背景,而不是按产地
2. **视觉质感对齐**: 写实摄影产品配写实质感背景(木桌/石板/竹编),抽象产品配抽象背景(水墨/宣纸)
3. **简单可靠**: 不依赖小程序 Canvas 的高级 API(globalCompositeOperation 等),只用 fillRect/drawImage/clip 等基础方法
4. **不做无效救火**: 不叠加滤镜强行调色,选对背景比改产品颜色更有效

---

## 项目约束(必读)

- Taro 4.x + React + TS,编译目标仅微信小程序
- 仅用 Taro 组件(View/Text/Image/Canvas),禁止 HTML 标签
- Tailwind CSS via weapp-tailwindcss@v3,单位用 rpx
- Zustand 管状态,禁止 axios(用 Taro.request)
- 自定义组件统一 Hui 前缀
- 设计语言"传统徽韵主调": 宣纸 #F5F0E8 / 墨 #2C2C2C / 朱砂 #A8362A / 徽州青 #3D5A5C / 描金 #C8A063
- 字体: Noto Serif SC(标题)+ Noto Sans SC(正文)
- 圆角 8-16rpx,无渐变无毛玻璃,动画仅 opacity 淡入

---

## 文件结构(请新建)

```
src/
├── assets/templates/                    # 已有图片,不要动
│   ├── elegant/  rustic/  festive/  modern/  universal/
│
├── constants/
│   ├── categories.ts                    # 10 个品类常量(含拼音 + 模板映射)
│   └── templates.ts                     # 模板注册表
│
├── services/
│   └── composer.ts                      # Canvas 合成核心(纯函数)
│
├── hooks/
│   └── useImageComposer.ts              # 合成流程 hook
│
└── stores/
    └── generationStore.ts               # Zustand store
```

---

## 核心数据模型

### `constants/categories.ts`

**品类→模板的重新设计**(关键修改,严禁照抄之前的版本):

| 品类 | 消费心智 | 推荐 promptType | 排除的 promptType |
|---|---|---|---|
| 黟县香榧 | 坚果零食,看质感 | rustic-bamboo-weave, rustic-old-house-table | ❌ 远山(太抽象) |
| 腊八豆腐 | 日常食材,朴实 | rustic-stone-pottery, rustic-old-house-table | ❌ 节庆类(过头) |
| 泗溪三宝 | 礼盒/干货 | rustic-old-house-table, festive-red-chinese | - |
| 徽州黑茶 | 饮品/养生,文人 | elegant-tea-zen, elegant-misty-mountains, elegant-rice-paper | ✅ 唯一适合远山 |
| 黟县笋干 | 山货干货,原生态 | rustic-bamboo-weave, rustic-stone-pottery | ❌ 远山(产品太具象) |
| 山地蜂蜜 | 玻璃瓶装液体,雅致 | elegant-rice-paper, elegant-misty-mountains | - |
| 古法茶油 | 日常食材+古法工艺 | rustic-old-house-table, rustic-stone-pottery | ❌ 远山 |
| 徽州火腿 | 节庆礼品,年味 | festive-red-chinese, festive-window-lattice | ❌ 雅致类(不够喜庆) |
| 竹制品 | 手工艺/家居 | rustic-bamboo-weave, modern-minimal-geo | - |
| 其他特产 | 兜底 | universal-seal-rubbing, rustic-old-house-table | - |

```typescript
export const CATEGORIES = [
  { 
    id: 'xiangfei',  
    name: '黟县香榧',   
    pinyin: 'YIXIAN XIANGFEI',
    templates: ['rustic-bamboo-weave', 'rustic-old-house-table']
  },
  { 
    id: 'doufu',     
    name: '腊八豆腐',   
    pinyin: 'LABA DOUFU',
    templates: ['rustic-stone-pottery', 'rustic-old-house-table']
  },
  { 
    id: 'sixisanbao',
    name: '泗溪三宝',   
    pinyin: 'SIXI SANBAO',
    templates: ['rustic-old-house-table', 'festive-red-chinese']
  },
  { 
    id: 'heicha',    
    name: '徽州黑茶',   
    pinyin: 'HUIZHOU HEICHA',
    templates: ['elegant-tea-zen', 'elegant-misty-mountains', 'elegant-rice-paper']
  },
  { 
    id: 'sungan',    
    name: '黟县笋干',   
    pinyin: 'YIXIAN SUNGAN',
    templates: ['rustic-bamboo-weave', 'rustic-stone-pottery']
  },
  { 
    id: 'fengmi',    
    name: '山地蜂蜜',   
    pinyin: 'SHANDI FENGMI',
    templates: ['elegant-rice-paper', 'elegant-misty-mountains']
  },
  { 
    id: 'chayou',    
    name: '古法茶油',   
    pinyin: 'GUFA CHAYOU',
    templates: ['rustic-old-house-table', 'rustic-stone-pottery']
  },
  { 
    id: 'huotui',    
    name: '徽州火腿',   
    pinyin: 'HUIZHOU HUOTUI',
    templates: ['festive-red-chinese', 'festive-window-lattice']
  },
  { 
    id: 'zhuzhipin', 
    name: '竹制品',     
    pinyin: 'ZHUZHIPIN',
    templates: ['rustic-bamboo-weave', 'modern-minimal-geo']
  },
  { 
    id: 'qita',      
    name: '其他特产',   
    pinyin: 'TESE TECHAN',
    templates: ['universal-seal-rubbing', 'rustic-old-house-table']
  },
] as const;

export type CategoryId = typeof CATEGORIES[number]['id'];
```

### `constants/templates.ts`

```typescript
// 模板尺寸统一 1024×1024,输出主图 1080×1080

export interface TemplateMeta {
  id: string;
  promptType: string;
  style: 'elegant' | 'rustic' | 'festive' | 'modern' | 'universal';
  path: string;
  productZone: {
    cx: number;      // 0-1 比例,卡片中心 x
    cy: number;      // 0-1 比例,卡片中心 y
    maxW: number;    // 0-1 比例,卡片最大宽
    maxH: number;    // 0-1 比例,卡片最大高
  };
  textColor: '#2C2C2C' | '#F5F0E8';
  textPosition: 'top' | 'bottom';
}

// 各 promptType 的默认 productZone(根据每个风格的典型构图)
// 注意:实际图片下载后,需要逐张微调,这里只是合理起点
const DEFAULT_ZONES: Record<string, Partial<TemplateMeta>> = {
  'elegant-misty-mountains': {
    productZone: { cx: 0.5, cy: 0.62, maxW: 0.5, maxH: 0.4 },
    textColor: '#2C2C2C',
    textPosition: 'bottom',
  },
  'elegant-rice-paper': {
    productZone: { cx: 0.5, cy: 0.55, maxW: 0.55, maxH: 0.45 },
    textColor: '#2C2C2C',
    textPosition: 'bottom',
  },
  'elegant-tea-zen': {
    productZone: { cx: 0.5, cy: 0.55, maxW: 0.5, maxH: 0.42 },
    textColor: '#2C2C2C',
    textPosition: 'bottom',
  },
  'rustic-old-house-table': {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.55, maxH: 0.45 },
    textColor: '#2C2C2C',
    textPosition: 'bottom',
  },
  'rustic-stone-pottery': {
    productZone: { cx: 0.5, cy: 0.55, maxW: 0.5, maxH: 0.42 },
    textColor: '#2C2C2C',
    textPosition: 'bottom',
  },
  'rustic-bamboo-weave': {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.5, maxH: 0.42 },
    textColor: '#2C2C2C',
    textPosition: 'bottom',
  },
  'festive-red-chinese': {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.5, maxH: 0.42 },
    textColor: '#F5F0E8',
    textPosition: 'bottom',
  },
  'festive-window-lattice': {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.45, maxH: 0.4 },
    textColor: '#F5F0E8',
    textPosition: 'bottom',
  },
  'modern-minimal-geo': {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.55, maxH: 0.5 },
    textColor: '#2C2C2C',
    textPosition: 'bottom',
  },
  'universal-seal-rubbing': {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.55, maxH: 0.5 },
    textColor: '#2C2C2C',
    textPosition: 'bottom',
  },
};

// 模板注册表 —— 实际图片落盘后按这个结构填
// 占位:每个 promptType 至少 1 张,可以多张做随机
export const TEMPLATE_REGISTRY: Record<string, TemplateMeta[]> = {
  'elegant-misty-mountains': [
    {
      id: 'elegant-misty-mountains-01',
      promptType: 'elegant-misty-mountains',
      style: 'elegant',
      path: require('@/assets/templates/elegant/elegant-misty-mountains-01.png'),
      ...DEFAULT_ZONES['elegant-misty-mountains'],
    } as TemplateMeta,
  ],
  'rustic-bamboo-weave': [
    {
      id: 'rustic-bamboo-weave-01',
      promptType: 'rustic-bamboo-weave',
      style: 'rustic',
      path: require('@/assets/templates/rustic/rustic-bamboo-weave-01.png'),
      ...DEFAULT_ZONES['rustic-bamboo-weave'],
    } as TemplateMeta,
  ],
  // ... 其他 promptType 按相同结构填充
  // 重要:即使某 promptType 还没出图,也要在这里留空数组 [],pickTemplate 会做 fallback
};

// 抽取一张模板:从品类的可选 promptType 池随机选一个,再从该 promptType 的变体里随机选一张
// 如果某 promptType 暂无图片,自动 fallback 到该品类的其他可用 promptType
import { CATEGORIES, type CategoryId } from './categories';

export function pickTemplate(categoryId: CategoryId): TemplateMeta {
  const category = CATEGORIES.find(c => c.id === categoryId);
  if (!category) throw new Error(`Unknown category: ${categoryId}`);
  
  // 过滤出有图片的 promptType
  const availableTypes = category.templates.filter(
    t => TEMPLATE_REGISTRY[t]?.length > 0
  );
  
  if (availableTypes.length === 0) {
    // 全部 promptType 都没图,降级到 universal
    const fallback = TEMPLATE_REGISTRY['universal-seal-rubbing'];
    if (fallback?.length > 0) return fallback[0];
    throw new Error(`No templates available for ${categoryId}`);
  }
  
  const promptType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  const variants = TEMPLATE_REGISTRY[promptType];
  return variants[Math.floor(Math.random() * variants.length)];
}
```

---

## Canvas 合成核心 `services/composer.ts`

**设计要点**:
- 不用 globalCompositeOperation(小程序兼容性差)
- 不做产品图滤镜叠加(选对背景比调色更有效)
- 卡片直接用宣纸色 #F5F0E8 + 柔和阴影,不做羽化(实现复杂收益小)
- 文字版式保留 "描金分隔线 + 字间距 + 拼音" 的高端感

```typescript
import Taro from '@tarojs/taro';
import type { TemplateMeta } from '@/constants/templates';

export interface ComposeParams {
  canvasId: string;
  template: TemplateMeta;
  userImagePath: string;
  productName: string;
  productPinyin: string;
  brandText?: string;
}

const OUTPUT_SIZE = 1080;
const CARD_RADIUS = 16;
const CARD_PADDING = 24;
const CARD_BG = '#F5F0E8';

export async function composeMainImage(params: ComposeParams): Promise<string> {
  const { 
    canvasId, template, userImagePath, productName, productPinyin,
    brandText = '田园徽州' 
  } = params;

  const ctx = await getCanvasContext(canvasId);

  // 1. 背景模板铺满
  await drawImage(ctx, template.path, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  // 2. 计算产品卡片位置
  const { cx, cy, maxW, maxH } = template.productZone;
  const cardW = OUTPUT_SIZE * maxW;
  const cardH = OUTPUT_SIZE * maxH;
  const cardX = OUTPUT_SIZE * cx - cardW / 2;
  const cardY = OUTPUT_SIZE * cy - cardH / 2;

  // 3. 卡片底(宣纸色 + 柔和阴影)
  drawCard(ctx, cardX, cardY, cardW, cardH);

  // 4. 用户图片(contain + 圆角裁剪)
  await drawImageContain(
    ctx,
    userImagePath,
    cardX + CARD_PADDING,
    cardY + CARD_PADDING,
    cardW - CARD_PADDING * 2,
    cardH - CARD_PADDING * 2,
    CARD_RADIUS - 4
  );

  // 5. 文字版式(产品名 + 拼音 + 描金分隔线)
  drawTextBlock(ctx, productName, productPinyin, template, cardX, cardY, cardW, cardH);

  // 6. 印章(紧贴文字右侧)
  await drawSeal(ctx, brandText, template, cardX, cardY, cardW, cardH);

  // 7. 导出
  return await canvasToTempFilePath(canvasId);
}

// === 工具函数 ===

async function getCanvasContext(canvasId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    Taro.createSelectorQuery()
      .select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res?.[0]?.node) return reject(new Error('Canvas not found'));
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        resolve(ctx);
      });
  });
}

async function drawImage(ctx, src: string, x: number, y: number, w: number, h: number) {
  // 小程序 Canvas 2D: 必须先用 canvas.createImage() 创建图片对象
  // require 进来的图片需要先 getImageInfo 拿到本地路径
  const imageInfo = await Taro.getImageInfo({ src });
  return new Promise<void>((resolve, reject) => {
    const img = ctx.canvas.createImage();
    img.onload = () => {
      ctx.drawImage(img, x, y, w, h);
      resolve();
    };
    img.onerror = reject;
    img.src = imageInfo.path;
  });
}

function drawCard(ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  
  // 柔和墨色阴影(blur 大,offset 小,透明度低)
  ctx.shadowColor = 'rgba(44, 44, 44, 0.10)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 10;
  
  // 宣纸色卡片底
  ctx.fillStyle = CARD_BG;
  
  drawRoundedRectPath(ctx, x, y, w, h, CARD_RADIUS);
  ctx.fill();
  
  ctx.restore();
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function drawImageContain(ctx, src: string, x, y, w, h, r) {
  const imageInfo = await Taro.getImageInfo({ src });
  
  // 计算 contain 缩放
  const imgRatio = imageInfo.width / imageInfo.height;
  const boxRatio = w / h;
  let drawW, drawH, drawX, drawY;
  
  if (imgRatio > boxRatio) {
    // 图片更宽,以宽为准
    drawW = w;
    drawH = w / imgRatio;
    drawX = x;
    drawY = y + (h - drawH) / 2;
  } else {
    // 图片更高,以高为准
    drawH = h;
    drawW = h * imgRatio;
    drawX = x + (w - drawW) / 2;
    drawY = y;
  }
  
  ctx.save();
  // 圆角裁剪
  drawRoundedRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  
  return new Promise<void>((resolve, reject) => {
    const img = ctx.canvas.createImage();
    img.onload = () => {
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
      resolve();
    };
    img.onerror = reject;
    img.src = imageInfo.path;
  });
}

function drawTextBlock(ctx, name: string, pinyin: string, template: TemplateMeta, cardX, cardY, cardW, cardH) {
  ctx.save();
  
  const centerX = cardX + cardW / 2;
  const baseY = cardY + cardH + 60; // 卡片下方 60px
  
  // 1. 上方描金分隔线
  ctx.strokeStyle = '#C8A063';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 80, baseY);
  ctx.lineTo(centerX + 80, baseY);
  ctx.stroke();
  
  // 2. 产品名(拉宽字间距,逐字绘制)
  ctx.fillStyle = template.textColor;
  ctx.font = '500 60px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  const chars = name.split('');
  const charSpacing = 20;
  const charWidths = chars.map(c => ctx.measureText(c).width);
  const totalWidth = charWidths.reduce((s, w) => s + w, 0) + charSpacing * (chars.length - 1);
  let currentX = centerX - totalWidth / 2;
  
  chars.forEach((char, i) => {
    ctx.fillText(char, currentX + charWidths[i] / 2, baseY + 28);
    currentX += charWidths[i] + charSpacing;
  });
  
  // 3. 拼音点缀(灰色小字)
  ctx.font = '400 20px "Noto Sans SC", sans-serif';
  ctx.fillStyle = template.textColor === '#F5F0E8' 
    ? 'rgba(245, 240, 232, 0.6)' 
    : 'rgba(44, 44, 44, 0.45)';
  ctx.fillText(pinyin, centerX, baseY + 110);
  
  // 4. 底部短描金线
  ctx.strokeStyle = '#C8A063';
  ctx.beginPath();
  ctx.moveTo(centerX - 30, baseY + 150);
  ctx.lineTo(centerX + 30, baseY + 150);
  ctx.stroke();
  
  ctx.restore();
}

async function drawSeal(ctx, text: string, template: TemplateMeta, cardX, cardY, cardW, cardH) {
  // 印章位置:文字区域右侧,与底部分隔线对齐
  const sealSize = 70;
  const sealX = cardX + cardW / 2 + 110;
  const sealY = cardY + cardH + 60 + 90;
  
  ctx.save();
  
  // 朱砂红方形(微透明模拟印泥不均)
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#A8362A';
  ctx.fillRect(sealX, sealY, sealSize, sealSize);
  
  // 白字
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#F5F0E8';
  const fontSize = Math.floor(sealSize * 0.26);
  ctx.font = `600 ${fontSize}px "Noto Serif SC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 双字"田园""徽州"分两行
  ctx.fillText(text.slice(0, 2), sealX + sealSize / 2, sealY + sealSize * 0.32);
  ctx.fillText(text.slice(2, 4), sealX + sealSize / 2, sealY + sealSize * 0.68);
  
  ctx.restore();
}

async function canvasToTempFilePath(canvasId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.canvasToTempFilePath({
      canvasId,
      fileType: 'jpg',
      quality: 0.92,
      success: (res) => resolve(res.tempFilePath),
      fail: reject,
    });
  });
}
```

---

## Hook `hooks/useImageComposer.ts`

```typescript
import { useState } from 'react';
import { pickTemplate } from '@/constants/templates';
import { composeMainImage } from '@/services/composer';
import { CATEGORIES, type CategoryId } from '@/constants/categories';

type Status = 'idle' | 'composing' | 'success' | 'error';

export function useImageComposer() {
  const [status, setStatus] = useState<Status>('idle');
  const [resultPath, setResultPath] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function compose(userImagePath: string, categoryId: CategoryId) {
    setStatus('composing');
    setError('');
    try {
      const template = pickTemplate(categoryId);
      const category = CATEGORIES.find(c => c.id === categoryId)!;
      const path = await composeMainImage({
        canvasId: 'composer-canvas',
        template,
        userImagePath,
        productName: category.name,
        productPinyin: category.pinyin,
      });
      setResultPath(path);
      setStatus('success');
    } catch (e: any) {
      setError(e.message || '合成失败,请重试');
      setStatus('error');
    }
  }

  function reset() {
    setStatus('idle');
    setResultPath('');
    setError('');
  }

  return { status, resultPath, error, compose, reset };
}
```

---

## 使用示例 `pages/generating/index.tsx`

```typescript
import { View, Text, Canvas } from '@tarojs/components';
import { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { useImageComposer } from '@/hooks/useImageComposer';
import { useGenerationStore } from '@/stores/generationStore';

export default function GeneratingPage() {
  const { userImagePath, categoryId } = useGenerationStore();
  const { status, resultPath, compose } = useImageComposer();

  useEffect(() => {
    if (userImagePath && categoryId) compose(userImagePath, categoryId);
  }, []);

  useEffect(() => {
    if (status === 'success') {
      useGenerationStore.setState({ resultPath });
      Taro.redirectTo({ url: '/pages/result/index' });
    }
  }, [status, resultPath]);

  return (
    <View className="min-h-screen bg-paper flex items-center justify-center">
      {/* 离屏 Canvas */}
      <Canvas
        type="2d"
        id="composer-canvas"
        className="absolute -top-[2000rpx] -left-[2000rpx] w-[1080px] h-[1080px]"
      />
      <Text className="text-ink font-serif text-32rpx">正在调墨润色…</Text>
    </View>
  );
}
```

---

## 验收标准

1. **品类映射正确**: 香榧不会出现远山背景,黑茶不会出现红色节庆背景
2. **合成图尺寸 1080×1080**,jpg 格式,质量 0.92
3. **同一品类多次生成有随机性**(不会每次都是同一张图)
4. **文字版式完整**: 描金分隔线 + 拉宽字间距的产品名 + 灰色拼音 + 底部短分隔线
5. **印章紧贴文字右侧**,呈现"落款"视觉逻辑
6. **缺图自动 fallback**: 如果某 promptType 还没出图,自动用该品类其他 promptType,最终降级到 universal
7. **失败有明确错误提示**,不闪退

---

## 暂不实现(后续迭代)

- 真实抠图
- 用户手动调整卡片位置
- 多种文字版式切换
- 滤镜叠加(经验证小程序兼容性差,放弃)
- 卡片羽化效果(实现复杂,收益小)

---

## Cursor 执行后的手动工作

**1. productZone 微调(最重要)**

`templates.ts` 给的是默认值,实际图片下载后,每张模板要在微信开发者工具里预览合成效果,然后微调 cx/cy/maxW/maxH。一张模板 5 分钟,12 张 promptType × 平均 2 张变体 = 约 2 小时。这是 MVP 视觉质量的关键投入。

**2. 字体加载**

如果想用上 Noto Serif SC,要在 app.tsx 里 `Taro.loadFontFace` 注入。fallback 到系统 serif 演示效果差不多。

**3. 测试覆盖**

至少跑这 4 个组合验证映射正确性:
- 香榧 + 木桌背景(产品质感对齐 ✓)
- 黑茶 + 远山(雅致饮品 ✓)
- 火腿 + 朱红节庆(年货礼盒 ✓)
- 蜂蜜 + 宣纸(玻璃瓶雅致 ✓)

不要再用香榧+远山测试 —— 那是错误映射。
