import { Image, Text, View } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useState } from "react"

import { HuiButton } from "@/components/HuiButton"
import { useProjectStore } from "@/stores/projectStore"

export default function UploadPage() {
  const setProductImage = useProjectStore((s) => s.setProductImage)
  const existing = useProjectStore((s) => s.productImage)
  const [localPath, setLocalPath] = useState<string | null>(existing)

  const pickImage = () => {
    void Taro.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const path = res.tempFiles[0]?.tempFilePath
        if (path) {
          setLocalPath(path)
          setProductImage(path)
        }
      }
    })
  }

  const goCategory = () => {
    if (!localPath) return
    void Taro.navigateTo({ url: "/pages/category/index" })
  }

  return (
    <View className="min-h-full bg-paper px-8 pb-10 pt-6">
      <Text className="font-serif text-headline text-ink">上传产品照片</Text>
      <Text className="mt-3 font-sans text-body text-ink-light">
        建议在自然光下拍摄，背景简洁更佳
      </Text>

      <View
        className="relative mt-10 flex h-[40vh] items-center justify-center rounded border-2 border-dashed border-ink-mute bg-paper-deep"
        onClick={pickImage}
      >
        {localPath ? (
          <>
            <Image src={localPath} mode="aspectFit" className="h-full w-full rounded" />
            <View
              className="absolute right-4 top-4 rounded bg-paper px-3 py-2 active:opacity-70"
              hoverClass="opacity-70"
              onClick={(e) => {
                e.stopPropagation()
                pickImage()
              }}
            >
              <Text className="font-sans text-caption text-ink">重新选择</Text>
            </View>
          </>
        ) : (
          <View className="flex flex-col items-center">
            <Text className="text-title text-ink-light">相机</Text>
            <Text className="mt-4 text-center font-sans text-body text-ink-mute">
              点击拍照或从相册选择
            </Text>
          </View>
        )}
      </View>

      <View className="mt-12">
        <HuiButton type="primary" disabled={!localPath} onClick={goCategory}>
          下一步
        </HuiButton>
      </View>
    </View>
  )
}
