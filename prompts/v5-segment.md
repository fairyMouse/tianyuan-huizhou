# v5: 在线抠图接入 (SegmentCommodity + 腾讯 COS)

> 本文档是 Cursor 的 source of truth。严格按此执行,不要自由发挥。
> 范围:只做抠图链路打通。不改 composer 合成逻辑,不改 UI 布局,不改模板 registry。
> 当前问题:生成结果图里产品照片是直接作为白色卡片贴上去的,没有融入背景,需要接入阿里云 SegmentCommodity 做商品抠图,拿到透明底 PNG 的 URL,为下一步 Premium 合成模式铺路。

---

## 0. 技术栈确认

- 后端: Next.js App Router, API Routes (`app/api/segment/route.ts`)
- 前端: Taro 4.x + React + TS, 仅编译到微信小程序
- 存储: 腾讯 COS, 自定义域名 `public.feihan.cc`
- 抠图: 阿里云 viapi SegmentCommodity (商品分割), 华东2上海
- 缓存策略: 按原图字节 MD5 做缓存 key, 同图复用
- 错误策略: 失败直接报错让用户重试, 不降级

---

## 1. 依赖安装

后端 Next.js 项目根目录执行:

```bash
pnpm add @alicloud/viapi20230117 @alicloud/openapi-client cos-nodejs-sdk-v5
```

说明:
- `@alicloud/viapi20230117` 是阿里云视觉智能开放平台 SDK (2023-01-17 版本)
- `@alicloud/openapi-client` 是 SDK 的底层配置依赖
- `cos-nodejs-sdk-v5` 是腾讯 COS 官方 Node SDK

---

## 2. 环境变量

在 Next.js 项目的 `.env.local` 追加以下变量 (已有的不要覆盖):

```bash
# 阿里云 viapi (SegmentCommodity, 华东2上海)
ALIYUN_ACCESS_KEY_ID=<已有,沿用>
ALIYUN_ACCESS_KEY_SECRET=<已有,沿用>
ALIYUN_VIAPI_ENDPOINT=viapi.cn-shanghai.aliyuncs.com

# 腾讯 COS (复用已配置的 bucket)
TENCENT_SECRET_ID=<已有,沿用>
TENCENT_SECRET_KEY=<已有,沿用>
TENCENT_COS_BUCKET=tianyuan-huizhou-1258537429
TENCENT_COS_REGION=ap-shanghai

# 自定义域名 (用于拼接返回给前端的 URL)
PUBLIC_CDN_DOMAIN=https://public.feihan.cc
```

**注意**: 不要把 AK 提交到 git。确认 `.env.local` 已经在 `.gitignore` 里。

---

## 3. 目录结构 (COS 上的前缀约定)

COS bucket `tianyuan-huizhou-1258537429` 下的前缀规划:

```
templates/                    # 已有, Midjourney 模板图 (本次不动)
segment_cache/                # 本次新增, 抠图结果缓存 (永久)
  └─ {md5}.png
uploads_temp/                 # 本次新增, 用户原图临时存储 (24h TTL)
  └─ {md5}.jpg
```

**需要在腾讯 COS 控制台手动配置的事**:

1. 进入 bucket → 基础配置 → 生命周期 → 新建规则:
   - 规则名: `uploads-temp-ttl`
   - 生效范围: 指定前缀 `uploads_temp/`
   - 规则内容: 对象创建 1 天后 → 删除对象
2. 确认 bucket 权限是 "公有读私有写" (已配置)
3. 确认自定义域名 `public.feihan.cc` 已绑定且 SSL 生效

---

## 4. 后端实现

### 4.1 创建 COS 客户端 helper

路径: `lib/cos.ts`

```typescript
import COS from 'cos-nodejs-sdk-v5';

const cos = new COS({
  SecretId: process.env.TENCENT_SECRET_ID!,
  SecretKey: process.env.TENCENT_SECRET_KEY!,
});

const BUCKET = process.env.TENCENT_COS_BUCKET!;
const REGION = process.env.TENCENT_COS_REGION!;
const CDN = process.env.PUBLIC_CDN_DOMAIN!;

/**
 * 检查 COS 上对象是否存在
 */
export async function cosObjectExists(key: string): Promise<boolean> {
  try {
    await cos.headObject({
      Bucket: BUCKET,
      Region: REGION,
      Key: key,
    });
    return true;
  } catch (err: any) {
    if (err?.statusCode === 404) return false;
    throw err;
  }
}

/**
 * 上传 Buffer 到 COS, 返回 public URL
 */
export async function cosPutBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await cos.putObject({
    Bucket: BUCKET,
    Region: REGION,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  return `${CDN}/${key}`;
}

/**
 * 拼接 public URL (不上传, 只拼)
 */
export function cosPublicUrl(key: string): string {
  return `${CDN}/${key}`;
}
```

### 4.2 创建 SegmentCommodity 调用 helper

路径: `lib/segment.ts`

```typescript
import viapi, * as $viapi from '@alicloud/viapi20230117';
import * as $OpenApi from '@alicloud/openapi-client';

const client = new viapi.default(
  new $OpenApi.Config({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
    endpoint: process.env.ALIYUN_VIAPI_ENDPOINT!,
  }),
);

export class SegmentError extends Error {
  code: 'SEGMENT_NO_SUBJECT' | 'SEGMENT_API_FAILED';
  constructor(code: SegmentError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * 调用阿里云 SegmentCommodity, 返回阿里云临时 PNG URL
 * 注意: 阿里云返回的 URL 有效期有限 (通常 24h), 调用方需要立刻下载并转存
 */
export async function segmentCommodity(imageUrl: string): Promise<string> {
  const request = new $viapi.SegmentCommodityRequest({
    imageURL: imageUrl,
  });

  try {
    const resp = await client.segmentCommodity(request);
    const resultUrl = resp.body?.data?.imageURL;
    if (!resultUrl) {
      throw new SegmentError('SEGMENT_NO_SUBJECT', '未识别到商品主体');
    }
    return resultUrl;
  } catch (err: any) {
    if (err instanceof SegmentError) throw err;
    // 阿里云返回的错误码可能在 err.code 或 err.data.Code
    const code = err?.code || err?.data?.Code || '';
    if (code === 'InvalidImage.NoObject' || code === 'NoObjectDetected') {
      throw new SegmentError('SEGMENT_NO_SUBJECT', '未识别到商品主体');
    }
    console.error('[segment] viapi call failed:', err);
    throw new SegmentError('SEGMENT_API_FAILED', err?.message || 'viapi 调用失败');
  }
}
```

> **SDK 方法名提醒**: `@alicloud/viapi20230117` 的默认导出是 client 类,调用方法是实例的 `segmentCommodity(request)`。Request 类从 `* as $viapi` 的命名空间导入。如果导入报错,用 `console.log(Object.keys(viapi))` 打印确认实际导出结构,然后调整。

### 4.3 创建 API Route

路径: `app/api/segment/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  cosObjectExists,
  cosPutBuffer,
  cosPublicUrl,
} from '@/lib/cos';
import { segmentCommodity, SegmentError } from '@/lib/segment';

export const runtime = 'nodejs';
export const maxDuration = 60; // 抠图 API 有时会比较慢

interface SegmentSuccessResp {
  ok: true;
  imageUrl: string;
  cached: boolean;
}

interface SegmentErrorResp {
  ok: false;
  code: 'SEGMENT_NO_SUBJECT' | 'SEGMENT_API_FAILED' | 'UPLOAD_FAILED' | 'BAD_INPUT';
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const base64 = body?.imageBase64 as string | undefined;

    if (!base64 || typeof base64 !== 'string') {
      return NextResponse.json<SegmentErrorResp>(
        { ok: false, code: 'BAD_INPUT', message: 'imageBase64 必填' },
        { status: 400 },
      );
    }

    // 剥离 data URL 前缀 (如果有)
    const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');

    if (buffer.length === 0) {
      return NextResponse.json<SegmentErrorResp>(
        { ok: false, code: 'BAD_INPUT', message: '图片数据为空' },
        { status: 400 },
      );
    }

    // 图片大小限制 10MB (SegmentCommodity 单张限制 3MB, 但我们先校验一个宽松上限, 由服务端再压缩)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json<SegmentErrorResp>(
        { ok: false, code: 'BAD_INPUT', message: '图片超过 10MB' },
        { status: 400 },
      );
    }

    // 1. 计算 MD5
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');
    const cacheKey = `segment_cache/${md5}.png`;

    // 2. 查缓存
    const exists = await cosObjectExists(cacheKey);
    if (exists) {
      return NextResponse.json<SegmentSuccessResp>({
        ok: true,
        imageUrl: cosPublicUrl(cacheKey),
        cached: true,
      });
    }

    // 3. 原图上传到 uploads_temp/ (SegmentCommodity 只认 URL)
    const uploadKey = `uploads_temp/${md5}.jpg`;
    let uploadUrl: string;
    try {
      uploadUrl = await cosPutBuffer(uploadKey, buffer, 'image/jpeg');
    } catch (err) {
      console.error('[segment] upload temp failed:', err);
      return NextResponse.json<SegmentErrorResp>(
        { ok: false, code: 'UPLOAD_FAILED', message: '原图上传失败' },
        { status: 500 },
      );
    }

    // 4. 调用阿里云 SegmentCommodity
    let aliResultUrl: string;
    try {
      aliResultUrl = await segmentCommodity(uploadUrl);
    } catch (err) {
      if (err instanceof SegmentError) {
        return NextResponse.json<SegmentErrorResp>(
          { ok: false, code: err.code, message: err.message },
          { status: 422 },
        );
      }
      throw err;
    }

    // 5. 下载阿里云返回的 PNG
    let pngBuffer: Buffer;
    try {
      const resp = await fetch(aliResultUrl);
      if (!resp.ok) {
        throw new Error(`fetch ali result http ${resp.status}`);
      }
      pngBuffer = Buffer.from(await resp.arrayBuffer());
    } catch (err) {
      console.error('[segment] download ali result failed:', err);
      return NextResponse.json<SegmentErrorResp>(
        { ok: false, code: 'SEGMENT_API_FAILED', message: '抠图结果下载失败' },
        { status: 500 },
      );
    }

    // 6. 上传到 segment_cache/ (持久化)
    let cachedUrl: string;
    try {
      cachedUrl = await cosPutBuffer(cacheKey, pngBuffer, 'image/png');
    } catch (err) {
      console.error('[segment] upload cache failed:', err);
      return NextResponse.json<SegmentErrorResp>(
        { ok: false, code: 'UPLOAD_FAILED', message: '抠图结果存储失败' },
        { status: 500 },
      );
    }

    return NextResponse.json<SegmentSuccessResp>({
      ok: true,
      imageUrl: cachedUrl,
      cached: false,
    });
  } catch (err: any) {
    console.error('[segment] unexpected:', err);
    return NextResponse.json<SegmentErrorResp>(
      { ok: false, code: 'SEGMENT_API_FAILED', message: err?.message || '未知错误' },
      { status: 500 },
    );
  }
}
```

---

## 5. 前端 Taro 改造

### 5.1 新增 service 方法

路径: `src/services/segment.ts` (如果没有 services 目录就新建)

```typescript
import Taro from '@tarojs/taro';

const API_BASE = process.env.TARO_APP_API_BASE || 'https://public.feihan.cc';

export interface SegmentResult {
  ok: true;
  imageUrl: string;
  cached: boolean;
}

export interface SegmentFail {
  ok: false;
  code: 'SEGMENT_NO_SUBJECT' | 'SEGMENT_API_FAILED' | 'UPLOAD_FAILED' | 'BAD_INPUT';
  message: string;
}

/**
 * 读本地图片 → base64 → 调用 /api/segment → 返回抠图 URL
 */
export async function segmentImage(localFilePath: string): Promise<SegmentResult | SegmentFail> {
  // 1. 读本地文件为 base64
  const fs = Taro.getFileSystemManager();
  const base64: string = await new Promise((resolve, reject) => {
    fs.readFile({
      filePath: localFilePath,
      encoding: 'base64',
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(err),
    });
  });

  // 2. 调用后端
  try {
    const resp = await Taro.request({
      url: `${API_BASE}/api/segment`,
      method: 'POST',
      data: { imageBase64: base64 },
      header: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });
    return resp.data as SegmentResult | SegmentFail;
  } catch (err: any) {
    return {
      ok: false,
      code: 'SEGMENT_API_FAILED',
      message: err?.errMsg || '网络错误',
    };
  }
}
```

### 5.2 生成页调用点改造

找到当前调用 composer 合成的地方 (大概在 `src/pages/generating/*` 或类似路径),在合成之前插入抠图步骤:

```typescript
import { segmentImage } from '@/services/segment';

// 伪代码, 按实际文件结构改
async function handleGenerate(localImagePath: string, categoryId: string) {
  // Step 1: 抠图
  setLoadingText('正在抠出产品...');
  const segResult = await segmentImage(localImagePath);

  if (!segResult.ok) {
    const msgMap: Record<string, string> = {
      SEGMENT_NO_SUBJECT: '没识别到产品,换张清晰点的图试试',
      SEGMENT_API_FAILED: '抠图服务开小差了,请重试',
      UPLOAD_FAILED: '网络不稳定,请重试',
      BAD_INPUT: '图片格式有问题,请重新选择',
    };
    Taro.showModal({
      title: '抠图失败',
      content: msgMap[segResult.code] || segResult.message,
      showCancel: false,
      confirmText: '重新上传',
      success: () => {
        // 回到上传页
        Taro.navigateBack();
      },
    });
    return;
  }

  // Step 2: 用抠图 URL 走现有 composer 流程
  // (本次不改 composer, 把 segResult.imageUrl 作为"产品图 URL"传入即可)
  setLoadingText('正在合成品牌主图...');
  // ... 现有 composer 调用代码
}
```

### 5.3 小程序合法域名

登录微信公众平台 → 小程序后台 → 开发管理 → 服务器域名:

- **request 合法域名**: 加上 `https://public.feihan.cc` (如果已有就跳过)
- **downloadFile 合法域名**: 加上 `https://public.feihan.cc` (Canvas 合成需要下载抠图 PNG)

---

## 6. 自测 checklist

按顺序逐项验证,每项做完打勾:

- [ ] `.env.local` 变量已配齐,未提交到 git
- [ ] 腾讯 COS 的 `uploads_temp/` 生命周期规则已创建 (1 天 TTL)
- [ ] `pnpm dev` 启动 Next.js 无报错
- [ ] 用 Postman/curl 发一个本地 base64 测试 `/api/segment`:

```bash
# 准备一张电商风产品图 test.jpg
BASE64=$(base64 -i test.jpg | tr -d '\n')
curl -X POST http://localhost:3000/api/segment \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$BASE64\"}" | jq
```

- [ ] 返回 `{ ok: true, imageUrl: "https://public.feihan.cc/segment_cache/xxx.png", cached: false }`
- [ ] 浏览器打开返回的 URL,看到透明底的抠图结果
- [ ] 重新发同一张图,`cached` 变为 `true`,响应时间 < 500ms
- [ ] 发一张没有商品的图 (比如纯风景),返回 `{ ok: false, code: "SEGMENT_NO_SUBJECT" }`
- [ ] 小程序端调用 `segmentImage()`,在开发者工具 Network 看到请求和响应
- [ ] 小程序端抠图成功后,在生成页的 console.log 里看到抠图 URL
- [ ] 抠图失败时,弹窗文案正确,点"重新上传"能回到上传页

---

## 7. 不要做的事

- 不要改 composer.ts 的合成逻辑 (v6 prompt 会处理)
- 不要改模板 registry 或 productZone 配置
- 不要改生成页的 UI 布局,只改 loading 文案和错误处理
- 不要在前端直接调阿里云 SDK (AK 会泄漏)
- 不要用 FormData 上传 base64 (已经决定用 JSON body, 简单)
- 不要给 `segment_cache/` 前缀配 TTL (抠图结果是永久资产, 越攒越值钱)
- 不要在抠图成功后保留 `uploads_temp/` 的原图 (生命周期规则会自动清, 代码里不要主动删, 因为万一用户很快再次生成,可以省一次上传)

---

## 8. 后续 (v6 预告, 本次不做)

v6 会把 composer 从"宣纸卡片"模式切到 Premium 模式:

- 把 `segment_cache/{md5}.png` 的透明底产品图直接画到模板背景上
- 按 `productZone={cx, cy, maxW, maxH}` 缩放定位
- 加暖棕投影 `shadowColor: rgba(58,42,28,0.35), shadowBlur: 28, shadowOffsetY: 18`
- 保留宣纸卡片模式作为兜底渲染路径 (虽然 v5 API 失败直接报错, 但 composer 层保留 fallback 代码分支, 应对以后策略变更)

v6 开始之前,本文档的 checklist 必须全部打勾。
