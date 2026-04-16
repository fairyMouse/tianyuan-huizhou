import { create } from "zustand"

import type { CategoryId } from "@/constants/categories"

interface GenerationState {
  userImagePath: string | null
  categoryId: CategoryId | null
  categoryName: string | null
  resultPath: string | null
  setUserImagePath: (path: string) => void
  setCategory: (categoryId: CategoryId, categoryName: string) => void
  setResultPath: (path: string) => void
  reset: () => void
}

export const useGenerationStore = create<GenerationState>((set) => ({
  userImagePath: null,
  categoryId: null,
  categoryName: null,
  resultPath: null,
  setUserImagePath: (path) => set({ userImagePath: path }),
  setCategory: (categoryId, categoryName) => set({ categoryId, categoryName }),
  setResultPath: (path) => set({ resultPath: path }),
  reset: () => set({ userImagePath: null, categoryId: null, categoryName: null, resultPath: null })
}))
