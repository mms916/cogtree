import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderGit2, Plus, Search, Trash2, Pencil, GitMerge } from 'lucide-react'

import { fetchJson } from '../lib/api'

type ThemeLibraryResponse = {
  success: true
  data: Array<{
    themeId: string
    themeName: string
    cardCount: number
    importedCount: number
    nodeCount?: number
    updatedAt?: string | null
  }>
}

type ThemeManageResponse = {
  success: true
  data: {
    themeId: string
    themeName: string
    activeTreeId: string
    activeVersion: number
  }
}

export function ThemeLibraryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [newThemeName, setNewThemeName] = useState('')
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['theme-library'],
    queryFn: () => fetchJson<ThemeLibraryResponse>('/theme-library'),
    refetchOnMount: 'always'
  })

  const themes = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const items = data?.data ?? []
    if (!keyword) return items
    return items.filter((theme) => theme.themeName.toLowerCase().includes(keyword))
  }, [data?.data, search])

  const createTheme = useMutation({
    mutationFn: (themeId: string) => fetchJson<ThemeManageResponse>('/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId })
    }),
    onSuccess: async (response) => {
      setNewThemeName('')
      await queryClient.invalidateQueries({ queryKey: ['theme-library'] })
      await queryClient.invalidateQueries({ queryKey: ['theme-list'] })
      navigate(`/app/theme-tree/${encodeURIComponent(response.data.themeId)}`)
    }
  })

  const renameTheme = useMutation({
    mutationFn: ({ oldThemeId, nextThemeId }: { oldThemeId: string; nextThemeId: string }) => fetchJson<ThemeManageResponse>(
      `/themes/${encodeURIComponent(oldThemeId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: nextThemeId })
      }
    ),
    onSuccess: async (response) => {
      setEditingThemeId(null)
      setEditingValue('')
      await queryClient.invalidateQueries({ queryKey: ['theme-library'] })
      await queryClient.invalidateQueries({ queryKey: ['theme-list'] })
      navigate(`/app/theme-tree/${encodeURIComponent(response.data.themeId)}`)
    }
  })

  const deleteTheme = useMutation({
    mutationFn: (themeId: string) => fetchJson<{ success: true; data: { themeId: string } }>(
      `/themes/${encodeURIComponent(themeId)}`,
      { method: 'DELETE' }
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['theme-library'] })
      await queryClient.invalidateQueries({ queryKey: ['theme-list'] })
    }
  })

  const handleCreate = () => {
    const themeName = newThemeName.trim()
    if (!themeName) return
    createTheme.mutate(themeName)
  }

  const handleRename = (themeId: string) => {
    const nextThemeId = editingValue.trim()
    if (!nextThemeId || nextThemeId === themeId) {
      setEditingThemeId(null)
      setEditingValue('')
      return
    }
    renameTheme.mutate({ oldThemeId: themeId, nextThemeId })
  }

  return (
    <div className="workspace-area" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <header className="top-bar">
        <div className="breadcrumbs">
          <span className="current">主题库</span>
        </div>
        <div className="top-bar-actions">
          <div className="search-box" style={{ width: 280, marginRight: 12 }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="搜索主题..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="search-box" style={{ width: 220, marginRight: 8 }}>
            <Plus size={16} />
            <input
              type="text"
              placeholder="新建主题"
              value={newThemeName}
              onChange={(event) => setNewThemeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate()
              }}
            />
          </div>
          <button className="primary" onClick={handleCreate} disabled={!newThemeName.trim() || createTheme.isPending}>
            <Plus size={16} /> 新建
          </button>
        </div>
      </header>

      <div style={{ padding: '32px 48px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              全部主题
            </h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              共 {themes.length} 个主题，可进入主题整理继续修剪与合并
            </p>
          </div>
        </div>

        {isLoading && (
          <div style={{ color: 'var(--text-muted)', padding: '28px 0' }}>正在加载主题...</div>
        )}

        {isError && (
          <div style={{ color: '#fca5a5', padding: '28px 0' }}>主题库加载失败，请检查后端服务。</div>
        )}

        {!isLoading && !isError && themes.length === 0 && (
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              background: 'rgba(12, 16, 24, 0.72)',
              padding: 28,
              color: 'var(--text-muted)'
            }}
          >
            暂无主题，先从结构整理页提取主题，或在右上角新建一个主题。
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16
          }}
        >
          {themes.map((theme) => (
            <div
              key={theme.themeId}
              className="book-grid-card"
              onClick={() => navigate(`/app/theme-tree/${encodeURIComponent(theme.themeId)}`)}
              style={{
                minHeight: 148,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 52,
                    height: 64,
                    borderRadius: 6,
                    background: 'rgba(45, 212, 191, 0.1)',
                    border: '1px solid rgba(45, 212, 191, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-color)',
                    flexShrink: 0
                  }}
                >
                  <FolderGit2 size={24} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingThemeId === theme.themeId ? (
                    <input
                      value={editingValue}
                      autoFocus
                      onChange={(event) => setEditingValue(event.target.value)}
                      onBlur={() => handleRename(theme.themeId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleRename(theme.themeId)
                        if (event.key === 'Escape') {
                          setEditingThemeId(null)
                          setEditingValue('')
                        }
                      }}
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        width: '100%',
                        background: 'var(--bg-dark)',
                        border: '1px solid var(--accent-color)',
                        color: 'var(--text-primary)',
                        borderRadius: 4,
                        padding: '5px 8px',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>
                      {theme.themeName}
                    </h3>
                  )}
                  <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.8 }}>
                    <div>主题卡 {theme.cardCount} 张</div>
                    <div>已吸收 {theme.importedCount} 张</div>
                    <div>节点 {theme.nodeCount ?? 0} 个</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <button
                  type="button"
                  className="text-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    navigate(`/app/theme-tree/${encodeURIComponent(theme.themeId)}`)
                  }}
                >
                  <GitMerge size={14} /> 整理
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="icon-btn"
                    title="重命名"
                    onClick={(event) => {
                      event.stopPropagation()
                      setEditingThemeId(theme.themeId)
                      setEditingValue(theme.themeName)
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="删除主题"
                    onClick={(event) => {
                      event.stopPropagation()
                      if (window.confirm(`确定要删除主题「${theme.themeName}」吗？`)) {
                        deleteTheme.mutate(theme.themeId)
                      }
                    }}
                    style={{ color: '#f87171' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
