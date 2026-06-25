import { create } from 'zustand'

interface HistoryState {
  undoStack: string[]
  redoStack: string[]
  pushUndo: (entry: string) => void
  clearRedo: () => void
}

export const useHistoryStore = create<HistoryState>((set) => ({
  undoStack: [],
  redoStack: [],
  pushUndo: (entry) =>
    set((state) => ({
      undoStack: [...state.undoStack, entry],
      redoStack: [],
    })),
  clearRedo: () => set({ redoStack: [] }),
}))
