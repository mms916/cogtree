import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Search,
  Filter,
  Check,
  Save,
  Pencil,
  Trash2,
  Undo2,
  Redo2,
  Share2,
  Download,
  ChevronDown,
  ChevronUp,
  Plus,
  LayoutTemplate,
  Minus,
  Maximize
} from 'lucide-react'

import { CanvasExportMenu } from '../components/CanvasExportMenu'
import { FocusTimerButton } from '../components/FocusTimerButton'
import { fetchJson } from '../lib/api'
import { downloadMarkdownFile, downloadTreeImage } from '../lib/treeExport'
import { CanvasWorkspace } from '../modules/canvas/CanvasWorkspace'
import { NodeKnowledgePanel } from '../modules/canvas/NodeKnowledgePanel'
import type { BaseNode } from '../stores/useDocumentStore'
import { useDocumentStore } from '../stores/useDocumentStore'
import { useUIStore } from '../stores/useUIStore'

type ThemeTreeResponse = {
  success: true
  data: {
    treeId: string
    themeId: string
    version: number
    rootNodeIds: string[]
    nodes: Record<string, BaseNode>
    meta?: {
      importedThemeCardIds?: string[]
      queueTrayMinimized?: boolean
    }
  }
}

type ThemeContextResponse = {
  success: true
  data: {
    themeId: string
    themeName: string
    activeTreeId: string
    activeVersion: number
    selectedSourceBookIds: string[]
    crossBookConnectionCount: number
    pendingVerifyCount: number
  }
}

type ThemeListResponse = {
  success: true
  data: Array<{
    themeId: string
    themeName: string
    cardCount: number
    importedCount: number
    updatedAt?: string | null
  }>
}

type ThemeCardItem = {
  themeCardId: string
  themeId: string
  sourceBookId: string
  sourceNodeId: string
  title: string
  nodeCount: number
  queueStatus: string
  sourceBookTitle: string
  sourceBookAuthor: string
  treeSnapshot: {
    nodes: Record<string, BaseNode>
    rootNodeIds: string[]
  } | null
}

type ThemeCardsResponse = {
  success: true
  data: {
    items: ThemeCardItem[]
  }
}

export function ThemeTreePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { themeId } = useParams<{ themeId?: string }>()
  const themeDrawerOpen = useUIStore((state) => state.themeDrawerOpen)
  const activeThemeId = useMemo(() => {
    if (!themeId) return null
    try {
      return decodeURIComponent(themeId)
    } catch {
      return themeId
    }
  }, [themeId])
  const activeThemePath = activeThemeId ? encodeURIComponent(activeThemeId) : null
  const [, setSelectedNodeId] = useState<string | null>(null)
  const [knowledgeNodeId, setKnowledgeNodeId] = useState<string | null>(null)
  const lastKnowledgeToggleRef = useRef<{ nodeId: string | null; timestamp: number }>({ nodeId: null, timestamp: 0 })
  const [isThemeQueueTrayMinimized, setIsThemeQueueTrayMinimized] = useState(true)
  const [isThemeCardDragging, setIsThemeCardDragging] = useState(false)
  const [importedThemeCardIds, setImportedThemeCardIds] = useState<string[]>([])
  const [isImportedThemePocketOpen, setIsImportedThemePocketOpen] = useState(false)
  const [restoreThemeCardMenu, setRestoreThemeCardMenu] = useState<{ cardId: string; x: number; y: number } | null>(null)
  const [themeSearch, setThemeSearch] = useState('')
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null)
  const [themeEditValue, setThemeEditValue] = useState('')
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const [themeSaveState, setThemeSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [activeThemeTree, setActiveThemeTree] = useState<{
    treeId: string
    themeId: string
    version: number
  } | null>(null)
  const {
    nodes,
    rootNodeIds,
    undoStack,
    redoStack,
    setTree,
    clearNodes,
    createNode,
    deleteNode,
    updateNodeLabel,
    updateNodeMeta,
    updateNodeNotes,
    undo,
    redo
  } = useDocumentStore()
  const flowProjectRef = useRef<ReactFlowInstance['screenToFlowPosition'] | null>(null)
  const themeDropZoneRef = useRef<HTMLDivElement | null>(null)
  const suppressThemeCardClickRef = useRef(false)
  const themeTreeRequestSequenceRef = useRef(0)
  const lastKnowledgeNodeRef = useRef<BaseNode | null>(null)
  
  const liveKnowledgeNode = knowledgeNodeId ? nodes[knowledgeNodeId] : null
  const knowledgeNode = knowledgeNodeId ? liveKnowledgeNode ?? lastKnowledgeNodeRef.current : null
  useEffect(() => {
    if (liveKnowledgeNode) {
      lastKnowledgeNodeRef.current = liveKnowledgeNode
    }
    if (!knowledgeNodeId) {
      lastKnowledgeNodeRef.current = null
    }
  }, [knowledgeNodeId, liveKnowledgeNode])
  const exportTitle = `${activeThemeId ?? '未选择主题'}-主题整理`

  const handleExportMarkdownOutline = () => {
    downloadMarkdownFile(nodes, rootNodeIds, { title: exportTitle })
    setIsExportMenuOpen(false)
  }

  const handleExportMarkdownKnowledge = () => {
    downloadMarkdownFile(nodes, rootNodeIds, {
      title: exportTitle,
      includeKnowledge: true
    })
    setIsExportMenuOpen(false)
  }

  const handleExportImage = async (resolution: '2k' | '4k') => {
    try {
      await downloadTreeImage(nodes, rootNodeIds, exportTitle, resolution)
    } catch (error) {
      console.warn('Failed to export theme tree image.', error)
    } finally {
      setIsExportMenuOpen(false)
    }
  }

  const handleNodeInfoOpen = useCallback((nodeId: string) => {
    const now = performance.now()
    setKnowledgeNodeId((currentNodeId) => {
      const nodeSnapshot = useDocumentStore.getState().nodes[nodeId]
      if (nodeSnapshot) {
        lastKnowledgeNodeRef.current = nodeSnapshot
      }
      const lastToggle = lastKnowledgeToggleRef.current
      if (currentNodeId === nodeId) {
        if (lastToggle.nodeId === nodeId && now - lastToggle.timestamp < 1600) {
          return currentNodeId
        }
        lastKnowledgeToggleRef.current = { nodeId, timestamp: now }
        return null
      }

      lastKnowledgeToggleRef.current = { nodeId, timestamp: now }
      return nodeId
    })
  }, [])

  useEffect(() => {
    if (themeSaveState === 'idle' || themeSaveState === 'saving') return
    const timeoutId = window.setTimeout(() => setThemeSaveState('idle'), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [themeSaveState])

  const handleSaveThemeTree = useCallback(async () => {
    if (!activeThemeTree) return

    setThemeSaveState('saving')
    const storeState = useDocumentStore.getState()
    const requestSequence = ++themeTreeRequestSequenceRef.current

    try {
      const response = await fetchJson<ThemeTreeResponse>(`/theme-trees/${activeThemeTree.treeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeId: activeThemeTree.themeId,
          rootNodeIds: storeState.rootNodeIds,
          nodes: storeState.nodes,
          meta: {
            importedThemeCardIds,
            queueTrayMinimized: isThemeQueueTrayMinimized
          }
        })
      })

      if (requestSequence !== themeTreeRequestSequenceRef.current) return
      setTree(response.data.treeId, response.data.nodes, response.data.rootNodeIds, response.data.version)
      setActiveThemeTree({
        treeId: response.data.treeId,
        themeId: response.data.themeId,
        version: response.data.version
      })
      setImportedThemeCardIds(response.data.meta?.importedThemeCardIds ?? importedThemeCardIds)
      setIsThemeQueueTrayMinimized(response.data.meta?.queueTrayMinimized ?? isThemeQueueTrayMinimized)
      setThemeSaveState('saved')
    } catch (error) {
      console.warn('Failed to save theme tree.', error)
      setThemeSaveState('error')
    }
  }, [activeThemeTree, importedThemeCardIds, isThemeQueueTrayMinimized, setTree])

  useEffect(() => {
    if (typeof window === 'undefined' || !activeThemeId) return
    window.localStorage.setItem('cogtree-last-theme-id', activeThemeId)
  }, [activeThemeId])

  const { data: themeList } = useQuery({
    queryKey: ['theme-list'],
    queryFn: () => fetchJson<ThemeListResponse>('/themes'),
  })

  const { data: themeContext } = useQuery({
    queryKey: ['theme-context', activeThemeId],
    queryFn: () => fetchJson<ThemeContextResponse>(`/themes/${activeThemePath}/context`),
    enabled: Boolean(activeThemePath),
  })

  const { data: themeTree } = useQuery({
    queryKey: ['theme-tree', themeContext?.data.activeTreeId],
    queryFn: () => fetchJson<ThemeTreeResponse>(`/theme-trees/${themeContext?.data.activeTreeId}`),
    enabled: Boolean(themeContext?.data.activeTreeId)
  })

  const {
    data: themeCards,
    isLoading: isThemeCardsLoading,
    isError: isThemeCardsError,
    refetch: refetchThemeCards,
  } = useQuery({
    queryKey: ['theme-cards', activeThemeId],
    queryFn: () => fetchJson<ThemeCardsResponse>(`/themes/${activeThemePath}/cards`),
    enabled: Boolean(activeThemePath),
    refetchOnMount: 'always',
    retry: 2,
  })

  useEffect(() => {
    if (!activeThemeId) {
      clearNodes()
      setSelectedNodeId(null)
      setKnowledgeNodeId(null)
      setImportedThemeCardIds([])
      setIsImportedThemePocketOpen(false)
      setActiveThemeTree(null)
      return
    }
    if (!themeTree?.data) return
    setTree(themeTree.data.treeId, themeTree.data.nodes, themeTree.data.rootNodeIds, themeTree.data.version)
    setImportedThemeCardIds(themeTree.data.meta?.importedThemeCardIds ?? [])
    setIsThemeQueueTrayMinimized(themeTree.data.meta?.queueTrayMinimized ?? true)
    setActiveThemeTree({
      treeId: themeTree.data.treeId,
      themeId: themeTree.data.themeId,
      version: themeTree.data.version
    })
  }, [activeThemeId, clearNodes, setTree, themeTree?.data])

  useEffect(() => {
    if (!restoreThemeCardMenu) return
    const closeMenu = () => setRestoreThemeCardMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [restoreThemeCardMenu])

  const themeItems = useMemo(
    () => themeList?.data ?? [],
    [themeList?.data]
  )
  const filteredThemeItems = useMemo(
    () => themeItems.filter((item) => item.themeName.toLowerCase().includes(themeSearch.trim().toLowerCase())),
    [themeItems, themeSearch]
  )
  useEffect(() => {
    if (activeThemeId || themeItems.length === 0) return

    const storedThemeId = typeof window === 'undefined'
      ? null
      : window.localStorage.getItem('cogtree-last-theme-id')
    const nextTheme = themeItems.find((item) => item.themeId === storedThemeId)
      ?? themeItems.find((item) => item.cardCount > 0)
      ?? themeItems[0]

    if (nextTheme) {
      navigate(`/app/theme-tree/${encodeURIComponent(nextTheme.themeId)}`, { replace: true })
    }
  }, [activeThemeId, navigate, themeItems])

  const queueCards = useMemo(
    () => themeCards?.data.items ?? [],
    [themeCards?.data.items]
  )
  const visibleThemeCards = useMemo(
    () => queueCards.filter((card) => card.queueStatus === 'queued_for_theme_tree' && !importedThemeCardIds.includes(card.themeCardId)),
    [importedThemeCardIds, queueCards]
  )
  const importedThemeCards = useMemo(
    () => importedThemeCardIds
      .map((cardId) => queueCards.find((card) => card.themeCardId === cardId))
      .filter((card): card is ThemeCardItem => Boolean(card)),
    [importedThemeCardIds, queueCards]
  )
  const themeCardsCountLabel = isThemeCardsLoading
    ? '加载中...'
    : isThemeCardsError
      ? '加载失败'
      : `${visibleThemeCards.length} 张`

  const refreshThemes = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['theme-list'] })
    if (activeThemeId) {
      await queryClient.invalidateQueries({ queryKey: ['theme-context', activeThemeId] })
      await queryClient.invalidateQueries({ queryKey: ['theme-cards', activeThemeId] })
    }
  }, [activeThemeId, queryClient])

  const handleCreateTheme = useCallback(async () => {
    try {
      const response = await fetchJson<ThemeContextResponse>('/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: '新主题' })
      })
      await queryClient.invalidateQueries({ queryKey: ['theme-list'] })
      setEditingThemeId(response.data.themeId)
      setThemeEditValue(response.data.themeName)
      navigate(`/app/theme-tree/${encodeURIComponent(response.data.themeId)}`)
    } catch (error) {
      console.warn('Failed to create theme.', error)
      alert('创建主题失败，请稍后再试。')
    }
  }, [navigate, queryClient])

  const startEditTheme = useCallback((themeIdToEdit: string) => {
    setEditingThemeId(themeIdToEdit)
    setThemeEditValue(themeIdToEdit)
  }, [])

  const saveThemeName = useCallback(async (themeIdToEdit: string) => {
    const nextThemeId = themeEditValue.trim()
    if (!nextThemeId) {
      setEditingThemeId(null)
      setThemeEditValue('')
      return
    }

    if (nextThemeId === themeIdToEdit) {
      setEditingThemeId(null)
      return
    }

    try {
      const response = await fetchJson<ThemeContextResponse>(`/themes/${encodeURIComponent(themeIdToEdit)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: nextThemeId })
      })
      setEditingThemeId(null)
      setThemeEditValue('')
      await refreshThemes()
      if (activeThemeId === themeIdToEdit) {
        navigate(`/app/theme-tree/${encodeURIComponent(response.data.themeId)}`, { replace: true })
      }
    } catch (error) {
      console.warn('Failed to rename theme.', error)
      alert('重命名主题失败，可能是同名主题已存在。')
    }
  }, [activeThemeId, navigate, refreshThemes, themeEditValue])

  const deleteTheme = useCallback(async (themeIdToDelete: string) => {
    if (!window.confirm(`确定要删除主题“${themeIdToDelete}”吗？该主题画布和待吸收主题卡都会被删除。`)) return

    try {
      await fetchJson<{ success: true; data: { themeId: string } }>(`/themes/${encodeURIComponent(themeIdToDelete)}`, {
        method: 'DELETE'
      })
      await queryClient.invalidateQueries({ queryKey: ['theme-list'] })
      if (activeThemeId === themeIdToDelete) {
        clearNodes()
        setActiveThemeTree(null)
        navigate('/app/theme-tree', { replace: true })
      }
    } catch (error) {
      console.warn('Failed to delete theme.', error)
      alert('删除主题失败，请稍后再试。')
    }
  }, [activeThemeId, clearNodes, navigate, queryClient])

  useEffect(() => {
    if (!activeThemeId) return
    if (visibleThemeCards.length === 0) return
    setIsThemeQueueTrayMinimized(false)
  }, [activeThemeId, visibleThemeCards.length])

  const runThemeTreeCommand = useCallback(async (
    commandName:
      | 'create_node'
      | 'create_sibling_node'
      | 'rename_node'
      | 'delete_node'
      | 'move_node_as_child'
      | 'move_node_as_sibling'
      | 'toggle_node_collapsed'
      | 'update_node_meta'
      | 'update_node_notes'
      | 'import_theme_snapshot',
    payload: Record<string, unknown> = {},
    options?: {
      targetId?: string | null
      targetType?: 'theme_tree' | 'theme_node' | 'theme_card'
    }
  ) => {
    if (!activeThemeTree) return

    const storeState = useDocumentStore.getState()
    const requestSequence = ++themeTreeRequestSequenceRef.current
    const response = await fetchJson<ThemeTreeResponse>(`/theme-trees/${activeThemeTree.treeId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandName,
        targetId: options?.targetId ?? null,
        targetType: options?.targetType ?? 'theme_node',
        clientVersion: activeThemeTree.version,
        payload,
        snapshot: {
          themeId: activeThemeTree.themeId,
          rootNodeIds: storeState.rootNodeIds,
          nodes: storeState.nodes,
          meta: {
            importedThemeCardIds,
            queueTrayMinimized: isThemeQueueTrayMinimized
          }
        }
      })
    })

    if (requestSequence !== themeTreeRequestSequenceRef.current) return
    setTree(response.data.treeId, response.data.nodes, response.data.rootNodeIds, response.data.version)
    setActiveThemeTree({
      treeId: response.data.treeId,
      themeId: response.data.themeId,
      version: response.data.version
    })
    setIsThemeQueueTrayMinimized(response.data.meta?.queueTrayMinimized ?? true)
  }, [activeThemeTree, importedThemeCardIds, isThemeQueueTrayMinimized, setTree])

  const absorbThemeCard = useCallback((
    card: ThemeCardItem,
    options?: {
      position?: { x: number; y: number }
    }
  ) => {
    if (!card.treeSnapshot || !activeThemeTree) return

    const importedIds = new Set(importedThemeCardIds)
    importedIds.add(card.themeCardId)
    const nextImportedThemeCardIds = Array.from(importedIds)
    setImportedThemeCardIds(nextImportedThemeCardIds)
    setIsImportedThemePocketOpen(false)

    const cloneNode = (
      snapshotNodeId: string,
      parentId: string | null,
      position: { x: number; y: number }
    ) => {
      const snapshotNode = card.treeSnapshot?.nodes[snapshotNodeId]
      if (!snapshotNode) return null

      const createdId = createNode(parentId, snapshotNode.label, position, snapshotNode.nodeType)
      if (!createdId) return null
      updateNodeMeta(createdId, {
        ...(snapshotNode.meta ?? {}),
        sourceBookNodeIds: [card.sourceNodeId],
        sourceBookId: card.sourceBookId,
        importedFromThemeCard: true,
        importedThemeCardId: card.themeCardId
      })

      snapshotNode.childrenIds.forEach((childId, childIndex) => {
        cloneNode(childId, createdId, {
          x: position.x + 220,
          y: position.y + childIndex * 60
        })
      })

      return createdId
    }

    card.treeSnapshot.rootNodeIds.forEach((rootId, index) => {
      const basePosition = options?.position ?? { x: 220, y: 220 }
      cloneNode(rootId, null, {
        x: basePosition.x,
        y: basePosition.y + index * 84
      })
    })

    const storeState = useDocumentStore.getState()
    void fetchJson<ThemeTreeResponse>(`/theme-trees/${activeThemeTree.treeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        themeId: activeThemeTree.themeId,
        rootNodeIds: storeState.rootNodeIds,
        nodes: storeState.nodes,
        meta: {
          importedThemeCardIds: nextImportedThemeCardIds,
          queueTrayMinimized: isThemeQueueTrayMinimized
        }
      })
    }).then((response) => {
      setTree(response.data.treeId, response.data.nodes, response.data.rootNodeIds, response.data.version)
      setActiveThemeTree({
        treeId: response.data.treeId,
        themeId: response.data.themeId,
        version: response.data.version
      })
      setImportedThemeCardIds(response.data.meta?.importedThemeCardIds ?? nextImportedThemeCardIds)
      setIsThemeQueueTrayMinimized(response.data.meta?.queueTrayMinimized ?? true)
    }).catch((error) => {
    console.warn('Failed to persist imported theme card state.', error)
    })
  }, [activeThemeTree, createNode, importedThemeCardIds, isThemeQueueTrayMinimized, setTree, updateNodeMeta])

  const restoreImportedThemeCard = useCallback((card: ThemeCardItem) => {
    if (!activeThemeTree) return

    const storeState = useDocumentStore.getState()
    const importedNodeIds = Object.values(storeState.nodes)
      .filter((node) => node.meta?.importedFromThemeCard === true && node.meta?.importedThemeCardId === card.themeCardId)
      .map((node) => node.id)
    const importedNodeIdSet = new Set(importedNodeIds)
    const topLevelImportedNodeIds = importedNodeIds.filter((nodeId) => {
      const parentId = storeState.nodes[nodeId]?.parentId
      return !parentId || !importedNodeIdSet.has(parentId)
    })

    topLevelImportedNodeIds.forEach((nodeId) => deleteNode(nodeId))

    const nextImportedThemeCardIds = importedThemeCardIds.filter((cardId) => cardId !== card.themeCardId)
    const nextImportedThemePocketOpen = nextImportedThemeCardIds.length > 0 && isImportedThemePocketOpen
    setImportedThemeCardIds(nextImportedThemeCardIds)
    setIsImportedThemePocketOpen(nextImportedThemePocketOpen)
    setRestoreThemeCardMenu(null)
    setKnowledgeNodeId((current) => {
      if (!current || !importedNodeIdSet.has(current)) return current
      return null
    })
    setSelectedNodeId((current) => {
      if (!current || !importedNodeIdSet.has(current)) return current
      return null
    })

    const nextStoreState = useDocumentStore.getState()
    void fetchJson<ThemeTreeResponse>(`/theme-trees/${activeThemeTree.treeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        themeId: activeThemeTree.themeId,
        rootNodeIds: nextStoreState.rootNodeIds,
        nodes: nextStoreState.nodes,
        meta: {
          importedThemeCardIds: nextImportedThemeCardIds,
          queueTrayMinimized: isThemeQueueTrayMinimized
        }
      })
    }).then((response) => {
      setTree(response.data.treeId, response.data.nodes, response.data.rootNodeIds, response.data.version)
      setActiveThemeTree({
        treeId: response.data.treeId,
        themeId: response.data.themeId,
        version: response.data.version
      })
      setImportedThemeCardIds(response.data.meta?.importedThemeCardIds ?? nextImportedThemeCardIds)
      setIsThemeQueueTrayMinimized(response.data.meta?.queueTrayMinimized ?? true)
      void queryClient.invalidateQueries({ queryKey: ['theme-cards', activeThemeId] })
    }).catch((error) => {
      console.warn('Failed to restore imported theme card.', error)
    })
  }, [
    activeThemeId,
    activeThemeTree,
    deleteNode,
    importedThemeCardIds,
    isImportedThemePocketOpen,
    isThemeQueueTrayMinimized,
    queryClient,
    setTree
  ])

  const handleThemeCardDragStart = useCallback((cardId: string, event: React.DragEvent<HTMLButtonElement>) => {
    suppressThemeCardClickRef.current = true
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/cogtree-theme-card', cardId)
    setIsThemeCardDragging(true)
  }, [])

  const handleThemeCardDragEnd = useCallback(() => {
    setIsThemeCardDragging(false)
    window.setTimeout(() => {
      suppressThemeCardClickRef.current = false
    }, 180)
  }, [])

  const handleThemeCanvasDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const cardId = event.dataTransfer.getData('application/cogtree-theme-card')
    setIsThemeCardDragging(false)
    if (!cardId) return

    const card = visibleThemeCards.find((item) => item.themeCardId === cardId)
    if (!card) return

    const projectedPosition = flowProjectRef.current?.({
      x: event.clientX,
      y: event.clientY
    })
    const rect = themeDropZoneRef.current?.getBoundingClientRect()
    const dropPosition = projectedPosition
      ?? {
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0)
      }

    absorbThemeCard(card, {
      position: {
        x: dropPosition.x,
        y: dropPosition.y
      }
    })

    window.setTimeout(() => {
      suppressThemeCardClickRef.current = false
    }, 180)
  }, [absorbThemeCard, visibleThemeCards])

  const panelStyle: React.CSSProperties = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)'
  }

  const themeTrayCardStyle: React.CSSProperties = {
    width: '260px',
    minWidth: '260px',
    height: '92px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: '8px',
    textAlign: 'left',
    border: '1px solid rgba(36, 44, 56, 0.9)',
    background: 'rgba(15, 19, 26, 0.95)',
    color: 'var(--text-primary)',
    borderRadius: '14px',
    padding: '14px'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0 }}>
      <header className="top-bar" style={{ flexShrink: 0 }}>
        <div className="breadcrumbs">
          <span>主题整理</span>
          {activeThemeId && (
            <>
              <span>/</span>
              <span className="current">{themeContext?.data.themeName ?? activeThemeId}</span>
            </>
          )}
        </div>
        <div className="top-bar-actions" style={{ marginLeft: 'auto' }}>
          <button className="primary" onClick={() => void handleSaveThemeTree()} disabled={!activeThemeTree || themeSaveState === 'saving'}>
            {themeSaveState === 'saved' ? <Check size={14} /> : <Save size={14} />}
            {themeSaveState === 'saving' ? '保存中' : themeSaveState === 'saved' ? '已保存' : themeSaveState === 'error' ? '保存失败' : '保存'}
          </button>
          <button className="icon-btn" title="撤销" onClick={undo} disabled={undoStack.length === 0}><Undo2 size={16} /></button>
          <button className="icon-btn" title="重做" onClick={redo} disabled={redoStack.length === 0}><Redo2 size={16} /></button>
          <button><Share2 size={14} /> 分享</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setIsExportMenuOpen((current) => !current)}><Download size={14} /> 导出</button>
            <CanvasExportMenu
              open={isExportMenuOpen}
              onExportImage={(resolution) => void handleExportImage(resolution)}
              onExportOutlineMarkdown={handleExportMarkdownOutline}
              onExportKnowledgeMarkdown={handleExportMarkdownKnowledge}
            />
          </div>
          <FocusTimerButton />
        </div>
      </header>

      <div
        style={{
          display: 'flex',
          width: '100%',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative'
        }}
      >
      <aside
        className="secondary-panel"
        data-theme-drawer="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '320px',
          height: 'auto',
          zIndex: 22,
          borderRight: '1px solid var(--border-color)',
          borderRadius: '0 16px 16px 0',
          boxShadow: themeDrawerOpen ? '4px 0 24px rgba(0,0,0,0.45)' : 'none',
          transform: themeDrawerOpen ? 'translateX(0)' : 'translateX(calc(-100% - 18px))',
          transition: 'transform 0.22s ease, box-shadow 0.22s ease',
          pointerEvents: themeDrawerOpen ? 'auto' : 'none',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>主题整理</h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="icon-btn" title="新建主题" onClick={() => void handleCreateTheme()}>
                <Plus size={16} />
              </button>
              <button className="icon-btn" title="筛选主题">
                <Filter size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="panel-content" style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
          <div className="search-box" style={{ marginBottom: '16px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="搜索主题归属..."
              value={themeSearch}
              onChange={(event) => setThemeSearch(event.target.value)}
            />
          </div>

          <div className="list-header">
            <span>全部主题 {filteredThemeItems.length}</span>
          </div>

          <div className="stack-list" style={{ gap: '8px' }}>
            {filteredThemeItems.map((item) => {
              const isEditing = editingThemeId === item.themeId

              return (
                <div
                  role="button"
                  tabIndex={0}
                  className={`book-card ${activeThemeId === item.themeId ? 'active' : ''}`}
                  key={item.themeId}
                  onClick={() => {
                    if (isEditing) return
                    navigate(`/app/theme-tree/${encodeURIComponent(item.themeId)}`)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !isEditing) {
                      navigate(`/app/theme-tree/${encodeURIComponent(item.themeId)}`)
                    }
                  }}
                  style={{ width: '100%', textAlign: 'left', cursor: isEditing ? 'default' : 'pointer', position: 'relative' }}
                >
                  <div className="book-cover">{item.themeName.slice(0, 2)}</div>
                  <div className="book-info" style={{ minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        value={themeEditValue}
                        autoFocus
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setThemeEditValue(event.target.value)}
                        onBlur={() => void saveThemeName(item.themeId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void saveThemeName(item.themeId)
                          if (event.key === 'Escape') {
                            setEditingThemeId(null)
                            setThemeEditValue('')
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid rgba(45, 212, 191, 0.46)',
                          background: 'rgba(9, 11, 16, 0.84)',
                          color: 'var(--text-primary)',
                          padding: '0 8px',
                          outline: 'none',
                          fontSize: '13px',
                          fontWeight: 700
                        }}
                      />
                    ) : (
                      <div className="book-title">{item.themeName}</div>
                    )}
                    <div className="book-meta">主题卡 {item.cardCount} 张</div>
                    <div className="book-stats">已吸收 {item.importedCount} 张</div>
                  </div>
                  {!isEditing && (
                    <div
                      className="theme-card-actions"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '10px',
                        display: 'flex',
                        gap: '4px',
                        zIndex: 2
                      }}
                    >
                      <button
                        type="button"
                        className="icon-btn"
                        title="重命名主题"
                        onClick={(event) => {
                          event.stopPropagation()
                          startEditTheme(item.themeId)
                        }}
                        style={{ width: '26px', height: '26px', padding: 0 }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="删除主题"
                        onClick={(event) => {
                          event.stopPropagation()
                          void deleteTheme(item.themeId)
                        }}
                        style={{ width: '26px', height: '26px', padding: 0, color: 'var(--error-color, #ef4444)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                  {activeThemeId === item.themeId && <div className="active-dot" />}
                </div>
              )
            })}
            {filteredThemeItems.length === 0 && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(9, 11, 16, 0.45)',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  lineHeight: 1.7
                }}
              >
                还没有提取出的主题。
                <br />
                先去结构整理页对节点执行“提取为主题”。
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="workspace-area" style={{ flex: 1, minWidth: 0, minHeight: 0, borderTop: 'none' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-canvas)'
          }}
        >
        <div
          ref={themeDropZoneRef}
          className="canvas-container"
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes('application/cogtree-theme-card')) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={handleThemeCanvasDrop}
          onDragLeave={() => setIsThemeCardDragging(false)}
          style={{
            minHeight: 0,
            borderTop: 'none',
            border: isThemeCardDragging ? '1px solid rgba(45, 212, 191, 0.45)' : '1px solid transparent'
          }}
        >
          <CanvasWorkspace
            onNodeSelect={setSelectedNodeId}
            onFlowReady={(helpers) => {
              flowProjectRef.current = helpers.screenToFlowPosition
            }}
            onNodeInfoOpen={handleNodeInfoOpen}
            onCommand={(command) => {
              if (!activeThemeId) return
              void runThemeTreeCommand(command.commandName, command.payload ?? {}, {
                targetId: command.targetId ?? null,
                targetType: command.targetType === 'book_node' ? 'theme_node' : 'theme_tree'
              })
            }}
            nodes={Object.values(nodes)}
          />
          {knowledgeNode && (
            <NodeKnowledgePanel
              selectedNode={knowledgeNode}
              linkedQuotes={[]}
              onClose={() => setKnowledgeNodeId(null)}
              onUpdateLabel={(label) => {
                updateNodeLabel(knowledgeNode.id, label)
                void runThemeTreeCommand('rename_node', { label }, {
                  targetId: knowledgeNode.id,
                  targetType: 'theme_node'
                })
              }}
              onUpdateNotes={(notes) => {
                updateNodeNotes(knowledgeNode.id, notes)
                void runThemeTreeCommand('update_node_notes', { noteCount: notes.length }, {
                  targetId: knowledgeNode.id,
                  targetType: 'theme_node'
                })
              }}
              onUpdateMeta={(meta) => {
                updateNodeMeta(knowledgeNode.id, meta)
                void runThemeTreeCommand('update_node_meta', {
                  knowledgeImageCount: Array.isArray(meta.knowledgeImages) ? meta.knowledgeImages.length : 0
                }, {
                  targetId: knowledgeNode.id,
                  targetType: 'theme_node'
                })
              }}
              style={{
                position: 'absolute',
                right: '16px',
                top: '16px',
                bottom: '16px',
                width: '320px',
                zIndex: 8
              }}
            />
          )}
          {importedThemeCards.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: '16px',
                top: '16px',
                zIndex: 13,
                width: isImportedThemePocketOpen ? '280px' : 'auto',
                maxWidth: '280px'
              }}
            >
              <button
                type="button"
                onClick={() => setIsImportedThemePocketOpen((current) => !current)}
                style={{
                  minHeight: '38px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  border: '1px solid rgba(36, 44, 56, 0.95)',
                  background: 'rgba(9, 11, 16, 0.92)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
                  backdropFilter: 'blur(10px)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-primary)'
                }}
              >
                <span style={{ color: 'var(--accent-color)', fontSize: '13px', fontWeight: 600 }}>已拖入卡片</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{importedThemeCards.length} 张</span>
                {isImportedThemePocketOpen ? (
                  <ChevronDown size={14} color="var(--accent-color)" />
                ) : (
                  <ChevronUp size={14} color="var(--accent-color)" />
                )}
              </button>

              {isImportedThemePocketOpen && (
                <div
                  style={{
                    ...panelStyle,
                    marginTop: '10px',
                    padding: '12px',
                    background: 'rgba(12, 16, 24, 0.94)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '280px',
                    overflowY: 'auto'
                  }}
                >
                  {importedThemeCards.map((card) => (
                    <div
                      key={card.themeCardId}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setRestoreThemeCardMenu({
                          cardId: card.themeCardId,
                          x: event.clientX,
                          y: event.clientY
                        })
                      }}
                      style={{
                        border: '1px solid rgba(36, 44, 56, 0.9)',
                        borderRadius: '12px',
                        background: 'rgba(15, 19, 26, 0.96)',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        cursor: 'context-menu'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--accent-color)' }}>
                        {card.title || '未命名主题卡'} · {card.nodeCount ?? 0} 个节点
                      </div>
                      <div style={{ fontSize: '12px', lineHeight: 1.55, color: 'var(--text-primary)' }}>
                        来自《{card.sourceBookTitle}》 · {card.sourceBookAuthor}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {restoreThemeCardMenu && (
            <div
              className="canvas-context-menu"
              style={{
                left: restoreThemeCardMenu.x,
                top: restoreThemeCardMenu.y,
                zIndex: 40
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="canvas-context-menu-item"
                onClick={() => {
                  const card = importedThemeCards.find((item) => item.themeCardId === restoreThemeCardMenu.cardId)
                  if (card) restoreImportedThemeCard(card)
                }}
              >
                <Undo2 size={14} />
                还原到卡片池
              </button>
            </div>
          )}
          <div className="canvas-floating-toolbar bottom-right" style={{ zIndex: 12 }}>
            <button className="tool-btn active" title="自由布局">
              <LayoutTemplate size={18} strokeWidth={1.8} />
            </button>
            <button className="tool-btn" title="缩小">
              <Minus size={18} strokeWidth={1.8} />
            </button>
            <button className="tool-btn" title="放大">
              <Plus size={18} strokeWidth={1.8} />
            </button>
            <button className="tool-btn" title="最大化">
              <Maximize size={18} strokeWidth={1.8} />
            </button>
          </div>
          {activeThemeId && isThemeQueueTrayMinimized ? (
            <button
              type="button"
              onClick={() => setIsThemeQueueTrayMinimized(false)}
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '20px',
                transform: 'translateX(-50%)',
                zIndex: 14,
                minHeight: '42px',
                padding: '0 16px',
                borderRadius: '999px',
                border: '1px solid rgba(36, 44, 56, 0.95)',
                background: 'rgba(9, 11, 16, 0.92)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.34)',
                backdropFilter: 'blur(10px)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-primary)'
              }}
            >
              <span style={{ color: 'var(--accent-color)', fontSize: '13px', fontWeight: 600 }}>主题卡片池</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{themeCardsCountLabel}</span>
              <ChevronUp size={14} color="var(--accent-color)" />
            </button>
          ) : activeThemeId ? (
            <div
              style={{
                ...panelStyle,
                position: 'absolute',
                left: '16px',
                right: knowledgeNode ? '352px' : '16px',
                bottom: '16px',
                zIndex: 14,
                minHeight: '124px',
                maxHeight: '172px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: 'rgba(12, 16, 24, 0.92)',
                backdropFilter: 'blur(12px)',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--accent-color)', marginBottom: '2px' }}>待吸收主题卡片池</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    提取出的主题子树会先保存在这里，点击即可吸收到当前主题画布
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {themeCardsCountLabel}
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setIsThemeQueueTrayMinimized(true)}
                    title="最小化卡片池"
                    style={{
                      width: '30px',
                      height: '30px',
                      padding: 0,
                      border: '1px solid rgba(36, 44, 56, 0.95)',
                      background: 'rgba(9, 11, 16, 0.9)'
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              {isThemeCardsLoading ? (
                <div
                  style={{
                    ...themeTrayCardStyle,
                    background: 'rgba(15, 19, 26, 0.95)',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '6px' }}>
                    主题卡片池
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.55, width: '100%' }}>
                    正在读取当前主题卡...
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    请稍候
                  </div>
                </div>
              ) : isThemeCardsError ? (
                <button
                  type="button"
                  onClick={() => void refetchThemeCards()}
                  style={{
                    ...themeTrayCardStyle,
                    border: '1px solid rgba(248, 113, 113, 0.24)',
                    background: 'rgba(127, 29, 29, 0.12)',
                    color: '#fecaca',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '6px' }}>
                    主题卡片池
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.55, width: '100%', color: 'var(--text-primary)' }}>
                    读取失败，点击重试
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#fecaca' }}>
                    重新加载当前主题卡
                  </div>
                </button>
              ) : visibleThemeCards.length === 0 ? (
                <div
                  style={{
                    ...themeTrayCardStyle,
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '6px' }}>
                    主题卡片池
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.55, width: '100%' }}>
                    暂无待整理主题卡
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    先去结构整理页提取主题节点
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '2px' }}>
                  {visibleThemeCards.map((card) => (
                    <button
                      key={card.themeCardId}
                      type="button"
                      draggable
                      onDragStart={(event) => handleThemeCardDragStart(card.themeCardId, event)}
                      onDragEnd={handleThemeCardDragEnd}
                      onClick={(event) => {
                        if (suppressThemeCardClickRef.current) {
                          event.preventDefault()
                          event.stopPropagation()
                          suppressThemeCardClickRef.current = false
                        }
                      }}
                      style={{
                        ...themeTrayCardStyle,
                        cursor: 'grab'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '6px' }}>
                        {card.title} · {card.nodeCount} 个节点
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: 1.55, width: '100%' }}>
                        来自《{card.sourceBookTitle}》 · {card.sourceBookAuthor}
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        点击吸收到当前主题画布
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
        </div>
      </div>
      </div>
    </div>
  )
}
