export const TEMPLATE_CDN_BASE = "https://public.feihan.cc/templates"

export function getTemplateCdnUrl(relPath: string): string {
  // Keep behavior predictable for both `a/b.png` and `/a/b.png`.
  const cleaned = relPath.replace(/^\/+/, "")
  return `${TEMPLATE_CDN_BASE}/${cleaned}`
}

