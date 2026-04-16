import { Image, View } from '@tarojs/components'
import type { FC } from 'react'

import mountainUrl from '@/assets/mountain-decor.svg'

export interface MountainDecorProps {
  heightRpx?: number
  className?: string
}

export const MountainDecor: FC<MountainDecorProps> = ({
  heightRpx = 200,
  className = '',
}) => {
  return (
    <View className={`w-full opacity-60 ${className}`} style={{ height: `${heightRpx}rpx` }}>
      <Image src={mountainUrl} mode="aspectFill" className="h-full w-full" />
    </View>
  )
}
