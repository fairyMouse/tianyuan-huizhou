import { Canvas, Image, Text, View } from "@tarojs/components"
import Taro, { useLoad } from "@tarojs/taro"
import { useEffect, useState } from "react"

import { HuiButton } from "@/components/HuiButton"
import { attachComposeSurface, detachComposeSurface, generateImage } from "@/services/api"
import { useProjectStore } from "@/stores/projectStore"

import latticeUrl from "@/assets/lattice.svg"

const PROGRESS_LINES = [
  "正在解析产品轮廓...",
  "正在调和徽州色彩...",
  "正在合成品牌画面...",
  "即将完成..."
]

export default function GeneratingPage() {
  const setResultImage = useProjectStore((s) => s.setResultImage)
  const [lineIndex, setLineIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setLineIndex((i) => (i + 1) % PROGRESS_LINES.length)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  useLoad(() => {
    const { productImage, category } = useProjectStore.getState()
    if (!productImage || !category) {
      void Taro.redirectTo({ url: "/pages/upload/index" })
      return
    }

    const run = () => {
      const query = Taro.createSelectorQuery()
      query
        .select("#compose-canvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          const el = res[0] as { node: any; width: number; height: number } | undefined
          if (!el?.node) {
            setFailed(true)
            return
          }
          const canvas = el.node
          const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null
          if (!ctx) {
            setFailed(true)
            return
          }
          const dpr = Taro.getSystemInfoSync().pixelRatio || 1
          const w = el.width
          const h = el.height
          canvas.width = w * dpr
          canvas.height = h * dpr
          ctx.scale(dpr, dpr)

          attachComposeSurface({
            canvas,
            ctx,
            width: w,
            height: h,
            dpr
          })

          void generateImage(productImage, category)
            .then((path) => {
              setResultImage(path)
              detachComposeSurface()
              void Taro.redirectTo({ url: "/pages/result/index" })
            })
            .catch(() => {
              detachComposeSurface()
              setFailed(true)
            })
        })
    }

    setTimeout(run, 50)
  })

  const retry = () => {
    setFailed(false)
    void Taro.redirectTo({ url: "/pages/upload/index" })
  }

  if (failed) {
    return (
      <View className="flex min-h-full flex-col items-center justify-center bg-paper px-8">
        <Text className="text-center font-sans text-body text-ink-light">
          生成遇到问题，请稍后再试
        </Text>
        <View className="mt-10 w-full">
          <HuiButton type="primary" onClick={retry}>
            返回重试
          </HuiButton>
        </View>
      </View>
    )
  }

  return (
    <View className="relative flex min-h-full flex-col items-center justify-center bg-paper px-8">
      <Canvas
        type="2d"
        id="compose-canvas"
        className="pointer-events-none fixed opacity-0"
        style={{ width: "750rpx", height: "750rpx", left: "-8000rpx", top: 0 }}
      />
      <Image src={latticeUrl} className="h-32 w-32 animate-hui-spin" mode="aspectFit" />
      <Text className="mt-10 text-center font-serif text-title text-ink">
        正在为您的产品赋予徽韵
      </Text>
      <Text className="mt-6 text-center font-sans text-body text-ink-mute">
        {PROGRESS_LINES[lineIndex]}
      </Text>
    </View>
  )
}
