import { create } from 'zustand'

interface UIState {
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  resourceDrawerOpen: boolean
  resourceDrawerView: 'books' | 'quotes'
  themeDrawerOpen: boolean
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleResourceDrawer: () => void
  openResourceDrawer: () => void
  closeResourceDrawer: () => void
  setResourceDrawerView: (view: 'books' | 'quotes') => void
  toggleThemeDrawer: () => void
  openThemeDrawer: () => void
  closeThemeDrawer: () => void
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  resourceDrawerOpen: false, // Default closed
  resourceDrawerView: 'quotes',
  themeDrawerOpen: false,
  toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
  toggleResourceDrawer: () => set((state) => ({ resourceDrawerOpen: !state.resourceDrawerOpen })),
  openResourceDrawer: () => set({ resourceDrawerOpen: true }),
  closeResourceDrawer: () => set({ resourceDrawerOpen: false }),
  setResourceDrawerView: (view) => set({ resourceDrawerView: view }),
  toggleThemeDrawer: () => set((state) => ({ themeDrawerOpen: !state.themeDrawerOpen })),
  openThemeDrawer: () => set({ themeDrawerOpen: true }),
  closeThemeDrawer: () => set({ themeDrawerOpen: false }),
}))
