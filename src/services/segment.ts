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

function isRetryableSegmentFailure(
  result: SegmentResultOk | SegmentFail,
  statusCode: number,
  errMsg: string
): boolean {
  if (result.ok) return false
  const msg = `${errMsg} ${result.message}`.toLowerCase()
  if (statusCode === 504 || statusCode === 503 || statusCode === 502) return true
  if (msg.includes("timeout") || msg.includes("timed out")) return true
  if (msg.includes("request:fail") || msg.includes("fail connect")) return true
  return false
}

async function postSegmentOnce(
  base64: string
): Promise<{ result: SegmentResultOk | SegmentFail; statusCode: number; errMsg: string }> {
  let statusCode = 0
  let errMsg = ""
  try {
    const resp = await Taro.request({
      url: `${API_BASE}/api/segment`,
      method: "POST",
      data: { imageBase64: base64 },
      header: { "Content-Type": "application/json" },
      timeout: 60000
    })
    statusCode = resp.statusCode ?? 0
    const parsed = asResult(resp.data)
    if (parsed) return { result: parsed, statusCode, errMsg }
    return {
      result: {
        ok: false,
        code: "SEGMENT_API_FAILED",
        message: `HTTP ${statusCode}`
      },
      statusCode,
      errMsg
    }
  } catch (err: unknown) {
    const e = err as { errMsg?: string; data?: unknown }
    errMsg = e?.errMsg || "network error"
    const parsed = asResult(e?.data)
    if (parsed) return { result: parsed, statusCode, errMsg }
    return {
      result: { ok: false, code: "SEGMENT_API_FAILED", message: errMsg },
      statusCode,
      errMsg
    }
  }
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

  let { result, statusCode, errMsg } = await postSegmentOnce(base64)
  if (isRetryableSegmentFailure(result, statusCode, errMsg)) {
    ;({ result, statusCode, errMsg } = await postSegmentOnce(base64))
  }
  return result
}
