import Taro from '@tarojs/taro'

import template1 from '@/assets/templates/template-1.png'
import template2 from '@/assets/templates/template-2.png'
import template3 from '@/assets/templates/template-3.png'
import template4 from '@/assets/templates/template-4.png'
import { CATEGORIES } from '@/constants/categories'

const TEMPLATES = [template1, template2, template3, template4]

export interface ComposeCanvasEnv {
  canvas: any
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  dpr: number
}

let activeComposeEnv: ComposeCanvasEnv | null = null

export function attachComposeSurface(env: ComposeCanvasEnv): void {
  activeComposeEnv = env
}

export function detachComposeSurface(): void {
  activeComposeEnv = null
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function templateIndexForCategory(category: string): number {
  const i = CATEGORIES.indexOf(category as (typeof CATEGORIES)[number])
  const idx = i >= 0 ? i : 0
  return idx % TEMPLATES.length
}

function loadCanvasImage(canvas: any, src: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = canvas.createImage()
    img.onload = () => resolve(img)
    img.onerror = (e: unknown) => reject(e)
    img.src = src
  })
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: any,
  cw: number,
  ch: number,
) {
  const iw = img.width
  const ih = img.height
  const ir = iw / ih
  const cr = cw / ch
  let dw: number
  let dh: number
  let ox: number
  let oy: number
  if (ir > cr) {
    dh = ch
    dw = iw * (ch / ih)
    ox = (cw - dw) / 2
    oy = 0
  } else {
    dw = cw
    dh = ih * (cw / iw)
    ox = 0
    oy = (ch - dh) / 2
  }
  ctx.drawImage(img, ox, oy, dw, dh)
}

function drawContainInBox(
  ctx: CanvasRenderingContext2D,
  img: any,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
) {
  const iw = img.width
  const ih = img.height
  const scale = Math.min(boxW / iw, boxH / ih)
  const dw = iw * scale
  const dh = ih * scale
  const ox = boxX + (boxW - dw) / 2
  const oy = boxY + (boxH - dh) / 2
  const shadowOff = 6
  ctx.save()
  ctx.fillStyle = 'rgba(44, 44, 44, 0.12)'
  ctx.fillRect(ox + shadowOff, oy + shadowOff, dw, dh)
  ctx.restore()
  ctx.drawImage(img, ox, oy, dw, dh)
}

function drawSeal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.save()
  ctx.fillStyle = '#EBE4D8'
  ctx.strokeStyle = '#A8362A'
  ctx.lineWidth = Math.max(2, size * 0.04)
  ctx.fillRect(x, y, size, size)
  ctx.strokeRect(x, y, size, size)
  ctx.fillStyle = '#A8362A'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${Math.floor(size * 0.22)}px sans-serif`
  ctx.fillText('田园', x + size / 2, y + size * 0.38)
  ctx.fillText('徽州', x + size / 2, y + size * 0.68)
  ctx.restore()
}

export async function composeImage(
  env: ComposeCanvasEnv,
  productImage: string,
  category: string,
): Promise<string> {
  const { canvas, ctx, width, height } = env
  const tplSrc = TEMPLATES[templateIndexForCategory(category)]

  const bg = await loadCanvasImage(canvas, tplSrc)
  const product = await loadCanvasImage(canvas, productImage)

  ctx.clearRect(0, 0, width, height)
  drawCover(ctx, bg, width, height)

  const pad = width * 0.12
  const boxSize = width - pad * 2
  drawContainInBox(ctx, product, pad, pad, boxSize, boxSize)

  const sealSize = Math.floor(width * 0.18)
  const margin = width * 0.04
  drawSeal(ctx, width - sealSize - margin, height - sealSize - margin, sealSize)

  return new Promise((resolve, reject) => {
    Taro.canvasToTempFilePath({
      canvas,
      width,
      height,
      destWidth: width * env.dpr,
      destHeight: height * env.dpr,
      fileType: 'png',
      quality: 1,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(err),
    })
  })
}

export async function generateImage(
  productImage: string,
  category: string,
): Promise<string> {
  await delay(3000)
  if (!activeComposeEnv) {
    throw new Error('Compose canvas is not ready')
  }
  return composeImage(activeComposeEnv, productImage, category)
}
