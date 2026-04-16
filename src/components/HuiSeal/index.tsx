import { Text, View } from '@tarojs/components'
import type { FC } from 'react'

export interface HuiSealProps {
  className?: string
  size?: 'sm' | 'md'
}

export const HuiSeal: FC<HuiSealProps> = ({
  className = '',
  size = 'md',
}) => {
  const box = size === 'md' ? 'h-24 w-24' : 'h-16 w-16'
  const textSize = size === 'md' ? 'text-caption' : 'text-[18rpx]'

  return (
    <View
      className={`flex flex-col items-center justify-center border-2 border-cinnabar bg-paper-deep ${box} ${className}`}
    >
      <Text className={`font-serif ${textSize} leading-tight text-cinnabar`}>
        田园
      </Text>
      <Text className={`font-serif ${textSize} leading-tight text-cinnabar`}>
        徽州
      </Text>
    </View>
  )
}
