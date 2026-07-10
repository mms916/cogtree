import { create } from 'zustand'

export type SearchNavigationTarget = {
  requestId: number
  type: 'quote' | 'node' | 'knowledge'
  quoteId: string
  nodeId?: string
  knowledgeItemId?: string
}

interface UIState {
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  resourceDrawerOpen: boolean
  resourceDrawerView: 'books' | 'quotes'
  themeDrawerOpen: boolean
  searchNavigationTarget: SearchNavigationTarget | null
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleResourceDrawer: () => void
  openResourceDrawer: () => void
  closeResourceDrawer: () => void
  setResourceDrawerView: (view: 'books' | 'quotes') => void
  toggleThemeDrawer: () => void
  openThemeDrawer: () => void
  closeThemeDrawer: () => void
  requestSearchNavigation: (target: Omit<SearchNavigationTarget, 'requestId'>) => void
  clearSearchNavigation: (requestId?: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  resourceDrawerOpen: false, // Default closed
  resourceDrawerView: 'quotes',
  themeDrawerOpen: false,
  searchNavigationTarget: null,
  toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
  toggleResourceDrawer: () => set((state) => ({ resourceDrawerOpen: !state.resourceDrawerOpen })),
  openResourceDrawer: () => set({ resourceDrawerOpen: true }),
  closeResourceDrawer: () => set({ resourceDrawerOpen: false }),
  setResourceDrawerView: (view) => set({ resourceDrawerView: view }),
  toggleThemeDrawer: () => set((state) => ({ themeDrawerOpen: !state.themeDrawerOpen })),
  openThemeDrawer: () => set({ themeDrawerOpen: true }),
  closeThemeDrawer: () => set({ themeDrawerOpen: false }),
  requestSearchNavigation: (target) => set({
    searchNavigationTarget: {
      ...target,
      requestId: Date.now(),
    },
  }),
  clearSearchNavigation: (requestId) => set((state) => {
    if (typeof requestId === 'number' && state.searchNavigationTarget?.requestId !== requestId) return state
    return { searchNavigationTarget: null }
  }),
}))
