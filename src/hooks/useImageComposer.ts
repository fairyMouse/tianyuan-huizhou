import { useState } from "react"

import { CATEGORIES, type CategoryId } from "@/constants/categories"
import { pickTemplate } from "@/constants/templates"
import { composeMainImage } from "@/services/composer"

type Status = "idle" | "composing" | "success" | "error"

export function useImageComposer() {
  const [status, setStatus] = useState<Status>("idle")
  const [resultPath, setResultPath] = useState("")
  const [error, setError] = useState("")

  async function compose(userImagePath: string, categoryId: CategoryId) {
    setStatus("composing")
    setError("")
    try {
      const template = pickTemplate(categoryId)
      const category = CATEGORIES.find((item) => item.id === categoryId)
      if (!category) {
        throw new Error("Unknown category")
      }
      const tempPath = await composeMainImage({
        canvasId: "composer-canvas",
        template,
        userImagePath,
        productName: category.name,
        productPinyin: category.pinyin
      })
      setResultPath(tempPath)
      setStatus("success")
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : ""
      const message =
        rawMessage.includes("createImage") || rawMessage.includes("Image load")
          ? "图片处理失败，请重试或更换图片"
          : "合成失败，请重试"
      setError(message)
      setStatus("error")
    }
  }

  function reset() {
    setStatus("idle")
    setResultPath("")
    setError("")
  }

  return { status, resultPath, error, compose, reset }
}
