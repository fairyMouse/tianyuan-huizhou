# Task: 田园徽州 v4 - 抠图能力集成(阿里云 SegmentCommodity)

## 背景

v3 合成效果验证: **背景选择逻辑正确,色温对齐,文字版式到位**。但产品图依然以"白色卡片"形式呈现,破坏沉浸感。v4 目标: 集成阿里云商品抠图 API,让产品"真正站在徽派场景里"。

核心效果差异:
- v3: 产品在白色卡片里,像贴纸 → "AI 生成的样子"
- v4: 产品抠图后带投影落在木桌上 → "真实电商主图"

---

## 架构设计

### 为什么后端做抠图,不是小程序直接调

**安全**: 阿里云 AccessKey 不能暴露在小程序前端  
**性能**: 小程序直接调阿里云会走国际链路,国内后端代理更快  
**缓存**: 同一张图可以 hash 缓存,避免重复消耗 API 配额  
**降级**: 后端可以做统一的 fallback,失败时返回原图,前端逻辑简单

### 完整流程

```
[小程序]                 [Next.js API]              [阿里云]
   │                         │                          │
   │ 1. 压缩图片             │                          │
   │ 2. 上传 base64 ────────>│                          │
   │                         │ 3. MD5 缓存检查          │
   │                         │ 4. 临时存储为 OSS URL   │
   │                         │ 5. 调 SegmentCommodity ─>│
   │                         │<──── 抠图 URL ───────────│
   │                         │ 6. 下载抠图 PNG          │
   │                         │ 7. 返回 base64           │
   │<── 抠好图的 base64 ─────│                          │
   │                                                     │
   │ 8. 写入本地临时文件                                  │
   │ 9. Canvas 合成(带投影)                              │
```

---

## 前置准备(用户需手动完成)

### 1. 阿里云账号配置

1. 登录 https://vision.aliyun.com
2. 开通**图像分割**服务(新用户 500 次免费)
3. 创建 AccessKey(RAM 用户,不要用主账号):
   - 权限: `AliyunVIAPIFullAccess`
4. 记录 AccessKey ID + AccessKey Secret

### 2. OSS 配置(用于临时存图)

1. 阿里云 OSS 创建 Bucket,名称如 `tianyuan-huizhou-temp`
2. 区域选**华东1(杭州)**(和视觉智能服务同区域,免流量费)
3. 权限: **公共读**(SegmentCommodity 需要能访问到图片)
4. 配置**生命周期规则**: 1 天后自动删除(省存储费 + 隐私保护)
5. 获取 Bucket 域名,形如 `https://tianyuan-huizhou-temp.oss-cn-hangzhou.aliyuncs.com`

### 3. 环境变量

在 Next.js 项目根目录创建 `.env.local`:

```bash
ALIYUN_ACCESS_KEY_ID=LTAI5t...
ALIYUN_ACCESS_KEY_SECRET=xxxx
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_BUCKET=tianyuan-huizhou-temp
ALIYUN_VIAPI_REGION=cn-shanghai
```

### 4. 安装依赖

Next.js 后端:
```bash
npm install @alicloud/imageseg20191230 @alicloud/openapi-client ali-oss
npm install -D @types/ali-oss
```

---

## 后端实现

### 文件结构

```
app/api/cutout/
└── route.ts                    # POST /api/cutout

lib/aliyun/
├── oss.ts                      # OSS 临时存储
├── segmentCommodity.ts         # 抠图 API 封装
└── cache.ts                    # 内存缓存(MD5 → 结果)
```

### `lib/aliyun/oss.ts`

```typescript
import OSS from 'ali-oss';
import crypto from 'crypto';

const client = new OSS({
  region: process.env.ALIYUN_OSS_REGION!,
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
  bucket: process.env.ALIYUN_OSS_BUCKET!,
});

/**
 * 上传临时图片,返回公网 URL
 */
export async function uploadTempImage(buffer: Buffer, ext = 'jpg'): Promise<string> {
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const key = `temp/${Date.now()}-${hash}.${ext}`;
  
  const result = await client.put(key, buffer, {
    headers: {
      'x-oss-object-acl': 'public-read',
      'Cache-Control': 'max-age=3600',
    },
  });
  
  return result.url;
}

/**
 * 下载 URL 为 Buffer(用于把阿里云返回的抠图下载回来)
 */
export async function downloadAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
```

### `lib/aliyun/segmentCommodity.ts`

```typescript
import imageseg20191230, * as $imageseg from '@alicloud/imageseg20191230';
import * as $OpenApi from '@alicloud/openapi-client';

const client = new imageseg20191230.default(new $OpenApi.Config({
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
  endpoint: `imageseg.${process.env.ALIYUN_VIAPI_REGION}.aliyuncs.com`,
}));

/**
 * 调用商品分割 API
 * @param imageUrl 公网可访问的图片 URL(来自 OSS)
 * @returns 抠图结果 URL(带透明通道的 PNG)
 */
export async function segmentCommodity(imageUrl: string): Promise<string> {
  const req = new $imageseg.SegmentCommodityRequest({
    imageURL: imageUrl,
  });
  
  // 超时设置: 10 秒
  const runtime = { readTimeout: 10000, connectTimeout: 5000 };
  
  const res = await client.segmentCommodityWithOptions(req, runtime);
  
  if (!res.body?.data?.imageURL) {
    throw new Error('SegmentCommodity returned no image URL');
  }
  
  return res.body.data.imageURL;
}
```

### `lib/aliyun/cache.ts`

```typescript
/**
 * 简单内存缓存:MD5 → 抠图后的 base64
 * MVP 够用,重启失效,不需要 Redis
 */
const cache = new Map<string, { data: string; expiresAt: number }>();
const TTL = 24 * 60 * 60 * 1000; // 24 小时
const MAX_SIZE = 100;

export function getCached(hash: string): string | null {
  const entry = cache.get(hash);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(hash);
    return null;
  }
  return entry.data;
}

export function setCached(hash: string, data: string) {
  // 简单 LRU:超过上限就清除最早的
  if (cache.size >= MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(hash, { data, expiresAt: Date.now() + TTL });
}
```

### `app/api/cutout/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { uploadTempImage, downloadAsBuffer } from '@/lib/aliyun/oss';
import { segmentCommodity } from '@/lib/aliyun/segmentCommodity';
import { getCached, setCached } from '@/lib/aliyun/cache';

export const runtime = 'nodejs';
export const maxDuration = 30; // Vercel 超时

/**
 * POST /api/cutout
 * body: { imageBase64: string }
 * response: { success: true, cutoutBase64: string } | { success: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid image data' }, { status: 400 });
    }
    
    // 1. base64 → Buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 大小限制 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Image too large (max 5MB)' }, { status: 400 });
    }
    
    // 2. MD5 缓存检查
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const cached = getCached(hash);
    if (cached) {
      return NextResponse.json({ success: true, cutoutBase64: cached, cached: true });
    }
    
    // 3. 上传到 OSS,得到公网 URL
    const tempUrl = await uploadTempImage(buffer);
    
    // 4. 调阿里云抠图
    const cutoutUrl = await segmentCommodity(tempUrl);
    
    // 5. 下载抠图 PNG,转 base64
    const cutoutBuffer = await downloadAsBuffer(cutoutUrl);
    const cutoutBase64 = `data:image/png;base64,${cutoutBuffer.toString('base64')}`;
    
    // 6. 写入缓存
    setCached(hash, cutoutBase64);
    
    return NextResponse.json({ success: true, cutoutBase64, cached: false });
    
  } catch (error: any) {
    console.error('[/api/cutout] error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Cutout failed' },
      { status: 500 }
    );
  }
}
```

---

## 小程序端改造

### 新增 `services/cutout.ts`

```typescript
import Taro from '@tarojs/taro';

const API_BASE = 'https://your-nextjs-domain.vercel.app'; // TODO: 替换成实际域名

export interface CutoutResult {
  success: boolean;
  localPath?: string;  // 抠图后的本地临时路径
  error?: string;
}

/**
 * 调抠图 API,返回抠图后的本地文件路径
 * 超时 15 秒,失败时 result.success = false
 */
export async function cutoutProduct(userImagePath: string): Promise<CutoutResult> {
  try {
    // 1. 读取图片为 base64
    const fileSystem = Taro.getFileSystemManager();
    const base64 = await new Promise<string>((resolve, reject) => {
      fileSystem.readFile({
        filePath: userImagePath,
        encoding: 'base64',
        success: (res) => resolve(res.data as string),
        fail: reject,
      });
    });
    
    // 2. 调后端抠图 API
    const response = await Taro.request({
      url: `${API_BASE}/api/cutout`,
      method: 'POST',
      data: { imageBase64: `data:image/jpeg;base64,${base64}` },
      header: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    
    if (response.statusCode !== 200 || !response.data?.success) {
      return {
        success: false,
        error: response.data?.error || `HTTP ${response.statusCode}`,
      };
    }
    
    // 3. 把抠图 base64 写入本地临时文件
    const cutoutBase64 = (response.data.cutoutBase64 as string)
      .replace(/^data:image\/\w+;base64,/, '');
    const tempPath = `${Taro.env.USER_DATA_PATH}/cutout-${Date.now()}.png`;
    
    await new Promise<void>((resolve, reject) => {
      fileSystem.writeFile({
        filePath: tempPath,
        data: cutoutBase64,
        encoding: 'base64',
        success: () => resolve(),
        fail: reject,
      });
    });
    
    return { success: true, localPath: tempPath };
    
  } catch (error: any) {
    return { success: false, error: error.message || '抠图失败' };
  }
}

/**
 * 压缩图片到 5MB 以内(调抠图前预处理)
 */
export async function compressImage(path: string, quality = 80): Promise<string> {
  try {
    const info = await Taro.getImageInfo({ src: path });
    // 小于 1MB 直接返回原图
    const fileSystem = Taro.getFileSystemManager();
    const stat = await new Promise<any>((resolve, reject) => {
      fileSystem.stat({
        path,
        success: resolve,
        fail: reject,
      });
    });
    if (stat.stats.size < 1024 * 1024) return path;
    
    // 压缩
    const result = await Taro.compressImage({ src: path, quality });
    return result.tempFilePath;
  } catch {
    return path; // 压缩失败返回原图
  }
}
```

### 修改 `hooks/useImageComposer.ts`

```typescript
import { useState } from 'react';
import { pickTemplate } from '@/constants/templates';
import { composeMainImage } from '@/services/composer';
import { cutoutProduct, compressImage } from '@/services/cutout';
import { CATEGORIES, type CategoryId } from '@/constants/categories';

type Status = 'idle' | 'compressing' | 'cutting' | 'composing' | 'success' | 'error';

export function useImageComposer() {
  const [status, setStatus] = useState<Status>('idle');
  const [resultPath, setResultPath] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [mode, setMode] = useState<'premium' | 'standard'>('premium'); // 告诉结果页用的是抠图还是卡片

  async function compose(userImagePath: string, categoryId: CategoryId) {
    setError('');
    
    try {
      // Step 1: 压缩图片
      setStatus('compressing');
      const compressed = await compressImage(userImagePath);
      
      // Step 2: 抠图(失败则 fallback 到原图)
      setStatus('cutting');
      const cutoutResult = await cutoutProduct(compressed);
      
      let productImagePath: string;
      let useCutout: boolean;
      
      if (cutoutResult.success && cutoutResult.localPath) {
        productImagePath = cutoutResult.localPath;
        useCutout = true;
        setMode('premium');
      } else {
        // 降级:使用原图 + 卡片方案
        console.warn('[cutout fallback]', cutoutResult.error);
        productImagePath = compressed;
        useCutout = false;
        setMode('standard');
      }
      
      // Step 3: Canvas 合成
      setStatus('composing');
      const template = pickTemplate(categoryId);
      const category = CATEGORIES.find(c => c.id === categoryId)!;
      
      const path = await composeMainImage({
        canvasId: 'composer-canvas',
        template,
        userImagePath: productImagePath,
        productName: category.name,
        productPinyin: category.pinyin,
        useCutout, // 关键:告诉 composer 用哪种渲染模式
      });
      
      setResultPath(path);
      setStatus('success');
      
    } catch (e: any) {
      setError(e.message || '生成失败,请重试');
      setStatus('error');
    }
  }

  function reset() {
    setStatus('idle');
    setResultPath('');
    setError('');
  }

  return { status, resultPath, error, mode, compose, reset };
}
```

---

## Canvas 合成改造

### 修改 `services/composer.ts` - 新增抠图模式

在 `ComposeParams` 增加字段:

```typescript
export interface ComposeParams {
  canvasId: string;
  template: TemplateMeta;
  userImagePath: string;
  productName: string;
  productPinyin: string;
  useCutout: boolean;       // ✅ 新增:true=抠图+投影模式,false=v3 卡片模式
  brandText?: string;
}
```

### 修改 `composeMainImage` 主流程

```typescript
export async function composeMainImage(params: ComposeParams): Promise<string> {
  const { 
    canvasId, template, userImagePath, productName, productPinyin,
    useCutout, brandText = '田园徽州' 
  } = params;

  const ctx = await getCanvasContext(canvasId);

  // 1. 背景模板铺满
  await drawImage(ctx, template.path, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  // 2. 计算产品区域(抠图模式不画卡片,产品直接放 productZone)
  const { cx, cy, maxW, maxH } = template.productZone;
  const zoneW = OUTPUT_SIZE * maxW;
  const zoneH = OUTPUT_SIZE * maxH;
  const zoneX = OUTPUT_SIZE * cx - zoneW / 2;
  const zoneY = OUTPUT_SIZE * cy - zoneH / 2;

  if (useCutout) {
    // 抠图模式:产品带投影直接落在背景上
    await drawCutoutProduct(ctx, userImagePath, zoneX, zoneY, zoneW, zoneH);
  } else {
    // 标准模式(v3 降级方案):宣纸卡片 + 产品图
    drawCard(ctx, zoneX, zoneY, zoneW, zoneH);
    await drawImageContain(
      ctx, userImagePath,
      zoneX + CARD_PADDING, zoneY + CARD_PADDING,
      zoneW - CARD_PADDING * 2, zoneH - CARD_PADDING * 2,
      CARD_RADIUS - 4
    );
  }

  // 3. 文字版式(不变)
  drawTextBlock(ctx, productName, productPinyin, template, zoneX, zoneY, zoneW, zoneH);

  // 4. 印章(不变)
  await drawSeal(ctx, brandText, template, zoneX, zoneY, zoneW, zoneH);

  return await canvasToTempFilePath(canvasId);
}
```

### 新增 `drawCutoutProduct` 函数(核心)

```typescript
/**
 * 抠图模式:产品图(带透明通道的 PNG)+ 投影,直接落在背景上
 * 投影参数是这个模式真假图分界线,需要根据实际效果微调
 */
async function drawCutoutProduct(
  ctx, src: string, 
  zoneX: number, zoneY: number, zoneW: number, zoneH: number
) {
  const imageInfo = await Taro.getImageInfo({ src });
  
  // contain 缩放
  const imgRatio = imageInfo.width / imageInfo.height;
  const boxRatio = zoneW / zoneH;
  let drawW, drawH, drawX, drawY;
  
  if (imgRatio > boxRatio) {
    drawW = zoneW;
    drawH = zoneW / imgRatio;
    drawX = zoneX;
    drawY = zoneY + (zoneH - drawH) / 2;
  } else {
    drawH = zoneH;
    drawW = zoneH * imgRatio;
    drawX = zoneX + (zoneW - drawW) / 2;
    drawY = zoneY;
  }
  
  return new Promise<void>((resolve, reject) => {
    const img = ctx.canvas.createImage();
    img.onload = () => {
      ctx.save();
      
      // ✨ 关键:投影设置(真假图分界线)
      // 投影颜色偏暖棕(不是纯黑),blur 大,offsetY 中等
      // 模拟产品在木桌上的自然光投影
      ctx.shadowColor = 'rgba(58, 42, 28, 0.35)'; // 暖棕色阴影
      ctx.shadowBlur = 28;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 18;
      
      // 绘制抠图 PNG(透明通道保留)
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      
      ctx.restore();
      resolve();
    };
    img.onerror = reject;
    img.src = imageInfo.path;
  });
}
```

---

## 生成中页面改造(状态提示)

修改 `pages/generating/index.tsx`,根据 status 显示不同文案:

```typescript
import { View, Text, Canvas } from '@tarojs/components';
import { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { useImageComposer } from '@/hooks/useImageComposer';
import { useGenerationStore } from '@/stores/generationStore';

const STATUS_TEXT = {
  idle: '准备中…',
  compressing: '正在优化图片…',
  cutting: '正在智能抠图…',
  composing: '正在调墨润色…',
  success: '完成',
  error: '生成失败',
};

export default function GeneratingPage() {
  const { userImagePath, categoryId } = useGenerationStore();
  const { status, resultPath, mode, error, compose } = useImageComposer();

  useEffect(() => {
    if (userImagePath && categoryId) compose(userImagePath, categoryId);
  }, []);

  useEffect(() => {
    if (status === 'success') {
      useGenerationStore.setState({ resultPath, mode });
      Taro.redirectTo({ url: '/pages/result/index' });
    }
  }, [status, resultPath]);

  return (
    <View className="min-h-screen bg-paper flex items-center justify-center">
      <Canvas
        type="2d"
        id="composer-canvas"
        className="absolute -top-[2000rpx] -left-[2000rpx] w-[1080px] h-[1080px]"
      />
      <View className="flex flex-col items-center">
        <Text className="text-ink font-serif text-32rpx mb-16rpx">
          {STATUS_TEXT[status]}
        </Text>
        {status === 'error' && (
          <Text className="text-cinnabar text-24rpx">{error}</Text>
        )}
      </View>
    </View>
  );
}
```

---

## 上传页提示优化

在上传页底部添加文案,告知用户什么样的图片抠图效果最好:

```tsx
<View className="text-22rpx text-ink/60 mt-32rpx text-center leading-relaxed">
  💡 拍摄小贴士
  {'\n'}• 产品放在浅色桌面上,光线充足
  {'\n'}• 建议单一主体,避免多个物品散落
  {'\n'}• 保持相机稳定,对焦清晰
</View>
```

---

## 验收标准

1. **抠图成功路径**:
   - 上传香榧照片 → 显示"正在智能抠图" → 生成图中香榧直接落在木桌上,无白色卡片
   - 产品下方有柔和的暖棕色投影,像真的放在桌上
   - mode = 'premium'

2. **抠图失败降级**:
   - 断网/超时/API 报错时,自动降级到 v3 卡片模式
   - 用户无感知(不弹报错,只是效果不如 premium)
   - mode = 'standard'

3. **缓存生效**:
   - 同一张图第二次调用,返回更快(带 cached: true)
   - 后端日志可见

4. **配额友好**:
   - 开发调试中同一测试图不重复消耗免费额度

5. **投影质量**:
   - 阴影颜色是偏暖的棕色(rgba(58,42,28,0.35))而非纯黑
   - blur 和 offsetY 让产品看起来"落在桌面"而非"漂浮"

---

## 暂不实现

- 用户手动微调抠图边缘
- 多产品组合抠图
- 阴影参数根据不同背景自适应(目前固定一套参数)
- Redis 缓存(MVP 内存缓存够用)

---

## Cursor 执行后必须手动确认的事项

### 1. 先跑通一次真实调用

不要信 Cursor 说"已经实现了",必须在本地实际跑一次:
```bash
curl -X POST http://localhost:3000/api/cutout \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"data:image/jpeg;base64,/9j/..."}'
```

验证:
- 阿里云 AccessKey 生效
- OSS 上传成功(控制台可见)
- SegmentCommodity 返回有效 URL
- 返回的 base64 可以正常解码为 PNG

### 2. 阴影参数微调

不同模板背景(木桌 vs 宣纸 vs 石板)对投影的感知不一样:
- 木桌背景: `rgba(58, 42, 28, 0.35)` 偏暖棕
- 宣纸背景: `rgba(100, 80, 60, 0.25)` 更柔和
- 石板背景: `rgba(40, 40, 40, 0.35)` 偏冷灰

可以在 `TemplateMeta` 加 `shadowColor` 字段,让每个模板带自己的投影参数。但 MVP 先用一套默认值,有时间再优化。

### 3. 成本监控

阿里云控制台 → 视觉智能 → 用量查询,每天检查一次:
- 免费 500 次消耗速度
- 单张平均耗时
- 失败率(如果 > 5% 要看原因)

### 4. Fallback 必须真测

故意把 .env.local 的 AccessKey 改错一个字符,上传图片,确认流程会降级到 v3 卡片模式而不是闪退。这个演习比什么都重要。
