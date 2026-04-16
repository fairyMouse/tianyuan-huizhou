import { useState } from "react"

import { CATEGORIES, type CategoryId } from "@/constants/categories"
import { pickTemplate } from "@/constants/templates"
import { composeMainImage } from "@/services/composer"

type Status = "idle" | "composing" | "success" | "error"

export function useImageComposer() {
  const [status, setStatus] = useState<Status>("idle")
  const [resultPath, setResultPath] = useState("")
  const [error, setError] = useState("")
  const [errorReason, setErrorReason] = useState("")

  async function compose(userImagePath: string, categoryId: CategoryId) {
    setStatus("composing")
    setError("")
    setErrorReason("")
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
      const rawMessage =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : err && typeof err === "object"
              ? // Some WeChat/Taro runtime errors are not `Error` instances.
                // Try to preserve the most useful field.
                (err as { message?: unknown }).message
                  ? String((err as { message?: unknown }).message)
                  : JSON.stringify(err)
              : ""

      // Keep the original error for debugging in devtools.
      // eslint-disable-next-line no-console
      console.error("[composeMainImage failed]", err)
      const message =
        rawMessage.includes("createImage") || rawMessage.includes("Image load")
          ? "图片处理失败，请重试或更换图片"
          : "合成失败，请重试"
      setError(message)
      // Keep a small, user-visible reason for debugging.
      setErrorReason(rawMessage ? rawMessage.slice(0, 120) : "")
      setStatus("error")
    }
  }

  function reset() {
    setStatus("idle")
    setResultPath("")
    setError("")
    setErrorReason("")
  }

  return { status, resultPath, error, errorReason, compose, reset }
}
