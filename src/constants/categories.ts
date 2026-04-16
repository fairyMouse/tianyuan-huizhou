export const CATEGORIES = [
  {
    id: "xiangfei",
    name: "黟县香榧",
    pinyin: "YIXIAN XIANGFEI",
    templates: ["rustic-bamboo-weave", "rustic-old-house-table"]
  },
  {
    id: "doufu",
    name: "腊八豆腐",
    pinyin: "LABA DOUFU",
    templates: ["rustic-stone-pottery", "rustic-old-house-table"]
  },
  {
    id: "sixisanbao",
    name: "泗溪三宝",
    pinyin: "SIXI SANBAO",
    templates: ["rustic-old-house-table", "festive-red-chinese"]
  },
  {
    id: "heicha",
    name: "徽州黑茶",
    pinyin: "HUIZHOU HEICHA",
    templates: ["elegant-tea-zen", "elegant-misty-mountains", "elegant-rice-paper"]
  },
  {
    id: "sungan",
    name: "黟县笋干",
    pinyin: "YIXIAN SUNGAN",
    templates: ["rustic-bamboo-weave", "rustic-stone-pottery"]
  },
  {
    id: "fengmi",
    name: "山地蜂蜜",
    pinyin: "SHANDI FENGMI",
    templates: ["elegant-rice-paper", "elegant-misty-mountains"]
  },
  {
    id: "chayou",
    name: "古法茶油",
    pinyin: "GUFA CHAYOU",
    templates: ["rustic-old-house-table", "rustic-stone-pottery"]
  },
  {
    id: "huotui",
    name: "徽州火腿",
    pinyin: "HUIZHOU HUOTUI",
    templates: ["festive-red-chinese", "festive-window-lattice"]
  },
  {
    id: "zhuzhipin",
    name: "竹制品",
    pinyin: "ZHUZHIPIN",
    templates: ["rustic-bamboo-weave", "modern-minimal-geo"]
  },
  {
    id: "qita",
    name: "其他特产",
    pinyin: "TESE TECHAN",
    templates: ["universal-seal-rubbing", "rustic-old-house-table"]
  }
] as const

export type CategoryId = (typeof CATEGORIES)[number]["id"]
