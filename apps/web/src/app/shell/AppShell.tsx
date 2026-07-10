import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Library,
  Book,
  Quote,
  Network,
  GitMerge,
  History,
  Wrench,
  Search,
  Settings,
  ChevronLeft,
  LogOut,
  PanelLeftOpen
} from 'lucide-react'

import { useUIStore } from '../../stores/useUIStore'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { ResourceDrawer } from '../../modules/shared/ResourceDrawer'

const DEFAULT_BOOK_TREE_ID = 'bc858d59-e1cc-4c07-95f7-6c4b7f395001'
const navItems = [
  { to: '/app/theme-library', label: '主题库', icon: Library },
  { to: '/app/books', label: '书籍', icon: Book },
  { to: '/app/quotes', label: '金句', icon: Quote, isDrawerTrigger: true },
  { to: '/app/book-tree/:bookId', label: '结构整理', icon: Network },
  { to: '/app/theme-tree', label: '主题整理', icon: GitMerge, isThemeDrawerTrigger: true },
  { to: '/app/reviews', label: '复盘', icon: History },
]

const toolItems = [
  { to: '/app/tools', label: '工具', icon: Wrench },
  { to: '/app/search', label: '搜索', icon: Search },
  { to: '/app/settings', label: '设置', icon: Settings },
]

const DEFAULT_AVATAR_URL = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2232%22 fill=%22%23f6d8c9%22/%3E%3Ccircle cx=%2232%22 cy=%2228%22 r=%2212%22 fill=%22%23f8efe8%22/%3E%3Cpath d=%22M18 59c2-12 8-19 14-19s12 7 14 19%22 fill=%22%232b7a78%22/%3E%3Cpath d=%22M20 25c1-10 7-16 15-14 7 2 10 8 9 16-6-5-14-6-24-2z%22 fill=%22%23524742%22/%3E%3Ccircle cx=%2227%22 cy=%2229%22 r=%222%22 fill=%22%2334231f%22/%3E%3Ccircle cx=%2238%22 cy=%2229%22 r=%222%22 fill=%22%2334231f%22/%3E%3Cpath d=%22M27 36c3 3 8 3 11 0%22 fill=%22none%22 stroke=%22%23b56b5d%22 stroke-width=%222%22 stroke-linecap=%22round%22/%3E%3C/svg%3E'

export function AppShell() {
  const {
    resourceDrawerOpen,
    themeDrawerOpen,
    toggleResourceDrawer,
    closeResourceDrawer,
    toggleThemeDrawer,
    openThemeDrawer,
    closeThemeDrawer
  } = useUIStore()
  const selectedBookId = useLibraryStore((state) => state.selectedBookId)
  const user = useAuthStore((state) => state.user)
  const initialized = useAuthStore((state) => state.initialized)
  const initialize = useAuthStore((state) => state.initialize)
  const logout = useAuthStore((state) => state.logout)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const activeBookTreeId = selectedBookId && selectedBookId.includes('-') ? selectedBookId : DEFAULT_BOOK_TREE_ID
  // Handle click outside to close drawer
  useEffect(() => {
    if (!initialized) {
      void initialize()
    }
  }, [initialize, initialized])

  useEffect(() => {
    if (initialized && !user) {
      navigate('/login', { replace: true, state: { from: location.pathname } })
    }
  }, [initialized, location.pathname, navigate, user])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resourceDrawerOpen && drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        // Don't close if clicking on the nav item that toggles it
        const isTrigger = (event.target as Element).closest('[data-drawer-trigger="true"]')
        if (!isTrigger) {
          closeResourceDrawer()
        }
      }
      if (themeDrawerOpen) {
        const target = event.target as Element
        const isThemeTrigger = target.closest('[data-theme-drawer-trigger="true"]')
        const isThemeDrawer = target.closest('[data-theme-drawer="true"]')
        if (!isThemeTrigger && !isThemeDrawer) {
          closeThemeDrawer()
        }
      }
      if (isAccountMenuOpen && accountRef.current && !accountRef.current.contains(event.target as Node)) {
        const isAccountTrigger = (event.target as Element).closest('[data-account-trigger="true"]')
        if (!isAccountTrigger) {
          setIsAccountMenuOpen(false)
        }
      }
    }

    // Use pointerdown to ensure it captures all types of clicks (mouse/touch) before other elements react
    document.addEventListener('pointerdown', handleClickOutside)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [closeResourceDrawer, closeThemeDrawer, isAccountMenuOpen, resourceDrawerOpen, themeDrawerOpen])

  useEffect(() => {
    if (!location.pathname.startsWith('/app/quotes') && resourceDrawerOpen) {
      closeResourceDrawer()
    }
    if (!location.pathname.startsWith('/app/theme-tree') && themeDrawerOpen) {
      closeThemeDrawer()
    }
  }, [closeResourceDrawer, closeThemeDrawer, location.pathname, resourceDrawerOpen, themeDrawerOpen])

  const handleNavClick = (e: React.MouseEvent, item: any) => {
    if (item.isDrawerTrigger) {
      e.preventDefault() // Prevent navigation if we just want to open drawer
      closeThemeDrawer()
      if (location.pathname !== item.to) {
         navigate(item.to) // Navigate if not on the page
         if (!resourceDrawerOpen) toggleResourceDrawer()
      } else {
         toggleResourceDrawer() // Toggle if already on the page
      }
    } else if (item.isThemeDrawerTrigger) {
      e.preventDefault()
      closeResourceDrawer()
      if (!location.pathname.startsWith('/app/theme-tree')) {
        navigate(item.to)
        openThemeDrawer()
      } else {
        toggleThemeDrawer()
      }
    } else {
      closeResourceDrawer() // Close drawer when navigating to other pages
      closeThemeDrawer()
    }
  }

  const handleLogout = async () => {
    await logout()
    closeResourceDrawer()
    closeThemeDrawer()
    navigate('/login', { replace: true })
  }

  if (!initialized || !user) {
    return (
      <div className="app-shell-loading">
        <GitMerge size={24} />
        <span>正在进入工作台...</span>
      </div>
    )
  }

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-canvas)', position: 'relative' }}>
      <aside 
        className="primary-sidebar" 
        style={{ 
          width: isSidebarOpen ? '72px' : '0', 
          opacity: isSidebarOpen ? 1 : 0,
          borderRight: isSidebarOpen ? '1px solid var(--border-color)' : 'none', 
          background: 'var(--bg-dark)',
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          padding: isSidebarOpen ? '20px 0' : '20px 0', 
          flexShrink: 0,
          zIndex: 100,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          position: 'relative'
        }}
      >
        <div className="brand">
          <div style={{ background: 'var(--accent-color)', borderRadius: '50%', padding: '4px', marginBottom: '4px' }}>
             <GitMerge size={20} color="#090b10" />
          </div>
          CogTree
        </div>

        <div className="nav-group">
          {navItems.map((item) => (
            (() => {
              const itemTo = item.to === '/app/book-tree/:bookId'
                ? `/app/book-tree/${activeBookTreeId}`
                : item.to
              return (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              key={item.label}
              to={itemTo}
              onClick={(e) => handleNavClick(e, item)}
              data-drawer-trigger={item.isDrawerTrigger}
              data-theme-drawer-trigger={item.isThemeDrawerTrigger}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
              )
            })()
          ))}
        </div>

        <div className="nav-tools">
          {toolItems.map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              key={item.to}
              to={item.to}
              onClick={() => {
                closeResourceDrawer()
                closeThemeDrawer()
                setIsAccountMenuOpen(false)
              }}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
          <button
            className="icon-btn sidebar-edge-collapse"
            onClick={() => setIsSidebarOpen(false)}
            title="收起侧边栏"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="sidebar-account" ref={accountRef}>
            <button
              type="button"
              className="sidebar-account-card"
              title={user.displayName}
              data-account-trigger="true"
              aria-expanded={isAccountMenuOpen}
              onClick={() => setIsAccountMenuOpen((current) => !current)}
            >
              <img className="sidebar-profile-photo" src={DEFAULT_AVATAR_URL} alt="" />
              <span className="sidebar-profile-meta">
                <span className="sidebar-profile-name">{user.displayName}</span>
              </span>
            </button>
            {isAccountMenuOpen && (
              <div className="sidebar-account-menu">
                <div className="sidebar-account-info">
                  <img className="sidebar-account-avatar" src={DEFAULT_AVATAR_URL} alt="" />
                  <div>
                    <div className="sidebar-account-name">{user.displayName}</div>
                    <div className="sidebar-account-email">{user.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="sidebar-account-action"
                  onClick={() => {
                    setIsAccountMenuOpen(false)
                    navigate('/app/settings')
                  }}
                >
                  <Settings size={14} />
                  账号设置
                </button>
                <button type="button" className="sidebar-account-action is-danger" onClick={handleLogout}>
                  <LogOut size={14} />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Floating Toggle Button (when sidebar is closed) */}
      {!isSidebarOpen && (
        <button
          className="icon-btn sidebar-open-toggle"
          onClick={() => setIsSidebarOpen(true)}
          title="展开侧边栏"
        >
          <PanelLeftOpen size={14} />
        </button>
      )}
      
      {/* Global Resource Drawer */}
      <div 
        ref={drawerRef}
        style={{ 
          position: 'absolute', 
          left: isSidebarOpen ? '72px' : '0',
          top: 0, 
          bottom: 0, 
          zIndex: 90,
          transform: resourceDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: resourceDrawerOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
          pointerEvents: resourceDrawerOpen ? 'auto' : 'none' // Prevent clicks when hidden
        }}
      >
        <ResourceDrawer />
      </div>
      
      <main className="workspace-area">
        <Outlet />
      </main>
    </div>
  )
}
