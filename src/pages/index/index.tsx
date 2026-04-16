import { Text, View } from "@tarojs/components"
import Taro from "@tarojs/taro"

import { HuiButton } from "@/components/HuiButton"
import { MountainDecor } from "@/components/MountainDecor"

export default function Index() {
  const goUpload = () => {
    void Taro.navigateTo({ url: "/pages/upload/index" })
  }

  return (
    <View className="bg-paper px-8 pb-12">
      <View className="flex flex-col items-center justify-center pt-32">
        <Text className="font-serif text-display text-ink">田园徽州 · AI</Text>
        <Text className="mt-6 text-center font-sans text-subtitle text-ink-light">
          为黟县农户的产品，赋予品牌的力量
        </Text>
        <View className="mt-10 w-full">
          <MountainDecor heightRpx={220} />
        </View>
      </View>
      <View className="mt-20 flex flex-col items-center">
        <HuiButton type="primary" onClick={goUpload} textClassName="font-serif text-subtitle">
          开始打造产品品牌
        </HuiButton>
        <Text className="mt-4 font-sans text-caption text-ink-mute">仅需一张照片，30秒生成</Text>
      </View>
    </View>
  )
}
