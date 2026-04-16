import Taro from "@tarojs/taro"

import type { TemplateMeta } from "@/constants/templates"

export interface ComposeParams {
  canvasId: string
  template: TemplateMeta
  userImagePath: string
  productName: string
  productPinyin: string
  brandText?: string
}

const OUTPUT_SIZE = 1080

interface CanvasContext {
  canvas: any
  ctx: CanvasRenderingContext2D
}

export async function composeMainImage(params: ComposeParams): Promise<string> {
  const { canvasId, template, userImagePath, productName, productPinyin, brandText = "田园徽州" } = params
  const { canvas, ctx } = await getCanvasContext(canvasId)

  await drawImage(canvas, ctx, template.path, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

  const { cx, cy, maxW, maxH } = template.productZone
  const cardW = OUTPUT_SIZE * maxW
  const cardH = OUTPUT_SIZE * maxH
  const cardX = OUTPUT_SIZE * cx - cardW / 2
  const cardY = OUTPUT_SIZE * cy - cardH / 2

  await drawCutoutProduct(canvas, ctx, userImagePath, cardX, cardY, cardW, cardH)
  drawTextBlock(ctx, productName, productPinyin, template, cardX, cardY, cardW, cardH)
  drawSeal(ctx, brandText, cardX, cardY, cardW, cardH)

  return canvasToTempFilePath(canvasId, canvas)
}

async function getCanvasContext(canvasId: string): Promise<CanvasContext> {
  return new Promise((resolve, reject) => {
    Taro.createSelectorQuery()
      .select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        const node = res?.[0]?.node
        if (!node) {
          reject(new Error("Canvas not found"))
          return
        }
        node.width = OUTPUT_SIZE
        node.height = OUTPUT_SIZE
        const ctx = node.getContext("2d") as CanvasRenderingContext2D
        ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
        resolve({ canvas: node, ctx })
      })
  })
}

async function drawImage(
  canvas: any,
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  // Resolve remote template URLs into a local file path so canvas can render reliably.
  // On iOS weChat, remote templates may fail to load directly by canvas.
  if (src.startsWith("http")) {
    try {
      const imageInfo = await Taro.getImageInfo({ src })
      await drawImageFromPath(canvas, ctx, imageInfo.path, x, y, width, height)
      return
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e)
      throw new Error(`Template imageInfo failed: ${msg}`)
    }
  }

  await drawImageFromPath(canvas, ctx, src, x, y, width, height)
}

async function drawCutoutProduct(
  canvas: any,
  ctx: CanvasRenderingContext2D,
  src: string,
  zoneX: number,
  zoneY: number,
  zoneW: number,
  zoneH: number
): Promise<void> {
  const imageInfo = await Taro.getImageInfo({ src })
  const imageRatio = imageInfo.width / imageInfo.height
  const boxRatio = zoneW / zoneH

  let drawW = zoneW
  let drawH = zoneH
  let drawX = zoneX
  let drawY = zoneY

  if (imageRatio > boxRatio) {
    drawH = zoneW / imageRatio
    drawY = zoneY + (zoneH - drawH) / 2
  } else {
    drawW = zoneH * imageRatio
    drawX = zoneX + (zoneW - drawW) / 2
  }

  if (canvas && typeof canvas.createImage === "function") {
    await new Promise<void>((resolve, reject) => {
      const img = canvas.createImage()
      img.onload = () => {
        ctx.save()
        ctx.shadowColor = "rgba(58, 42, 28, 0.35)"
        ctx.shadowBlur = 28
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 18
        ctx.drawImage(img, drawX, drawY, drawW, drawH)
        ctx.restore()
        resolve()
      }
      img.onerror = () => reject(new Error("Image load failed"))
      img.src = imageInfo.path
    })
    return
  }

  ctx.save()
  ctx.shadowColor = "rgba(58, 42, 28, 0.35)"
  ctx.shadowBlur = 28
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 18
  await drawImageFromPath(canvas, ctx, imageInfo.path, drawX, drawY, drawW, drawH)
  ctx.restore()
}

async function drawImageFromPath(
  canvas: any,
  ctx: CanvasRenderingContext2D,
  localPath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  if (canvas && typeof canvas.createImage === "function") {
    await new Promise<void>((resolve, reject) => {
      const img = canvas.createImage()
      img.onload = () => {
        ctx.drawImage(img, x, y, width, height)
        resolve()
      }
      img.onerror = () => reject(new Error("Image load failed"))
      img.src = localPath
    })
    return
  }

  // Compatibility fallback for runtimes without canvas.createImage.
  ctx.drawImage(localPath as unknown as CanvasImageSource, x, y, width, height)
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  name: string,
  pinyin: string,
  template: TemplateMeta,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number
): void {
  ctx.save()

  const centerX = cardX + cardW / 2
  const baseY = template.textPosition === "top" ? cardY - 180 : cardY + cardH + 60

  ctx.strokeStyle = "#C8A063"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(centerX - 80, baseY)
  ctx.lineTo(centerX + 80, baseY)
  ctx.stroke()

  ctx.fillStyle = template.textColor
  ctx.font = '500 60px "Noto Serif SC", serif'
  ctx.textAlign = "center"
  ctx.textBaseline = "top"

  const chars = name.split("")
  const charSpacing = 20
  const charWidths = chars.map((char) => ctx.measureText(char).width)
  const totalWidth = charWidths.reduce((sum, width) => sum + width, 0) + charSpacing * (chars.length - 1)
  let currentX = centerX - totalWidth / 2
  chars.forEach((char, index) => {
    ctx.fillText(char, currentX + charWidths[index] / 2, baseY + 28)
    currentX += charWidths[index] + charSpacing
  })

  ctx.font = '400 20px "Noto Sans SC", sans-serif'
  ctx.fillStyle = template.textColor === "#F5F0E8" ? "rgba(245, 240, 232, 0.60)" : "rgba(44, 44, 44, 0.45)"
  ctx.fillText(pinyin, centerX, baseY + 110)

  ctx.strokeStyle = "#C8A063"
  ctx.beginPath()
  ctx.moveTo(centerX - 30, baseY + 150)
  ctx.lineTo(centerX + 30, baseY + 150)
  ctx.stroke()

  ctx.restore()
}

function drawSeal(
  ctx: CanvasRenderingContext2D,
  text: string,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number
): void {
  const sealSize = 70
  const sealX = cardX + cardW / 2 + 110
  const sealY = cardY + cardH + 150

  ctx.save()
  ctx.globalAlpha = 0.92
  ctx.fillStyle = "#A8362A"
  ctx.fillRect(sealX, sealY, sealSize, sealSize)

  ctx.globalAlpha = 1
  ctx.fillStyle = "#F5F0E8"
  ctx.font = `600 ${Math.floor(sealSize * 0.26)}px "Noto Serif SC", serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text.slice(0, 2), sealX + sealSize / 2, sealY + sealSize * 0.32)
  ctx.fillText(text.slice(2, 4), sealX + sealSize / 2, sealY + sealSize * 0.68)
  ctx.restore()
}

async function canvasToTempFilePath(canvasId: string, canvas: any): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.canvasToTempFilePath({
      canvasId,
      canvas,
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
      destWidth: OUTPUT_SIZE,
      destHeight: OUTPUT_SIZE,
      fileType: "jpg",
      quality: 0.92,
      success: (res) => resolve(res.tempFilePath),
      fail: () => reject(new Error("Canvas export failed"))
    })
  })
}
