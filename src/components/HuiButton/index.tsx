import { Text, View } from "@tarojs/components"
import type { FC } from "react"

export interface HuiButtonProps {
  type?: "primary" | "secondary"
  disabled?: boolean
  loading?: boolean
  onClick: () => void
  children: React.ReactNode
  /** Extra classes for label (e.g. font-serif) */
  textClassName?: string
}

export const HuiButton: FC<HuiButtonProps> = ({
  type = "primary",
  disabled = false,
  loading = false,
  onClick,
  children,
  textClassName = ""
}) => {
  const isPrimary = type === "primary"
  const inactive = disabled || loading
  const fontCls = textClassName || "font-sans"

  return (
    <View
      className={
        isPrimary
          ? `flex items-center justify-center rounded py-5 px-8 ${
              inactive ? "bg-cinnabar opacity-40" : "bg-cinnabar active:opacity-70"
            }`
          : `flex items-center justify-center rounded border-2 border-huizhou bg-transparent py-5 px-8 ${
              inactive ? "opacity-40" : "active:opacity-70"
            }`
      }
      hoverClass={inactive ? "" : "opacity-70"}
      onClick={() => {
        if (!inactive) onClick()
      }}
    >
      {loading ? (
        <Text className={`${fontCls} text-body ${isPrimary ? "text-paper" : "text-ink"}`}>...</Text>
      ) : (
        <Text
          className={`${fontCls} text-body font-medium ${isPrimary ? "text-paper" : "text-ink"}`}
        >
          {children}
        </Text>
      )}
    </View>
  )
}
