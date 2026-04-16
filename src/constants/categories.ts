export const CATEGORIES = [
  "黟县香榧",
  "腊八豆腐",
  "泗溪三宝",
  "徽州黑茶",
  "黟县笋干",
  "山地蜂蜜",
  "古法茶油",
  "徽州火腿",
  "竹制品",
  "其他特产"
] as const

export type CategoryId = (typeof CATEGORIES)[number]
