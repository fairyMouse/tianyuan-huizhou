import { View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'

export default function Index() {

  useLoad(() => {
    console.log('Page loaded.')
  })

  return (
    <View className="bg-cinnabar text-paper text-headline p-8 rounded-lg">
      田园徽州 · 测试
    </View>
  )
}
