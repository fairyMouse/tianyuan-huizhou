import { create } from 'zustand'

interface ProjectState {
  productImage: string | null
  category: string | null
  resultImage: string | null

  setProductImage: (img: string) => void
  setCategory: (cat: string) => void
  setResultImage: (img: string) => void
  reset: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  productImage: null,
  category: null,
  resultImage: null,
  setProductImage: (img) => set({ productImage: img }),
  setCategory: (cat) => set({ category: cat }),
  setResultImage: (img) => set({ resultImage: img }),
  reset: () => set({ productImage: null, category: null, resultImage: null }),
}))
