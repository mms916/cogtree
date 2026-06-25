import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronUp, GitMerge, LayoutTemplate, Maximize, Minus, Plus, RotateCcw, Save } from 'lucide-react'

import { fetchJson } from '../lib/api'
import { CanvasWorkspace } from '../modules/canvas/CanvasWorkspace'
import { NodeKnowledgePanel } from '../modules/canvas/NodeKnowledgePanel'
import type { BaseNode } from '../stores/useDocumentStore'
import { useDocumentStore } from '../stores/useDocumentStore'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useUIStore } from '../stores/useUIStore'

type BookTreeContextResponse = {
  success: true
  data: {
    bookId: string
    bookName: string
    activeTreeId: string
    activeVersion: number
    currentThemeFilter?: string
    pruningQueueCount: number
    mergeSuggestionCount: number
  }
}

type BookTreeResponse = {
  success: true
  data: {
    treeId: string
    bookId: string
    version: number
    rootNodeIds: string[]
    nodes: Record<string, BaseNode>
    meta?: {
      importedQuoteIds?: string[]
      importedCards?: ImportedQuoteCard[]
      queueTrayMinimized?: boolean
      importedPocketOpen?: boolean
    }
  }
}

type BookTreeQueueItem = {
  queueItemId: string
  quoteCardId: string
  sourceQuoteId: string
  quoteText: string
  pageLabel?: string
  treeTitle?: string
  nodeCount?: number
  queueStatus: string
  treeSnapshot: {
    nodes: Record<string, BaseNode>
    rootNodeIds: string[]
  } | null
}

type BookTreeQueueResponse = {
  success: true
  data: {
    items: BookTreeQueueItem[]
  }
}

type ExtractThemeResponse = {
  success: true
  data: {
    themeCardId: string
    themeId: string
    themeTreeId: string
    title: string
    nodeCount: number
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

type SourceQuoteMeta = {
  id: string
  text: string
  page?: string
  treeTitle?: string
}

type ImportedQuoteCard = {
  id: string
  text: string
  page?: string
  treeTitle?: string
  nodeCount?: number
}

type BookTreeCommandName =
  | 'create_node'
  | 'create_sibling_node'
  | 'rename_node'
  | 'delete_node'
  | 'move_node_as_child'
  | 'move_node_as_sibling'
  | 'toggle_node_collapsed'
  | 'update_node_notes'
  | 'update_node_meta'
  | 'import_quote_snapshot'

function buildBookTreeSavePayload(
  bookId: string,
  rootNodeIds: string[],
  nodes: Record<string, BaseNode>,
  importedQuoteIds: string[],
  importedCards: ImportedQuoteCard[],
  uiState?: {
    queueTrayMinimized?: boolean
    importedPocketOpen?: boolean
  }
) {
  return {
    bookId,
    rootNodeIds,
    nodes: Object.fromEntries(
      Object.values(nodes).map((node) => [
        node.id,
        {
          ...node,
          meta: node.meta ?? {},
          shortDefinition: node.shortDefinition ?? undefined
        }
      ])
    ),
    meta: {
      importedQuoteIds,
      importedCards,
      queueTrayMinimized: uiState?.queueTrayMinimized,
      importedPocketOpen: uiState?.importedPocketOpen
    }
  }
}

export function BookTreePage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const formatSaveTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  const dropZoneRef = useRef<HTMLDivElement | null>(null)
  const flowProjectRef = useRef<((point: { x: number; y: number }) => { x: number; y: number }) | null>(null)
  const flowFitViewRef = useRef<((options?: { padding?: number; duration?: number; nodes?: { id: string }[] }) => Promise<boolean>) | null>(null)
  const shouldCenterViewportRef = useRef(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [knowledgeNodeId, setKnowledgeNodeId] = useState<string | null>(null)
  const lastKnowledgeToggleRef = useRef<{ nodeId: string | null; timestamp: number }>({ nodeId: null, timestamp: 0 })
  const [isQueueDragging, setIsQueueDragging] = useState(false)
  const [isQueueTrayMinimized, setIsQueueTrayMinimized] = useState(true)
  const [importedQuoteIds, setImportedQuoteIds] = useState<string[]>([])
  const [importedCards, setImportedCards] = useState<ImportedQuoteCard[]>([])
  const [isImportedPocketOpen, setIsImportedPocketOpen] = useState(false)
  const [restoreQuoteCardMenu, setRestoreQuoteCardMenu] = useState<{ cardId: string; x: number; y: number } | null>(null)
  const [isTreeHydrated, setIsTreeHydrated] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [isThemeExtractDialogOpen, setIsThemeExtractDialogOpen] = useState(false)
  const [themeDraftName, setThemeDraftName] = useState('')
  const [isExtractingTheme, setIsExtractingTheme] = useState(false)
  const [themeExtractError, setThemeExtractError] = useState<string | null>(null)
  const [themeExtractNotice, setThemeExtractNotice] = useState<string | null>(null)
  const persistTimeoutRef = useRef<number | null>(null)
  const lastPersistedSnapshotRef = useRef<string | null>(null)
  const pendingPersistSnapshotRef = useRef<string | null>(null)
  const pendingPersistPayloadRef = useRef<ReturnType<typeof buildBookTreeSavePayload> | null>(null)
  const bookTreeRequestSequenceRef = useRef(0)
  const suppressQueueCardClickRef = useRef(false)
  const importedQuoteIdsRef = useRef<string[]>([])
  const importedCardsRef = useRef<ImportedQuoteCard[]>([])
  const queueTrayMinimizedRef = useRef(false)
  const importedPocketOpenRef = useRef(false)
  const lastEffectiveBookIdRef = useRef<string | null>(null)

  const {
    nodes,
    rootNodeIds,
    treeId,
    version,
    setTree,
    createNode,
    deleteNode,
    updateNodePosition,
    updateNodeLabel,
    updateNodeMeta,
    updateNodeNotes
  } = useDocumentStore()
  const {
    books,
    loadLibraryFromApi,
    selectedBookId,
    selectBook
  } = useLibraryStore()
  const closeResourceDrawer = useUIStore((state) => state.closeResourceDrawer)
  const effectiveBookId = useMemo(() => {
    const routeBookId = bookId && /^[0-9a-fA-F-]{36}$/.test(bookId) ? bookId : null
    const routeBook = books.find((book) => book.id === bookId)
    return routeBook?.id ?? routeBookId ?? selectedBookId ?? books[0]?.id ?? null
  }, [bookId, books, selectedBookId])

  const { data: contextData } = useQuery({
    queryKey: ['book-tree-context', effectiveBookId],
    queryFn: () => fetchJson<BookTreeContextResponse>(`/books/${effectiveBookId}/book-tree/context`),
    enabled: Boolean(effectiveBookId)
  })

  const { data: treeData } = useQuery({
    queryKey: ['book-tree', contextData?.data.activeTreeId],
    queryFn: () => fetchJson<BookTreeResponse>(`/book-trees/${contextData?.data.activeTreeId}`),
    enabled: Boolean(contextData?.data.activeTreeId),
    refetchOnMount: 'always'
  })

  const { data: queueData } = useQuery({
    queryKey: ['book-tree-queue', contextData?.data.activeTreeId],
    queryFn: () => fetchJson<BookTreeQueueResponse>(`/book-trees/${contextData?.data.activeTreeId}/queue`),
    enabled: Boolean(contextData?.data.activeTreeId),
    refetchOnMount: 'always'
  })

  const { data: themeListData } = useQuery({
    queryKey: ['theme-list'],
    queryFn: () => fetchJson<ThemeListResponse>('/themes'),
    refetchOnMount: 'always'
  })

  useEffect(() => {
    closeResourceDrawer()
  }, [closeResourceDrawer])

  useEffect(() => {
    loadLibraryFromApi().catch((error) => {
      console.warn('Failed to load structure library.', error)
    })
  }, [loadLibraryFromApi])

  useEffect(() => {
    if (!effectiveBookId || selectedBookId === effectiveBookId) return
    selectBook(effectiveBookId)
  }, [effectiveBookId, selectBook, selectedBookId])

  useEffect(() => {
    if (!treeData?.data) return

    const importedIds = treeData.data.meta?.importedQuoteIds ?? []
    const importedCardList = treeData.data.meta?.importedCards ?? []
    const initialSnapshot = JSON.stringify(
      buildBookTreeSavePayload(
        treeData.data.bookId,
        treeData.data.rootNodeIds,
        treeData.data.nodes,
        importedIds,
        importedCardList,
        {
          queueTrayMinimized: treeData.data.meta?.queueTrayMinimized ?? true,
          importedPocketOpen: treeData.data.meta?.importedPocketOpen ?? false
        }
      )
    )

    lastPersistedSnapshotRef.current = initialSnapshot
    setTree(treeData.data.treeId, treeData.data.nodes, treeData.data.rootNodeIds, treeData.data.version)
    importedQuoteIdsRef.current = importedIds
    importedCardsRef.current = importedCardList
    queueTrayMinimizedRef.current = treeData.data.meta?.queueTrayMinimized ?? true
    importedPocketOpenRef.current = treeData.data.meta?.importedPocketOpen ?? false
    setImportedQuoteIds(importedIds)
    setImportedCards(importedCardList)
    setIsQueueTrayMinimized(treeData.data.meta?.queueTrayMinimized ?? true)
    setIsImportedPocketOpen(treeData.data.meta?.importedPocketOpen ?? false)
    setIsTreeHydrated(true)
    shouldCenterViewportRef.current = true
  }, [setTree, treeData?.data])

  const queueQuotes = useMemo(
    () => queueData?.data.items ?? [],
    [queueData?.data.items]
  )
  const visibleQueueQuotes = useMemo(
    () => queueQuotes.filter((quote) => !importedQuoteIds.includes(quote.sourceQuoteId)),
    [importedQuoteIds, queueQuotes]
  )
  const activeBookId = effectiveBookId ?? selectedBookId ?? treeData?.data?.bookId ?? null
  const currentSnapshot = useMemo(() => {
    if (!isTreeHydrated || !activeBookId || !treeId) return null
    return JSON.stringify(
      buildBookTreeSavePayload(
        activeBookId,
        rootNodeIds,
        nodes,
        importedQuoteIds,
        importedCards,
        {
          queueTrayMinimized: isQueueTrayMinimized,
          importedPocketOpen: isImportedPocketOpen
        }
      )
    )
  }, [
    activeBookId,
    importedCards,
    importedQuoteIds,
    isImportedPocketOpen,
    isQueueTrayMinimized,
    isTreeHydrated,
    nodes,
    rootNodeIds,
    treeId
  ])
  const hasUnsavedChanges = currentSnapshot !== null && currentSnapshot !== lastPersistedSnapshotRef.current
  const lastKnowledgeNodeRef = useRef<BaseNode | null>(null)

  const readUiStateRef = useCallback(() => ({
    importedQuoteIds: importedQuoteIdsRef.current,
    importedCards: importedCardsRef.current,
    queueTrayMinimized: queueTrayMinimizedRef.current,
    importedPocketOpen: importedPocketOpenRef.current
  }), [])

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null
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
  const knowledgeSources = (knowledgeNode?.meta?.sourceQuotes as SourceQuoteMeta[] | undefined) ?? []
  const syncPersistedTree = useCallback((response: BookTreeResponse) => {
    const nextImportedIds = response.data.meta?.importedQuoteIds ?? []
    const nextImportedCards = response.data.meta?.importedCards ?? []
    const nextSnapshot = JSON.stringify(
      buildBookTreeSavePayload(
        response.data.bookId,
        response.data.rootNodeIds,
        response.data.nodes,
        nextImportedIds,
        nextImportedCards,
        {
          queueTrayMinimized: response.data.meta?.queueTrayMinimized ?? true,
          importedPocketOpen: response.data.meta?.importedPocketOpen ?? false
        }
      )
    )

    queryClient.setQueryData(['book-tree', response.data.treeId], response)
    void queryClient.invalidateQueries({ queryKey: ['book-tree-queue', response.data.treeId] })
    setTree(response.data.treeId, response.data.nodes, response.data.rootNodeIds, response.data.version)
    importedQuoteIdsRef.current = nextImportedIds
    importedCardsRef.current = nextImportedCards
    queueTrayMinimizedRef.current = response.data.meta?.queueTrayMinimized ?? true
    importedPocketOpenRef.current = response.data.meta?.importedPocketOpen ?? false
    setImportedQuoteIds(nextImportedIds)
    setImportedCards(nextImportedCards)
    setIsQueueTrayMinimized(response.data.meta?.queueTrayMinimized ?? true)
    setIsImportedPocketOpen(response.data.meta?.importedPocketOpen ?? false)
    setIsTreeHydrated(true)
    shouldCenterViewportRef.current = true
    lastPersistedSnapshotRef.current = nextSnapshot
    pendingPersistPayloadRef.current = null
    pendingPersistSnapshotRef.current = null
  }, [queryClient, setTree])
  const panelStyle: React.CSSProperties = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)'
  }
  const metricCardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(36, 44, 56, 0.9)',
    background: 'rgba(9, 11, 16, 0.45)',
    minWidth: '92px'
  }

  const runBookTreeCommand = async (
    commandName: BookTreeCommandName,
    payload: Record<string, unknown> = {},
    options?: {
      targetId?: string | null
      targetType?: 'book_tree' | 'book_node' | 'quote_card'
      importedQuoteIds?: string[]
      importedCards?: ImportedQuoteCard[]
      queueTrayMinimized?: boolean
      importedPocketOpen?: boolean
    }
  ) => {
    if (!activeBookId || !treeId) return

    const storeState = useDocumentStore.getState()
    const uiState = readUiStateRef()
    const snapshotPayload = buildBookTreeSavePayload(
      activeBookId,
      storeState.rootNodeIds,
      storeState.nodes,
      options?.importedQuoteIds ?? uiState.importedQuoteIds,
      options?.importedCards ?? uiState.importedCards,
      {
        queueTrayMinimized: options?.queueTrayMinimized ?? uiState.queueTrayMinimized,
        importedPocketOpen: options?.importedPocketOpen ?? uiState.importedPocketOpen
      }
    )

    const requestSequence = ++bookTreeRequestSequenceRef.current

    try {
      const response = await fetchJson<BookTreeResponse>(`/book-trees/${treeId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandName,
          targetId: options?.targetId ?? null,
          targetType: options?.targetType ?? 'book_node',
          clientVersion: version,
          payload,
          snapshot: snapshotPayload
        })
      })

      if (requestSequence !== bookTreeRequestSequenceRef.current) return
      syncPersistedTree(response)
    } catch (error) {
      console.warn(`Failed to run book tree command: ${commandName}`, error)
      setSaveState('error')
    }
  }

  const restoreImportedQuoteCard = (card: ImportedQuoteCard) => {
    const storeState = useDocumentStore.getState()
    const importedNodeIds = Object.values(storeState.nodes)
      .filter((node) => {
        const sourceQuoteIds = node.meta?.sourceQuoteIds
        return node.meta?.importedFromQuoteCard === true
          && Array.isArray(sourceQuoteIds)
          && sourceQuoteIds.includes(card.id)
      })
      .map((node) => node.id)
    const importedNodeIdSet = new Set(importedNodeIds)
    const topLevelImportedNodeIds = importedNodeIds.filter((nodeId) => {
      const parentId = storeState.nodes[nodeId]?.parentId
      return !parentId || !importedNodeIdSet.has(parentId)
    })

    topLevelImportedNodeIds.forEach((nodeId) => deleteNode(nodeId))

    const nextImportedQuoteIds = importedQuoteIds.filter((quoteId) => quoteId !== card.id)
    const nextImportedCards = importedCards.filter((item) => item.id !== card.id)
    const nextImportedPocketOpen = nextImportedCards.length > 0 && isImportedPocketOpen

    importedQuoteIdsRef.current = nextImportedQuoteIds
    importedCardsRef.current = nextImportedCards
    importedPocketOpenRef.current = nextImportedPocketOpen
    setImportedQuoteIds(nextImportedQuoteIds)
    setImportedCards(nextImportedCards)
    setIsImportedPocketOpen(nextImportedPocketOpen)
    setRestoreQuoteCardMenu(null)
    setKnowledgeNodeId((current) => {
      if (!current || !importedNodeIdSet.has(current)) return current
      return null
    })
    setSelectedNodeId((current) => {
      if (!current || !importedNodeIdSet.has(current)) return current
      return null
    })

    void runBookTreeCommand(
      'import_quote_snapshot',
      {
        quoteId: card.id,
        restoredToPool: true,
        removedNodeCount: importedNodeIds.length
      },
      {
        targetId: card.id,
        targetType: 'quote_card',
        importedQuoteIds: nextImportedQuoteIds,
        importedCards: nextImportedCards,
        queueTrayMinimized: isQueueTrayMinimized,
        importedPocketOpen: nextImportedPocketOpen
      }
    )
  }

  const persistBookTreeSnapshot = useCallback(async (
    payload: ReturnType<typeof buildBookTreeSavePayload>,
    snapshot: string
  ) => {
    if (!treeId) return false

    const requestSequence = ++bookTreeRequestSequenceRef.current
    pendingPersistPayloadRef.current = payload
    pendingPersistSnapshotRef.current = snapshot

    try {
      const response = await fetchJson<BookTreeResponse>(`/book-trees/${treeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (requestSequence !== bookTreeRequestSequenceRef.current) return false
      syncPersistedTree(response)
      setLastSavedAt(Date.now())
      return true
    } catch (error) {
      console.warn('Failed to persist book tree.', error)
      return false
    }
  }, [syncPersistedTree, treeId])

  const handleSaveTree = useCallback(async () => {
    if (!isTreeHydrated || !activeBookId || !treeId) return

    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
    }

    const uiState = readUiStateRef()
    const payload = buildBookTreeSavePayload(
      activeBookId,
      rootNodeIds,
      nodes,
      uiState.importedQuoteIds,
      uiState.importedCards,
      {
        queueTrayMinimized: uiState.queueTrayMinimized,
        importedPocketOpen: uiState.importedPocketOpen
      }
    )
    const snapshot = JSON.stringify(payload)

    pendingPersistPayloadRef.current = payload
    pendingPersistSnapshotRef.current = snapshot
    setSaveState('saving')

    const saved = await persistBookTreeSnapshot(payload, snapshot)
    if (saved) {
      setSaveState('saved')
    } else {
      setSaveState('error')
    }
  }, [activeBookId, isTreeHydrated, nodes, readUiStateRef, rootNodeIds, treeId, persistBookTreeSnapshot])

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
    if (lastEffectiveBookIdRef.current === effectiveBookId) return

    const previousBookId = lastEffectiveBookIdRef.current
    lastEffectiveBookIdRef.current = effectiveBookId

    if (!previousBookId || !effectiveBookId || previousBookId === effectiveBookId) {
      return
    }

    importedQuoteIdsRef.current = []
    importedCardsRef.current = []
    queueTrayMinimizedRef.current = false
    importedPocketOpenRef.current = false
    setImportedQuoteIds([])
    setImportedCards([])
    setIsImportedPocketOpen(false)
    setIsTreeHydrated(false)
    setSaveState('idle')
    setLastSavedAt(null)
    lastPersistedSnapshotRef.current = null
    pendingPersistPayloadRef.current = null
    pendingPersistSnapshotRef.current = null
  }, [effectiveBookId])

  useEffect(() => {
    importedQuoteIdsRef.current = importedQuoteIds
  }, [importedQuoteIds])

  useEffect(() => {
    importedCardsRef.current = importedCards
  }, [importedCards])

  useEffect(() => {
    queueTrayMinimizedRef.current = isQueueTrayMinimized
  }, [isQueueTrayMinimized])

  useEffect(() => {
    importedPocketOpenRef.current = isImportedPocketOpen
  }, [isImportedPocketOpen])

  useEffect(() => {
    if (!restoreQuoteCardMenu) return
    const closeMenu = () => setRestoreQuoteCardMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [restoreQuoteCardMenu])

  useEffect(() => {
    if (saveState !== 'saved' && saveState !== 'error') return

    const timeoutId = window.setTimeout(() => setSaveState('idle'), saveState === 'saved' ? 1800 : 2600)
    return () => window.clearTimeout(timeoutId)
  }, [saveState])

  useEffect(() => {
    if (!themeExtractNotice) return
    const timeoutId = window.setTimeout(() => setThemeExtractNotice(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [themeExtractNotice])

  useEffect(() => {
    if (!isTreeHydrated || !shouldCenterViewportRef.current || !flowFitViewRef.current) return
    if (rootNodeIds.length === 0) return

    shouldCenterViewportRef.current = false
    const frameId = window.requestAnimationFrame(() => {
      void flowFitViewRef.current?.({
        padding: 0.22,
        duration: 280,
        nodes: rootNodeIds.map((id) => ({ id }))
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isTreeHydrated, rootNodeIds, nodes, treeId, version])

  useEffect(() => {
    if (!isTreeHydrated || !activeBookId || !treeId) return

    const payload = buildBookTreeSavePayload(
      activeBookId,
      rootNodeIds,
      nodes,
      importedQuoteIds,
      importedCards,
      {
        queueTrayMinimized: isQueueTrayMinimized,
        importedPocketOpen: isImportedPocketOpen
      }
    )
    const snapshot = JSON.stringify(payload)

    if (snapshot === lastPersistedSnapshotRef.current) return

    pendingPersistPayloadRef.current = payload
    pendingPersistSnapshotRef.current = snapshot

    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
    }

    persistTimeoutRef.current = window.setTimeout(() => {
      void persistBookTreeSnapshot(payload, snapshot)
    }, 480)

    return () => {
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current)
      }
    }
  }, [
    effectiveBookId,
    importedCards,
    importedQuoteIds,
    isImportedPocketOpen,
    isQueueTrayMinimized,
    isTreeHydrated,
    nodes,
    rootNodeIds,
    treeData?.data?.bookId,
    treeId,
    version,
    persistBookTreeSnapshot
  ])

  useEffect(() => () => {
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
    }

    const pendingPayload = pendingPersistPayloadRef.current
    const pendingSnapshot = pendingPersistSnapshotRef.current
    if (!pendingPayload || !pendingSnapshot || pendingSnapshot === lastPersistedSnapshotRef.current) return

    void persistBookTreeSnapshot(pendingPayload, pendingSnapshot)
  }, [persistBookTreeSnapshot])

  const absorbSnapshot = (
    quoteId: string,
    options?: {
      dropPosition?: { x: number; y: number }
      asFreeNodes?: boolean
      consumeIntoPocket?: boolean
    }
  ) => {
    const quote = queueQuotes.find((item) => item.sourceQuoteId === quoteId)
    const treeSnapshot = quote?.treeSnapshot
    if (!quote || !treeSnapshot) return

    const sourceMeta: SourceQuoteMeta = {
      id: quote.sourceQuoteId,
      text: quote.quoteText,
      page: quote.pageLabel,
      treeTitle: quote.treeTitle
    }
    const mountParentId = options?.asFreeNodes ? null : (selectedNodeId ?? rootNodeIds[0] ?? null)
    let importedNodeCount = 0

    const cloneNode = (
      snapshotNodeId: string,
      parentId: string | null,
      position: { x: number; y: number }
    ): string | null => {
      const snapshotNode = treeSnapshot.nodes[snapshotNodeId]
      if (!snapshotNode) return null

      const createdId = createNode(
        parentId,
        snapshotNode.label,
        position,
        snapshotNode.nodeType as BaseNode['nodeType'] | undefined
      )
      if (!createdId) return null
      importedNodeCount += 1

      // Free-drop imports should honor the actual drop point instead of being
      // reflowed to the end of the existing root stack.
      if (options?.asFreeNodes && !parentId) {
        updateNodePosition(createdId, position)
      }

      const inheritedMeta = snapshotNode.meta ? { ...snapshotNode.meta } : {}
      updateNodeMeta(createdId, {
        ...inheritedMeta,
        sourceQuoteIds: [sourceMeta.id],
        sourceQuotes: [sourceMeta],
        importedFromQuoteCard: true,
        importedTreeTitle: quote.treeTitle
      })

      snapshotNode.childrenIds.forEach((childId, childIndex) => {
        cloneNode(childId, createdId, {
          x: position.x + 220,
          y: position.y + childIndex * 60
        })
      })

      return createdId
    }

    treeSnapshot.rootNodeIds.forEach((snapshotRootId, index) => {
      cloneNode(snapshotRootId, mountParentId, {
        x: options?.dropPosition?.x ?? 280,
        y: (options?.dropPosition?.y ?? 240) + index * 72
      })
    })

    if (options?.consumeIntoPocket) {
      const nextImportedQuoteIds = importedQuoteIds.includes(quote.sourceQuoteId)
        ? importedQuoteIds
        : [...importedQuoteIds, quote.sourceQuoteId]
      const nextImportedCards = importedCards.some((item) => item.id === quote.sourceQuoteId)
        ? importedCards
        : [
            {
              id: quote.sourceQuoteId,
              text: quote.quoteText,
              page: quote.pageLabel,
              treeTitle: quote.treeTitle,
              nodeCount: quote.nodeCount
            },
            ...importedCards
          ]

      importedQuoteIdsRef.current = nextImportedQuoteIds
      importedCardsRef.current = nextImportedCards
      importedPocketOpenRef.current = false
      setImportedQuoteIds(nextImportedQuoteIds)
      setImportedCards(nextImportedCards)
      setIsImportedPocketOpen(false)
      void runBookTreeCommand(
        'import_quote_snapshot',
        {
          quoteId: quote.sourceQuoteId,
          importedNodeCount,
          asFreeNodes: options?.asFreeNodes ?? false
        },
        {
          targetId: quote.quoteCardId,
          targetType: 'quote_card',
          importedQuoteIds: nextImportedQuoteIds,
          importedCards: nextImportedCards,
          queueTrayMinimized: isQueueTrayMinimized,
          importedPocketOpen: false
        }
      )
    } else {
      void runBookTreeCommand('import_quote_snapshot', {
        quoteId: quote.sourceQuoteId,
        importedNodeCount,
        asFreeNodes: options?.asFreeNodes ?? false
      }, {
        targetId: quote.quoteCardId,
        targetType: 'quote_card'
      })
    }
  }

  const handleQueueDragStart = (quoteId: string, event: React.DragEvent<HTMLButtonElement>) => {
    suppressQueueCardClickRef.current = true
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/cogtree-quote-card', quoteId)
    setIsQueueDragging(true)
  }

  const handleQueueDragEnd = () => {
    setIsQueueDragging(false)
    window.setTimeout(() => {
      suppressQueueCardClickRef.current = false
    }, 180)
  }

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const quoteId = event.dataTransfer.getData('application/cogtree-quote-card')
    setIsQueueDragging(false)
    if (!quoteId) return

    const projectedPosition = flowProjectRef.current?.({
      x: event.clientX,
      y: event.clientY
    })
    const rect = dropZoneRef.current?.getBoundingClientRect()
    const dropPosition = projectedPosition
      ? {
          x: Math.max(180, projectedPosition.x),
          y: Math.max(120, projectedPosition.y)
        }
      : rect
        ? {
            x: Math.max(180, event.clientX - rect.left),
            y: Math.max(120, event.clientY - rect.top)
          }
        : undefined

    absorbSnapshot(quoteId, {
      dropPosition,
      asFreeNodes: true,
      consumeIntoPocket: true
    })

    window.setTimeout(() => {
      suppressQueueCardClickRef.current = false
    }, 180)
  }

  const openExtractThemeDialog = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    setThemeDraftName('')
    setThemeExtractError(null)
    setIsThemeExtractDialogOpen(true)
  }, [])

  const handleExtractTheme = useCallback(async () => {
    if (!selectedNodeId || !activeBookId || !treeId) return

    const nextThemeId = themeDraftName.trim()
    if (!nextThemeId) {
      setThemeExtractError('请先输入主题归属。')
      return
    }

    const uiState = readUiStateRef()
    const snapshot = buildBookTreeSavePayload(
      activeBookId,
      rootNodeIds,
      nodes,
      uiState.importedQuoteIds,
      uiState.importedCards,
      {
        queueTrayMinimized: uiState.queueTrayMinimized,
        importedPocketOpen: uiState.importedPocketOpen
      }
    )

    setIsExtractingTheme(true)
    setThemeExtractError(null)

    try {
      const response = await fetchJson<ExtractThemeResponse>(`/book-trees/${treeId}/extract-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: selectedNodeId,
          themeId: nextThemeId,
          snapshot
        })
      })

      setIsThemeExtractDialogOpen(false)
      setThemeDraftName('')
      setThemeExtractNotice(`已提取到主题“${response.data.themeId}”的主题卡片池`)
      void queryClient.invalidateQueries({ queryKey: ['theme-list'] })
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('cogtree-last-theme-id', response.data.themeId)
      }
      navigate(`/app/theme-tree/${encodeURIComponent(response.data.themeId)}`)
    } catch (error) {
      console.warn('Failed to extract theme from book tree node.', error)
      setThemeExtractError('提取失败，请重试。')
    } finally {
      setIsExtractingTheme(false)
    }
  }, [activeBookId, navigate, nodes, queryClient, readUiStateRef, rootNodeIds, selectedNodeId, themeDraftName, treeId])

  const existingThemeItems = useMemo(
    () => themeListData?.data ?? [],
    [themeListData?.data]
  )

  return (
    <>
      <section
      style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        minHeight: 0,
        minWidth: 0,
        padding: '14px',
        overflow: 'hidden'
      }}
    >
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <div
          ref={dropZoneRef}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={handleCanvasDrop}
          onDragLeave={() => setIsQueueDragging(false)}
          style={{
            ...panelStyle,
            position: 'relative',
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
            background: 'var(--bg-canvas)',
            border: isQueueDragging ? '1px solid rgba(45, 212, 191, 0.45)' : '1px solid transparent'
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: knowledgeNode ? '352px' : '16px',
              top: '16px',
              zIndex: 15,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <div
              style={{
                minHeight: '32px',
                padding: '0 12px',
                borderRadius: '999px',
                border: saveState === 'error'
                  ? '1px solid rgba(248, 113, 113, 0.36)'
                  : hasUnsavedChanges
                    ? '1px solid rgba(245, 158, 11, 0.32)'
                    : '1px solid rgba(36, 44, 56, 0.92)',
                background: saveState === 'error'
                  ? 'rgba(127, 29, 29, 0.18)'
                  : hasUnsavedChanges
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(9, 11, 16, 0.82)',
                color: saveState === 'error'
                  ? '#fca5a5'
                  : hasUnsavedChanges
                    ? '#fbbf24'
                    : 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '12px',
                fontWeight: 600,
                boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
                backdropFilter: 'blur(10px)'
              }}
            >
              {saveState === 'saving'
                ? '保存中...'
                : saveState === 'saved'
                  ? `已保存 ${lastSavedAt ? formatSaveTime(lastSavedAt) : ''}`.trim()
                  : saveState === 'error'
                    ? '保存失败，请重试'
                    : hasUnsavedChanges
                      ? '有未保存更改'
                      : lastSavedAt
                        ? `最近保存 ${formatSaveTime(lastSavedAt)}`
                        : '尚未保存'}
            </div>
            <button
              type="button"
              className="primary"
              onClick={() => void handleSaveTree()}
              disabled={!isTreeHydrated || saveState === 'saving'}
              style={{
                minHeight: '36px',
                padding: '0 14px',
                borderRadius: '999px',
                background: saveState === 'saving'
                  ? 'rgba(20, 184, 166, 0.22)'
                  : hasUnsavedChanges
                    ? 'linear-gradient(90deg, rgba(20, 184, 166, 0.92), rgba(94, 234, 212, 0.72))'
                    : 'rgba(9, 11, 16, 0.9)',
                color: hasUnsavedChanges || saveState === 'saving' ? '#ecfeff' : 'var(--text-primary)',
                border: hasUnsavedChanges || saveState === 'saving'
                  ? '1px solid rgba(45, 212, 191, 0.72)'
                  : '1px solid rgba(45, 212, 191, 0.36)',
                boxShadow: hasUnsavedChanges
                  ? '0 10px 30px rgba(20, 184, 166, 0.2)'
                  : '0 10px 28px rgba(0,0,0,0.24)',
                backdropFilter: 'blur(10px)',
                cursor: !isTreeHydrated || saveState === 'saving' ? 'not-allowed' : 'pointer'
              }}
              title={hasUnsavedChanges ? '点击保存当前结构整理状态' : '当前没有新的未保存更改'}
            >
              {saveState === 'saved' ? <Check size={14} /> : <Save size={14} />}
              {saveState === 'saving' ? '保存中' : saveState === 'saved' ? '已保存' : '保存'}
            </button>
          </div>
          {isQueueDragging && (
            <div
              style={{
                position: 'absolute',
                inset: 14,
                zIndex: 5,
                borderRadius: '18px',
                border: '1px dashed rgba(45, 212, 191, 0.45)',
                background: 'rgba(45, 212, 191, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-color)',
                fontSize: '14px',
                fontWeight: 600,
                pointerEvents: 'none'
              }}
            >
              拖入这里吸收进书内树
            </div>
          )}
          <CanvasWorkspace
            title="BookTree Canvas"
            subtitle="中间是主画布，下方是待拖入的金句保存卡池。"
            onNodeSelect={setSelectedNodeId}
            onNodeInfoOpen={handleNodeInfoOpen}
            onFlowReady={(helpers) => {
              flowProjectRef.current = helpers.screenToFlowPosition
              flowFitViewRef.current = helpers.fitView
              if (shouldCenterViewportRef.current) {
                window.requestAnimationFrame(() => {
                  void helpers.fitView({
                    padding: 0.22,
                    duration: 280,
                    nodes: rootNodeIds.map((id) => ({ id }))
                  })
                })
                shouldCenterViewportRef.current = false
              }
            }}
            onCommand={(command) => {
              void runBookTreeCommand(command.commandName, command.payload ?? {}, {
                targetId: command.targetId ?? null,
                targetType: command.targetType
              })
            }}
            getExtraContextMenuItems={({ nodeId }) => [
              {
                key: 'extract-theme',
                label: '提取为主题',
                icon: GitMerge,
                action: () => openExtractThemeDialog(nodeId)
              }
            ]}
            nodes={Object.values(nodes)}
          />
          {knowledgeNode && (
            <NodeKnowledgePanel
              selectedNode={knowledgeNode}
              linkedQuotes={knowledgeSources.map((source) => ({
                id: source.id,
                text: source.text,
                title: source.treeTitle || '保存卡',
                page: source.page
              }))}
              onClose={() => setKnowledgeNodeId(null)}
              onUpdateLabel={(label) => {
                updateNodeLabel(knowledgeNode.id, label)
                void runBookTreeCommand('rename_node', { label }, {
                  targetId: knowledgeNode.id,
                  targetType: 'book_node'
                })
              }}
              onUpdateNotes={(notes) => {
                updateNodeNotes(knowledgeNode.id, notes)
                void runBookTreeCommand('update_node_notes', { noteCount: notes.length }, {
                  targetId: knowledgeNode.id,
                  targetType: 'book_node'
                })
              }}
              onUpdateMeta={(meta) => {
                updateNodeMeta(knowledgeNode.id, meta)
                void runBookTreeCommand('update_node_meta', {
                  knowledgeImageCount: Array.isArray(meta.knowledgeImages) ? meta.knowledgeImages.length : 0
                }, {
                  targetId: knowledgeNode.id,
                  targetType: 'book_node'
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
          {themeExtractNotice && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '20px',
                transform: 'translateX(-50%)',
                zIndex: 18,
                minHeight: '38px',
                padding: '0 16px',
                borderRadius: '999px',
                border: '1px solid rgba(45, 212, 191, 0.52)',
                background: 'rgba(9, 11, 16, 0.94)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--accent-color)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              {themeExtractNotice}
            </div>
          )}

          {importedCards.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: '16px',
                top: '16px',
                zIndex: 13,
                width: isImportedPocketOpen ? '280px' : 'auto',
                maxWidth: '280px'
              }}
            >
              <button
                type="button"
                onClick={() => setIsImportedPocketOpen((current) => !current)}
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
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{importedCards.length} 张</span>
                {isImportedPocketOpen ? (
                  <ChevronDown size={14} color="var(--accent-color)" />
                ) : (
                  <ChevronUp size={14} color="var(--accent-color)" />
                )}
              </button>

              {isImportedPocketOpen && (
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
                  {importedCards.map((card) => (
                    <div
                      key={card.id}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setRestoreQuoteCardMenu({
                          cardId: card.id,
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
                        {card.treeTitle || '未命名卡片'} · {card.nodeCount ?? 0} 个节点
                      </div>
                      <div style={{ fontSize: '12px', lineHeight: 1.55, color: 'var(--text-primary)' }}>
                        {card.text.length > 72 ? `${card.text.slice(0, 72)}...` : card.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {restoreQuoteCardMenu && (
            <div
              className="canvas-context-menu"
              style={{
                left: restoreQuoteCardMenu.x,
                top: restoreQuoteCardMenu.y,
                zIndex: 40
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="canvas-context-menu-item"
                onClick={() => {
                  const card = importedCards.find((item) => item.id === restoreQuoteCardMenu.cardId)
                  if (card) restoreImportedQuoteCard(card)
                }}
              >
                <RotateCcw size={14} />
                还原到卡片池
              </button>
            </div>
          )}

          {isQueueTrayMinimized ? (
            <button
              type="button"
              onClick={() => setIsQueueTrayMinimized(false)}
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
              <span style={{ color: 'var(--accent-color)', fontSize: '13px', fontWeight: 600 }}>金句卡片池</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{visibleQueueQuotes.length} 张</span>
              <ChevronUp size={14} color="var(--accent-color)" />
            </button>
          ) : (
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
                  <div style={{ fontSize: '13px', color: 'var(--accent-color)', marginBottom: '2px' }}>待拖入金句卡片池</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    从这里拖入中间大画布，或点击直接吸收到当前选中节点/根节点
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    共 {visibleQueueQuotes.length} 张
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setIsQueueTrayMinimized(true)}
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

              {visibleQueueQuotes.length === 0 ? (
                <div style={metricCardStyle}>
                  <span>暂无待整理保存卡</span>
                  <strong>先去金句页保存树结构</strong>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '2px' }}>
                  {visibleQueueQuotes.map((quote) => (
                    <button
                      key={quote.queueItemId}
                      type="button"
                      draggable
                      onDragStart={(event) => handleQueueDragStart(quote.sourceQuoteId, event)}
                      onDragEnd={handleQueueDragEnd}
                      onClick={(event) => {
                        if (suppressQueueCardClickRef.current) {
                          event.preventDefault()
                          event.stopPropagation()
                          suppressQueueCardClickRef.current = false
                          return
                        }
                        absorbSnapshot(quote.sourceQuoteId, { consumeIntoPocket: true })
                      }}
                      style={{
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
                        padding: '14px',
                        cursor: 'grab'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '6px' }}>
                        {quote.treeTitle || '未命名卡片'} · {quote.nodeCount ?? 0} 个节点
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: 1.55, width: '100%' }}>
                        {quote.quoteText.length > 88 ? `${quote.quoteText.slice(0, 88)}...` : quote.quoteText}
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        拖入中间画布吸收
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </section>
      {isThemeExtractDialogOpen && selectedNode && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(3, 6, 12, 0.52)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
        onClick={() => {
          if (isExtractingTheme) return
          setIsThemeExtractDialogOpen(false)
          setThemeExtractError(null)
        }}
      >
        <div
          style={{
            width: 'min(440px, 100%)',
            borderRadius: '18px',
            border: '1px solid rgba(36, 44, 56, 0.95)',
            background: 'rgba(9, 11, 16, 0.96)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.38)',
            padding: '18px'
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700 }}>提取为主题</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
              会将“{selectedNode.label}”及其下所有子节点保存为一个主题卡，并自动出现在对应主题整理页的主题卡片池。
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>归属主题</label>
            <input
              value={themeDraftName}
              onChange={(event) => setThemeDraftName(event.target.value)}
              placeholder="例如：商业、幸福、组织管理"
              autoFocus
              style={{
                height: '42px',
                borderRadius: '10px',
                border: '1px solid rgba(36, 44, 56, 0.95)',
                background: 'rgba(14, 18, 26, 0.92)',
                color: 'var(--text-primary)',
                padding: '0 12px',
                outline: 'none'
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !isExtractingTheme) {
                  event.preventDefault()
                  void handleExtractTheme()
                }
              }}
            />
            {existingThemeItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>选择已有主题</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '96px', overflowY: 'auto' }}>
                  {existingThemeItems.map((theme) => {
                    const isSelected = themeDraftName.trim() === theme.themeId
                    return (
                      <button
                        key={theme.themeId}
                        type="button"
                        onClick={() => setThemeDraftName(theme.themeId)}
                        style={{
                          minHeight: '30px',
                          padding: '0 10px',
                          borderRadius: '999px',
                          border: isSelected
                            ? '1px solid rgba(45, 212, 191, 0.72)'
                            : '1px solid rgba(36, 44, 56, 0.95)',
                          background: isSelected
                            ? 'rgba(20, 184, 166, 0.18)'
                            : 'rgba(14, 18, 26, 0.82)',
                          color: isSelected ? 'var(--accent-color)' : 'var(--text-muted)',
                          fontSize: '12px'
                        }}
                      >
                        {theme.themeName}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {themeExtractError && (
              <div style={{ color: '#fca5a5', fontSize: '12px' }}>{themeExtractError}</div>
            )}
          </div>
          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                setIsThemeExtractDialogOpen(false)
                setThemeExtractError(null)
              }}
              disabled={isExtractingTheme}
            >
              取消
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void handleExtractTheme()}
              disabled={isExtractingTheme}
            >
              {isExtractingTheme ? '提取中...' : '确认提取'}
            </button>
          </div>
        </div>
      </div>
      )}
    </>
  )
}
