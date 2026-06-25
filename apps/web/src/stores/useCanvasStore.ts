import { create } from 'zustand'

interface CanvasState {
  selection: string[]
  zoom: number
  setSelection: (selection: string[]) => void
  setZoom: (zoom: number) => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  selection: [],
  zoom: 1,
  setSelection: (selection) => set({ selection }),
  setZoom: (zoom) => set({ zoom }),
}))
