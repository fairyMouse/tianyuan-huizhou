import { useCallback, useState } from "react"
import { Text, View } from "@tarojs/components"
import Taro from "@tarojs/taro"

import { HuiButton } from "@/components/HuiButton"
import { MountainDecor } from "@/components/MountainDecor"

const API_ROOT = TARO_APP_API_BASE.replace(/\/$/, "")

export default function Index() {
  const [apiPingLine, setApiPingLine] = useState<string | null>(null)

  const goUpload = () => {
    void Taro.navigateTo({ url: "/pages/upload/index" })
  }

  const pingApiRoot = useCallback(async () => {
    const url = `${API_ROOT}/`
    setApiPingLine("…")
    console.log("[apiHealth] start", { url })
    try {
      const res = await Taro.request({
        url,
        method: "GET",
        timeout: 15000
      })
      const raw = res.data
      const body =
        typeof raw === "string" ? raw : JSON.stringify(raw)
      const line = `HTTP ${res.statusCode} ${body}`
      setApiPingLine(line)
      console.log("[apiHealth] ok", { statusCode: res.statusCode, data: raw })
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "errMsg" in err
          ? String((err as { errMsg: string }).errMsg)
          : err instanceof Error
            ? err.message
            : String(err)
      setApiPingLine(`fail: ${msg}`)
      console.log("[apiHealth] fail", err)
    }
  }, [])

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
        <Text className="mt-4 font-sans text-caption text-ink-mute">仅需一张照片，10秒生成</Text>
        <View className="mt-8 w-full max-w-[600px] self-stretch">
          <Text
            className="font-sans text-caption text-ink-mute underline"
            onClick={() => void pingApiRoot()}
          >
            测试 API 根路径连通（GET /）
          </Text>
          {apiPingLine !== null ? (
            <Text
              selectable
              className="mt-2 break-all font-mono text-[22px] leading-snug text-ink-light"
            >
              {apiPingLine}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}
