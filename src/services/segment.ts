import Taro from "@tarojs/taro"

const API_BASE = TARO_APP_API_BASE.replace(/\/$/, "")

export interface SegmentResultOk {
  ok: true
  imageUrl: string
  cached: boolean
}

export interface SegmentFail {
  ok: false
  code: "SEGMENT_NO_SUBJECT" | "SEGMENT_API_FAILED" | "UPLOAD_FAILED" | "BAD_INPUT"
  message: string
}

function asResult(data: unknown): SegmentResultOk | SegmentFail | null {
  if (!data || typeof data !== "object") return null
  const o = data as Record<string, unknown>
  if (o.ok === true && typeof o.imageUrl === "string" && typeof o.cached === "boolean") {
    return { ok: true, imageUrl: o.imageUrl, cached: o.cached }
  }
  if (o.ok === false && typeof o.code === "string" && typeof o.message === "string") {
    return { ok: false, code: o.code as SegmentFail["code"], message: o.message }
  }
  return null
}

export async function segmentImage(localFilePath: string): Promise<SegmentResultOk | SegmentFail> {
  const fs = Taro.getFileSystemManager()
  const base64 = await new Promise<string>((resolve, reject) => {
    fs.readFile({
      filePath: localFilePath,
      encoding: "base64",
      success: (res) => resolve(res.data as string),
      fail: reject
    })
  })

  try {
    const resp = await Taro.request({
      url: `${API_BASE}/api/segment`,
      method: "POST",
      data: { imageBase64: base64 },
      header: { "Content-Type": "application/json" },
      timeout: 60000
    })
    const parsed = asResult(resp.data)
    if (parsed) return parsed
    const status = resp.statusCode ?? 0
    return {
      ok: false,
      code: "SEGMENT_API_FAILED",
      message: `HTTP ${status}`
    }
  } catch (err: unknown) {
    const e = err as { errMsg?: string; data?: unknown }
    const parsed = asResult(e?.data)
    if (parsed) return parsed
    return {
      ok: false,
      code: "SEGMENT_API_FAILED",
      message: e?.errMsg || "network error"
    }
  }
}
