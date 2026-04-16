import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'

import { HuiButton } from '@/components/HuiButton'
import { CATEGORIES } from '@/constants/categories'
import { useProjectStore } from '@/stores/projectStore'

export default function CategoryPage() {
  const setCategory = useProjectStore((s) => s.setCategory)
  const savedCategory = useProjectStore((s) => s.category)
  const [selected, setSelected] = useState<string | null>(savedCategory)

  const goGenerate = () => {
    if (!selected) return
    void Taro.navigateTo({ url: '/pages/generating/index' })
  }

  return (
    <View className="min-h-full bg-paper pb-40 pt-6">
      <View className="px-8">
        <Text className="font-serif text-headline text-ink">这是什么产品？</Text>
        <Text className="mt-3 font-sans text-body text-ink-light">
          选择最接近的品类，让AI更懂你的产品
        </Text>

        <View className="mt-8 grid grid-cols-2 gap-6">
          {CATEGORIES.map((name) => {
            const isOn = selected === name
            return (
              <View
                key={name}
                className={`flex items-center justify-center rounded bg-paper-deep py-8 ${
                  isOn ? 'border-2 border-cinnabar' : 'border border-transparent'
                }`}
                hoverClass="opacity-80"
                onClick={() => {
                  setSelected(name)
                  setCategory(name)
                }}
              >
                <Text
                  className={`text-center font-serif text-subtitle text-ink ${
                    isOn ? 'font-semibold' : ''
                  }`}
                >
                  {name}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className="fixed bottom-0 left-0 right-0 bg-paper px-8 pb-10 pt-4 shadow-soft">
        <HuiButton type="primary" disabled={!selected} onClick={goGenerate}>
          开始生成
        </HuiButton>
      </View>
    </View>
  )
}
