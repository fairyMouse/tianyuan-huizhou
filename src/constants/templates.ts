import { CATEGORIES, type CategoryId } from "@/constants/categories"

import elegantMistyMountains01 from "@/assets/templates/elegant/elegant-misty-mountains-01.png.png"
import elegantMistyMountains02 from "@/assets/templates/elegant/elegant-misty-mountains-02.png"
import elegantRicePaper01 from "@/assets/templates/elegant/elegant-rice-paper-01.png"
import elegantRicePaper02 from "@/assets/templates/elegant/elegant-rice-paper-02.png"
import elegantTeaZen01 from "@/assets/templates/elegant/elegant-tea-zen-01.png"
import elegantTeaZen02 from "@/assets/templates/elegant/elegant-tea-zen-02.png"
import festiveRedChinese01 from "@/assets/templates/festive/festive-red-chinese-01.png .png"
import festiveRedChinese02 from "@/assets/templates/festive/festive-red-chinese-02.png .png"
import festiveWindowLattice01 from "@/assets/templates/festive/festive-window-lattice-01.png"
import festiveWindowLattice02 from "@/assets/templates/festive/festive-window-lattice-02.png"
import rusticOldHouseTable01 from "@/assets/templates/rustic/rustic-old-house-table-01.png"
import rusticOldHouseTable02 from "@/assets/templates/rustic/rustic-old-house-table-02.png"
import template1 from "@/assets/templates/template-1.png"
import template2 from "@/assets/templates/template-2.png"

export interface TemplateMeta {
  id: string
  promptType: string
  style: "elegant" | "rustic" | "festive" | "modern" | "universal"
  path: string
  productZone: {
    cx: number
    cy: number
    maxW: number
    maxH: number
  }
  textColor: "#2C2C2C" | "#F5F0E8"
  textPosition: "top" | "bottom"
}

const DEFAULT_ZONES: Record<string, Omit<TemplateMeta, "id" | "promptType" | "style" | "path">> = {
  "elegant-misty-mountains": {
    productZone: { cx: 0.5, cy: 0.62, maxW: 0.5, maxH: 0.4 },
    textColor: "#2C2C2C",
    textPosition: "bottom"
  },
  "elegant-rice-paper": {
    productZone: { cx: 0.5, cy: 0.55, maxW: 0.55, maxH: 0.45 },
    textColor: "#2C2C2C",
    textPosition: "bottom"
  },
  "elegant-tea-zen": {
    productZone: { cx: 0.5, cy: 0.55, maxW: 0.5, maxH: 0.42 },
    textColor: "#2C2C2C",
    textPosition: "bottom"
  },
  "rustic-old-house-table": {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.55, maxH: 0.45 },
    textColor: "#2C2C2C",
    textPosition: "bottom"
  },
  "rustic-stone-pottery": {
    productZone: { cx: 0.5, cy: 0.55, maxW: 0.5, maxH: 0.42 },
    textColor: "#2C2C2C",
    textPosition: "bottom"
  },
  "rustic-bamboo-weave": {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.5, maxH: 0.42 },
    textColor: "#2C2C2C",
    textPosition: "bottom"
  },
  "festive-red-chinese": {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.5, maxH: 0.42 },
    textColor: "#F5F0E8",
    textPosition: "bottom"
  },
  "festive-window-lattice": {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.45, maxH: 0.4 },
    textColor: "#F5F0E8",
    textPosition: "bottom"
  },
  "modern-minimal-geo": {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.55, maxH: 0.5 },
    textColor: "#2C2C2C",
    textPosition: "bottom"
  },
  "universal-seal-rubbing": {
    productZone: { cx: 0.5, cy: 0.5, maxW: 0.55, maxH: 0.5 },
    textColor: "#2C2C2C",
    textPosition: "bottom"
  }
}

function createTemplate(
  id: string,
  promptType: string,
  style: TemplateMeta["style"],
  path: string
): TemplateMeta {
  return {
    id,
    promptType,
    style,
    path,
    ...DEFAULT_ZONES[promptType]
  }
}

export const TEMPLATE_REGISTRY: Record<string, TemplateMeta[]> = {
  "elegant-misty-mountains": [
    createTemplate("elegant-misty-mountains-01", "elegant-misty-mountains", "elegant", elegantMistyMountains01),
    createTemplate("elegant-misty-mountains-02", "elegant-misty-mountains", "elegant", elegantMistyMountains02)
  ],
  "elegant-rice-paper": [
    createTemplate("elegant-rice-paper-01", "elegant-rice-paper", "elegant", elegantRicePaper01),
    createTemplate("elegant-rice-paper-02", "elegant-rice-paper", "elegant", elegantRicePaper02)
  ],
  "elegant-tea-zen": [
    createTemplate("elegant-tea-zen-01", "elegant-tea-zen", "elegant", elegantTeaZen01),
    createTemplate("elegant-tea-zen-02", "elegant-tea-zen", "elegant", elegantTeaZen02)
  ],
  "rustic-old-house-table": [
    createTemplate("rustic-old-house-table-01", "rustic-old-house-table", "rustic", rusticOldHouseTable01),
    createTemplate("rustic-old-house-table-02", "rustic-old-house-table", "rustic", rusticOldHouseTable02)
  ],
  "rustic-stone-pottery": [],
  "rustic-bamboo-weave": [],
  "festive-red-chinese": [
    createTemplate("festive-red-chinese-01", "festive-red-chinese", "festive", festiveRedChinese01),
    createTemplate("festive-red-chinese-02", "festive-red-chinese", "festive", festiveRedChinese02)
  ],
  "festive-window-lattice": [
    createTemplate("festive-window-lattice-01", "festive-window-lattice", "festive", festiveWindowLattice01),
    createTemplate("festive-window-lattice-02", "festive-window-lattice", "festive", festiveWindowLattice02)
  ],
  "modern-minimal-geo": [createTemplate("modern-minimal-geo-01", "modern-minimal-geo", "modern", template2)],
  "universal-seal-rubbing": [
    createTemplate("universal-seal-rubbing-01", "universal-seal-rubbing", "universal", template1)
  ]
}

export function pickTemplate(categoryId: CategoryId): TemplateMeta {
  const category = CATEGORIES.find((item) => item.id === categoryId)
  if (!category) {
    throw new Error(`Unknown category: ${categoryId}`)
  }

  const availableTypes = category.templates.filter((type) => (TEMPLATE_REGISTRY[type] ?? []).length > 0)
  if (availableTypes.length > 0) {
    const promptType = availableTypes[Math.floor(Math.random() * availableTypes.length)]
    const variants = TEMPLATE_REGISTRY[promptType]
    return variants[Math.floor(Math.random() * variants.length)]
  }

  const fallback = TEMPLATE_REGISTRY["universal-seal-rubbing"] ?? []
  if (fallback.length > 0) {
    return fallback[Math.floor(Math.random() * fallback.length)]
  }

  throw new Error(`No templates available for category ${categoryId}`)
}
