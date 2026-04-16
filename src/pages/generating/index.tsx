import { Canvas, Image, Text, View } from "@tarojs/components"
import Taro, { useLoad } from "@tarojs/taro"
import { useEffect, useState } from "react"

import { HuiButton } from "@/components/HuiButton"
import { useImageComposer } from "@/hooks/useImageComposer"
import { useGenerationStore } from "@/stores/generationStore"

import latticeUrl from "@/assets/lattice.svg"

const PROGRESS_LINES = [
  "正在解析产品轮廓...",
  "正在调和徽州色彩...",
  "正在合成品牌画面...",
  "即将完成..."
]

export default function GeneratingPage() {
  const { status, resultPath, error, compose } = useImageComposer()
  const setResultPath = useGenerationStore((s) => s.setResultPath)
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setLineIndex((i) => (i + 1) % PROGRESS_LINES.length)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  useLoad(() => {
    const { userImagePath, categoryId } = useGenerationStore.getState()
    if (!userImagePath || !categoryId) {
      void Taro.redirectTo({ url: "/pages/upload/index" })
      return
    }
    setTimeout(() => {
      void compose(userImagePath, categoryId)
    }, 50)
  })

  useEffect(() => {
    if (status === "success" && resultPath) {
      setResultPath(resultPath)
      void Taro.redirectTo({ url: "/pages/result/index" })
    }
  }, [resultPath, setResultPath, status])

  const failed = status === "error"

  const retry = () => {
    void Taro.redirectTo({ url: "/pages/upload/index" })
  }

  if (failed) {
    return (
      <View className="flex min-h-full flex-col items-center justify-center bg-paper px-8">
        <Text className="text-center font-sans text-body text-ink-light">
          {error || "生成遇到问题，请稍后再试"}
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
        id="composer-canvas"
        className="pointer-events-none fixed opacity-0"
        style={{ width: "1080px", height: "1080px", left: "-8000rpx", top: 0 }}
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
