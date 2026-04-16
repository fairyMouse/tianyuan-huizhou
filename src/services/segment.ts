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

/**
 * wx.request max timeout is 60s; do not retry after client timeout — that only burns another 60s.
 * Retry only when the server returned a gateway error (quick response body).
 */
function isRetryableSegmentFailure(result: SegmentResultOk | SegmentFail, statusCode: number): boolean {
  if (result.ok) return false
  return statusCode === 504 || statusCode === 503 || statusCode === 502
}

async function fileSizeBytes(filePath: string): Promise<number | null> {
  try {
    const r = await Taro.getFileInfo({ filePath })
    if (r && typeof r === "object" && "size" in r && typeof (r as { size: unknown }).size === "number") {
      return (r as { size: number }).size
    }
    return null
  } catch {
    return null
  }
}

function logSegmentClient(payload: Record<string, unknown>) {
  console.log("[segmentClient]", payload)
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

async function compressForSegment(localPath: string): Promise<string> {
  try {
    const { tempFilePath } = await Taro.compressImage({
      src: localPath,
      quality: 82,
      compressedWidth: 1600
    })
    const out = tempFilePath || localPath
    logSegmentClient({
      step: "compressImage",
      ok: true,
      samePath: out === localPath,
      outPathTail: out.length > 48 ? `…${out.slice(-44)}` : out
    })
    return out
  } catch (err: unknown) {
    logSegmentClient({
      step: "compressImage",
      ok: false,
      err: err instanceof Error ? err.message : String(err)
    })
    return localPath
  }
}

export async function segmentImage(localFilePath: string): Promise<SegmentResultOk | SegmentFail> {
  const apiBase = API_BASE
  const bytesIn = await fileSizeBytes(localFilePath)
  let imgW: number | undefined
  let imgH: number | undefined
  try {
    const img = await Taro.getImageInfo({ src: localFilePath })
    imgW = img.width
    imgH = img.height
  } catch {
    /* ignore */
  }
  logSegmentClient({
    step: "start",
    apiBase,
    bytesIn,
    width: imgW,
    height: imgH,
    pathTail: localFilePath.length > 48 ? `…${localFilePath.slice(-44)}` : localFilePath
  })

  const path = await compressForSegment(localFilePath)
  const bytesAfterCompress = await fileSizeBytes(path)
  logSegmentClient({
    step: "afterCompress",
    bytesIn,
    bytesAfterCompress,
    ratio: bytesIn && bytesAfterCompress ? Number((bytesAfterCompress / bytesIn).toFixed(2)) : null,
    usedCompressedFile: path !== localFilePath
  })

  const fs = Taro.getFileSystemManager()
  const base64 = await new Promise<string>((resolve, reject) => {
    fs.readFile({
      filePath: path,
      encoding: "base64",
      success: (res) => resolve(res.data as string),
      fail: reject
    })
  })

  const base64Chars = base64.length
  const approxJsonBodyBytes = base64Chars + 40
  logSegmentClient({
    step: "beforeRequest",
    base64Chars,
    approxJsonBodyBytes,
    approxJsonBodyKB: Number((approxJsonBodyBytes / 1024).toFixed(1))
  })

  let { result, statusCode } = await postSegmentOnce(base64)
  if (isRetryableSegmentFailure(result, statusCode)) {
    logSegmentClient({ step: "retry502_504", statusCode })
    ;({ result, statusCode } = await postSegmentOnce(base64))
  }
  logSegmentClient({
    step: "done",
    ok: result.ok,
    statusCode,
    cached: result.ok ? result.cached : undefined,
    code: result.ok ? undefined : result.code
  })
  return result
}
