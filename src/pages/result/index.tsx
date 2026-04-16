import { Image, Text, View } from "@tarojs/components"
import Taro, { useLoad } from "@tarojs/taro"

import { HuiButton } from "@/components/HuiButton"
import { HuiSeal } from "@/components/HuiSeal"
import { useGenerationStore } from "@/stores/generationStore"

export default function ResultPage() {
  const resultImage = useGenerationStore((s) => s.resultPath)
  const categoryName = useGenerationStore((s) => s.categoryName)
  const reset = useGenerationStore((s) => s.reset)

  useLoad(() => {
    if (!useGenerationStore.getState().resultPath) {
      void Taro.redirectTo({ url: "/pages/index/index" })
    }
  })

  const save = () => {
    const path = useGenerationStore.getState().resultPath
    if (!path) return
    void Taro.saveImageToPhotosAlbum({
      filePath: path,
      success: () => {
        void Taro.showToast({ title: "已保存", icon: "success" })
      },
      fail: () => {
        void Taro.showToast({ title: "请授权相册权限", icon: "none" })
      }
    })
  }

  const again = () => {
    reset()
    void Taro.redirectTo({ url: "/pages/upload/index" })
  }

  if (!resultImage) {
    return null
  }

  return (
    <View className="min-h-full bg-paper px-8 pb-10 pt-6">
      <Text className="font-serif text-headline text-ink">为您生成的品牌主图</Text>

      <View className="mt-10 flex flex-col items-center">
        <Image
          src={resultImage}
          mode="aspectFill"
          className="h-[686rpx] w-[686rpx] rounded border border-ink-mute shadow-soft"
        />
        <Text className="mt-6 font-sans text-body text-jade">✓ 已应用「田园徽州」品牌规范</Text>
        <Text className="mt-2 font-sans text-caption text-ink-mute">{categoryName ?? ""}</Text>
        <View className="mt-8">
          <HuiSeal size="sm" />
        </View>
      </View>

      <View className="mt-12 flex flex-row gap-6">
        <View className="flex-1">
          <HuiButton type="secondary" onClick={again}>
            重新生成
          </HuiButton>
        </View>
        <View className="flex-1">
          <HuiButton type="primary" onClick={save}>
            保存到相册
          </HuiButton>
        </View>
      </View>
    </View>
  )
}
