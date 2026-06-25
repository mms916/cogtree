import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Check,
  ChevronUp,
  Download,
  LayoutTemplate,
  Maximize,
  Minus,
  Network,
  Plus,
  Redo2,
  Save,
  Share2,
  Sparkles,
  Trash2,
  Undo2,
  X
} from 'lucide-react'

import { CanvasExportMenu } from '../components/CanvasExportMenu'
import { FocusTimerButton } from '../components/FocusTimerButton'
import { fetchJson } from '../lib/api'
import { downloadMarkdownFile, downloadTreeImage } from '../lib/treeExport'
import { CanvasWorkspace } from '../modules/canvas/CanvasWorkspace'
import { NodeKnowledgePanel } from '../modules/canvas/NodeKnowledgePanel'
import type { BaseNode } from '../stores/useDocumentStore'
import { useDocumentStore } from '../stores/useDocumentStore'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useUIStore } from '../stores/useUIStore'

type QuotesResponse = {
  success: true
  data: {
    items: Array<{ id: string; originalText: string; extractionStatus: string }>
  }
}

type SelectionActionPosition = {
  top: number
  left: number
}

type WorkbenchPosition = {
  left: number
  top: number
}

type WorkbenchDragState = WorkbenchPosition & {
  pointerId: number
  originX: number
  originY: number
}

type WorkbenchSize = {
  width: number
  height: number
}

type WorkbenchResizeState = WorkbenchPosition & WorkbenchSize & {
  pointerId: number
  originX: number
  originY: number
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

type PanelKeyword = {
  id: string
  text: string
}

type QuoteWorkspaceCommandName =
  | 'create_node'
  | 'create_sibling_node'
  | 'rename_node'
  | 'delete_node'
  | 'move_node_as_child'
  | 'move_node_as_sibling'
  | 'toggle_node_collapsed'
  | 'update_node_notes'
  | 'update_node_meta'
  | 'generate_keyword_nodes'
  | 'update_quote_text'

function getSelectionActionPosition(
  textarea: HTMLTextAreaElement,
  anchorIndex: number
): SelectionActionPosition | null {
  if (typeof window === 'undefined') return null

  const computedStyle = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  const copiedStyles = [
    'box-sizing',
    'width',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'letter-spacing',
    'line-height',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'text-transform',
    'text-indent',
    'text-decoration',
    'text-align',
    'white-space',
    'word-break',
    'overflow-wrap'
  ]

  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordBreak = 'break-word'
  mirror.style.overflowWrap = 'break-word'

  copiedStyles.forEach((name) => {
    mirror.style.setProperty(name, computedStyle.getPropertyValue(name))
  })

  mirror.style.width = `${textarea.clientWidth}px`
  mirror.textContent = textarea.value.slice(0, anchorIndex)

  if (mirror.textContent.endsWith('\n')) {
    mirror.textContent += ' '
  }

  marker.textContent = textarea.value.slice(anchorIndex, anchorIndex + 1) || ' '
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const mirrorRect = mirror.getBoundingClientRect()
  const markerRect = marker.getBoundingClientRect()
  document.body.removeChild(mirror)

  const estimatedMenuWidth = 170
  const estimatedMenuHeight = 34
  const left = markerRect.left - mirrorRect.left - textarea.scrollLeft + 20
  const top = markerRect.bottom - mirrorRect.top - textarea.scrollTop + 25

  return {
    left: Math.max(8, Math.min(left, textarea.clientWidth - estimatedMenuWidth - 8)),
    top: Math.max(6, Math.min(top, textarea.clientHeight - estimatedMenuHeight - 6))
  }
}

function createPanelKeywords(texts?: string[]): PanelKeyword[] {
  return (texts ?? [])
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `${Date.now()}-${index}-${text}`,
      text
    }))
}

export function QuotesPage() {
  const [, setSelectedNodeId] = useState<string | null>(null)
  const [knowledgeNodeId, setKnowledgeNodeId] = useState<string | null>(null)
  const lastKnowledgeToggleRef = useRef<{ nodeId: string | null; timestamp: number }>({ nodeId: null, timestamp: 0 })
  const [selectedText, setSelectedText] = useState('')
  const [isSelecting, setIsSelecting] = useState(false)
  const [isQuoteWorkbenchOpen, setIsQuoteWorkbenchOpen] = useState(false)
  const [currentHighlight, setCurrentHighlight] = useState('')
  const [panelKeywords, setPanelKeywords] = useState<PanelKeyword[]>([])
  const [hoveredKeywordId, setHoveredKeywordId] = useState<string | null>(null)
  const [selectionActionPosition, setSelectionActionPosition] = useState<SelectionActionPosition | null>(null)
  const [workbenchPosition, setWorkbenchPosition] = useState<WorkbenchPosition | null>(null)
  const [workbenchSize, setWorkbenchSize] = useState<WorkbenchSize>({ width: 420, height: 430 })
  const [isWorkbenchDragging, setIsWorkbenchDragging] = useState(false)
  const [isWorkbenchResizing, setIsWorkbenchResizing] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)

  const quoteTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)
  const workbenchRef = useRef<HTMLDivElement | null>(null)
  const workbenchDragRef = useRef<WorkbenchDragState | null>(null)
  const workbenchResizeRef = useRef<WorkbenchResizeState | null>(null)
  const skipNextQuoteAutoLoadRef = useRef(false)
  const suspendDefaultQuoteLoadRef = useRef(false)
  const lastAutoSavedSnapshotRef = useRef<string | null>(null)
  const quoteCommandSequenceRef = useRef(0)
  const lastKnowledgeNodeRef = useRef<BaseNode | null>(null)
  const lastLoadedQuoteIdRef = useRef<string | null>(null)

  const {
    nodes,
    rootNodeIds,
    undoStack,
    redoStack,
    setTree,
    createNode,
    updateNodeLabel,
    updateNodeMeta,
    updateNodeNotes,
    clearNodes,
    undo,
    redo
  } = useDocumentStore()
  const { books, quotes, selectedBookId, selectedQuoteId, loadLibraryFromApi, saveQuoteWorkspace, upsertQuoteFromApi, selectQuote } = useLibraryStore()
  const { openResourceDrawer, setResourceDrawerView } = useUIStore()
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
  const currentBook = books.find((book) => book.id === selectedBookId) || books[0] || null
  const currentQuote = currentBook
    ? quotes.find((quote) => quote.bookId === currentBook.id && quote.status === 'pending') || null
    : null
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(currentQuote?.id ?? null)
  const activeQuote = activeQuoteId ? quotes.find((quote) => quote.id === activeQuoteId) ?? null : null
  const [quoteText, setQuoteText] = useState(currentQuote ? currentQuote.text : '')
  const exportTitle = `${currentBook?.title ?? '未选择书籍'}-金句提炼`

  const buildWorkspacePayload = (
    textValue: string,
    quoteIdOverride?: string | null,
    nodeMapOverride?: typeof nodes,
    rootIdsOverride?: typeof rootNodeIds,
    workspaceKeywordTextsOverride?: string[]
  ) => {
    if (!currentBook) return null

    const effectiveNodes = nodeMapOverride ?? nodes
    const effectiveRootNodeIds = rootIdsOverride ?? rootNodeIds
    const workspaceKeywords = Array.from(
      new Set(
        (workspaceKeywordTextsOverride ?? panelKeywords.map((keyword) => keyword.text))
          .map((keyword) => keyword.trim())
          .filter(Boolean)
      )
    )
    const text = textValue.trim() || activeQuote?.text?.trim() || ''
    const treeTitle = effectiveRootNodeIds
      .map((rootNodeId) => effectiveNodes[rootNodeId]?.label.trim())
      .find(Boolean) || text.slice(0, 16) || '未命名主题'

    const nodeSnapshot = Object.fromEntries(
      Object.entries(effectiveNodes).map(([nodeId, node]) => [
        nodeId,
        {
          ...node,
          childrenIds: [...node.childrenIds],
          meta: node.meta ? { ...node.meta } : undefined
        }
      ])
    )

    return {
      quoteId: quoteIdOverride ?? activeQuote?.id,
      bookId: currentBook.id,
      text,
      nodes: nodeSnapshot,
      rootNodeIds: [...effectiveRootNodeIds],
      treeTitle,
      workspaceKeywords
    }
  }

  const buildWorkspaceSnapshot = (
    textValue: string,
    quoteIdOverride?: string | null,
    nodeMapOverride?: typeof nodes,
    rootIdsOverride?: typeof rootNodeIds,
    workspaceKeywordTextsOverride?: string[]
  ) => {
    const payload = buildWorkspacePayload(
      textValue,
      quoteIdOverride,
      nodeMapOverride,
      rootIdsOverride,
      workspaceKeywordTextsOverride
    )
    return payload ? JSON.stringify(payload) : null
  }

  const runQuoteWorkspaceCommand = useCallback(async (
    commandName: QuoteWorkspaceCommandName,
    payload: Record<string, unknown> = {},
    options?: {
      targetId?: string | null
      targetType?: 'quote_workspace' | 'quote_node' | 'quote_card'
      snapshotKeywordTexts?: string[]
    }
  ) => {
    const quoteId = activeQuoteId ?? selectedQuoteId
    if (!quoteId) return

    const storeState = useDocumentStore.getState()
    const snapshotPayload = buildWorkspacePayload(
      quoteText,
      quoteId,
      storeState.nodes,
      storeState.rootNodeIds,
      options?.snapshotKeywordTexts
    )
    if (!snapshotPayload) return

    const snapshot = JSON.stringify(snapshotPayload)
    lastAutoSavedSnapshotRef.current = snapshot
    const commandSequence = ++quoteCommandSequenceRef.current

    try {
      const response = await fetchJson<{ success: true; data: typeof activeQuote extends never ? never : any }>(
        `/quote-workspaces/${quoteId}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commandName,
            targetId: options?.targetId ?? null,
            targetType: options?.targetType ?? 'quote_node',
            clientVersion: undefined,
            payload,
            snapshot: snapshotPayload
          })
        }
      )

      if (commandSequence !== quoteCommandSequenceRef.current) return

      const savedQuote = response.data
      upsertQuoteFromApi(savedQuote)
      setActiveQuoteId(savedQuote.id)
      setPanelKeywords(createPanelKeywords(savedQuote.workspaceKeywords))
      if (savedQuote.treeSnapshot) {
        setTree(`quote-${savedQuote.id}`, savedQuote.treeSnapshot.nodes, savedQuote.treeSnapshot.rootNodeIds)
      }
      lastAutoSavedSnapshotRef.current = buildWorkspaceSnapshot(
        savedQuote.text,
        savedQuote.id,
        savedQuote.treeSnapshot?.nodes ?? {},
        savedQuote.treeSnapshot?.rootNodeIds ?? [],
        savedQuote.workspaceKeywords ?? []
      )
    } catch (error) {
      console.warn(`Failed to run quote workspace command: ${commandName}`, error)
    }
  }, [
    activeQuoteId,
    buildWorkspaceSnapshot,
    quoteText,
    selectedQuoteId,
    setTree,
    upsertQuoteFromApi
  ])

  useQuery({
    queryKey: ['quotes'],
    queryFn: () => fetchJson<QuotesResponse>('/books/book-1/quotes')
  })

  useEffect(() => {
    loadLibraryFromApi().catch((error) => {
      console.warn('Failed to load library from API.', error)
    })
  }, [loadLibraryFromApi])

  useEffect(() => {
    if (skipNextQuoteAutoLoadRef.current) {
      skipNextQuoteAutoLoadRef.current = false
      return
    }
    if (suspendDefaultQuoteLoadRef.current) return

    setActiveQuoteId(currentQuote?.id ?? null)
  }, [currentQuote?.id])

  useEffect(() => {
    if (!selectedQuoteId) return
    const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId)
    if (!selectedQuote) return

    const isSwitchingQuote = lastLoadedQuoteIdRef.current !== selectedQuote.id
    lastLoadedQuoteIdRef.current = selectedQuote.id

    suspendDefaultQuoteLoadRef.current = false
    setActiveQuoteId(selectedQuote.id)
    setQuoteText(selectedQuote.text)
    setPanelKeywords(createPanelKeywords(selectedQuote.workspaceKeywords))
    setCurrentHighlight('')
    setSelectedText('')
    setIsSelecting(false)
    setSelectionActionPosition(null)
    if (isSwitchingQuote) {
      setSelectedNodeId(null)
      setKnowledgeNodeId(null)
      setIsQuoteWorkbenchOpen(false)
    }

    if (selectedQuote.treeSnapshot) {
      setTree(`quote-${selectedQuote.id}`, selectedQuote.treeSnapshot.nodes, selectedQuote.treeSnapshot.rootNodeIds)
    } else {
      clearNodes()
    }

    lastAutoSavedSnapshotRef.current = buildWorkspaceSnapshot(
      selectedQuote.text,
      selectedQuote.id,
      selectedQuote.treeSnapshot?.nodes ?? {},
      selectedQuote.treeSnapshot?.rootNodeIds ?? [],
      selectedQuote.workspaceKeywords ?? []
    )
  }, [clearNodes, quotes, selectedQuoteId, setTree])

  useEffect(() => {
    if (selectedQuoteId) return
    if (activeQuote) {
      setQuoteText(activeQuote.text)
      setPanelKeywords(createPanelKeywords(activeQuote.workspaceKeywords))
      if (activeQuote.treeSnapshot) {
        setTree(`quote-${activeQuote.id}`, activeQuote.treeSnapshot.nodes, activeQuote.treeSnapshot.rootNodeIds)
      } else {
        clearNodes()
      }
    } else {
      setQuoteText('')
      setPanelKeywords([])
      clearNodes()
    }

    lastAutoSavedSnapshotRef.current = activeQuote
      ? buildWorkspaceSnapshot(
          activeQuote.text,
          activeQuote.id,
          activeQuote.treeSnapshot?.nodes ?? {},
          activeQuote.treeSnapshot?.rootNodeIds ?? [],
          activeQuote.workspaceKeywords ?? []
        )
      : null
  }, [
    activeQuote?.id,
    activeQuote?.text,
    activeQuote?.treeSnapshot,
    activeQuote?.workspaceKeywords,
    clearNodes,
    selectedQuoteId,
    setTree
  ])

  useEffect(() => {
    if (saveState === 'idle') return

    const timeoutId = window.setTimeout(() => setSaveState('idle'), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [saveState])

  useEffect(() => {
    // 自动保存已禁用，用户需手动点击保存按钮
    // 此 effect 仅用于检测变化，但不会触发保存
    return
  }, [
    activeQuote?.id,
    activeQuote?.status,
    currentBook,
    nodes,
    panelKeywords,
    quoteText,
    rootNodeIds,
    selectedQuoteId
  ])

  useEffect(() => {
    if (!isSelecting || !quoteTextareaRef.current) return

    const textarea = quoteTextareaRef.current
    const selectionEnd = textarea.selectionEnd ?? textarea.selectionStart ?? 0
    setSelectionActionPosition(getSelectionActionPosition(textarea, selectionEnd))
  }, [isSelecting])

  const handleSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = event.target as HTMLTextAreaElement
    const selectionStart = target.selectionStart ?? 0
    const selectionEnd = target.selectionEnd ?? selectionStart
    const text = target.value.substring(selectionStart, selectionEnd).trim()

    if (text) {
      setSelectedText(text)
      setIsSelecting(true)
      setSelectionActionPosition(getSelectionActionPosition(target, selectionEnd))
    } else {
      setIsSelecting(false)
      setSelectionActionPosition(null)
    }
  }

  const handleCombineHighlight = () => {
    if (!selectedText) return

    setCurrentHighlight((prev) => (prev ? `${prev} ${selectedText}` : selectedText))
    setSelectedText('')
    setIsSelecting(false)
    window.getSelection()?.removeAllRanges()
  }

  const handleGenerateKeyword = () => {
    const textToGenerate = currentHighlight || selectedText
    if (!textToGenerate) return

    setPanelKeywords((prev) => [...prev, { id: Date.now().toString(), text: textToGenerate }])
    setCurrentHighlight('')
    setSelectedText('')
    setIsSelecting(false)
    setSelectionActionPosition(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleDeleteKeyword = (keywordId: string) => {
    setPanelKeywords((prev) => prev.filter((keyword) => keyword.id !== keywordId))
  }

  const handleGenerateNodesFromKeywords = async () => {
    if (panelKeywords.length === 0) return

    const containerRect = canvasContainerRef.current?.getBoundingClientRect()
    const canvasWidth = containerRect?.width ?? 1200
    const canvasHeight = containerRect?.height ?? 760
    const columns = Math.min(3, panelKeywords.length)
    const spacingX = 220
    const spacingY = 126
    const totalWidth = (columns - 1) * spacingX
    const startX = Math.max(120, canvasWidth / 2 - totalWidth / 2)
    const startY = Math.max(120, canvasHeight * 0.24)

    const storeState = useDocumentStore.getState()
    const newNodes = { ...storeState.nodes }
    const newRootNodeIds = [...storeState.rootNodeIds]

    panelKeywords.forEach((keyword, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const jitterX = Math.random() * 18 - 9
      const jitterY = Math.random() * 16 - 8
      const position = {
        x: startX + column * spacingX + jitterX,
        y: startY + row * spacingY + jitterY
      }

      const nodeId = createNode(
        null,
        keyword.text,
        position,
        'concept'
      )

      if (nodeId) {
        newNodes[nodeId] = {
          id: nodeId,
          label: keyword.text,
          parentId: null,
          childrenIds: [],
          orderIndex: newRootNodeIds.length,
          nodeType: 'concept',
          status: 'normal',
          position
        }
        newRootNodeIds.push(nodeId)
      }
    })

    const payload = buildWorkspacePayload(
      quoteText,
      activeQuoteId ?? selectedQuoteId ?? undefined,
      newNodes,
      newRootNodeIds,
      []
    )

    if (payload) {
      lastAutoSavedSnapshotRef.current = JSON.stringify(payload)
    }

    if (activeQuoteId || selectedQuoteId) {
      await runQuoteWorkspaceCommand('generate_keyword_nodes', {
        keywords: panelKeywords.map((keyword) => keyword.text),
        nodeCount: panelKeywords.length
      }, {
        targetId: activeQuoteId ?? selectedQuoteId,
        targetType: 'quote_workspace',
        snapshotKeywordTexts: []
      })
    }

    setPanelKeywords([])
    setIsQuoteWorkbenchOpen(false)
    setIsSelecting(false)
    setSelectionActionPosition(null)
    setSelectedText('')
    setCurrentHighlight('')
    setSelectedNodeId(null)
    setKnowledgeNodeId(null)
  }

  const handleSaveWorkspace = async () => {
    const payload = buildWorkspacePayload(quoteText)
    if (!payload || (!payload.text && Object.keys(payload.nodes).length === 0)) return

    try {
      skipNextQuoteAutoLoadRef.current = true
      suspendDefaultQuoteLoadRef.current = true
      const savedQuoteId = await saveQuoteWorkspace(payload)
      lastAutoSavedSnapshotRef.current = JSON.stringify(payload)
      setSaveState('saved')
      setActiveQuoteId(savedQuoteId)
      setResourceDrawerView('quotes')
      openResourceDrawer()
      selectQuote(null)
      clearNodes()
      setActiveQuoteId(null)
      setQuoteText('')
      setPanelKeywords([])
      setHoveredKeywordId(null)
      setCurrentHighlight('')
      setSelectedText('')
      setIsSelecting(false)
      setSelectionActionPosition(null)
      setSelectedNodeId(null)
      setKnowledgeNodeId(null)
      lastAutoSavedSnapshotRef.current = buildWorkspaceSnapshot('', null, {}, [])
    } catch (error) {
      console.warn('Failed to save quote workspace.', error)
      setSaveState('error')
    }
  }

  const handleExportMarkdownOutline = () => {
    downloadMarkdownFile(nodes, rootNodeIds, { title: exportTitle })
    setIsExportMenuOpen(false)
  }

  const handleExportMarkdownKnowledge = () => {
    downloadMarkdownFile(nodes, rootNodeIds, {
      title: exportTitle,
      includeKnowledge: true,
      linkedQuoteText: quoteText
    })
    setIsExportMenuOpen(false)
  }

  const handleExportImage = async (resolution: '2k' | '4k') => {
    try {
      await downloadTreeImage(nodes, rootNodeIds, exportTitle, resolution)
    } catch (error) {
      console.warn('Failed to export tree image.', error)
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
        return currentNodeId
      }

      lastKnowledgeToggleRef.current = { nodeId, timestamp: now }
      return nodeId
    })
  }, [])

  const handleWorkbenchPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canvasContainerRef.current || !workbenchRef.current) return
    event.preventDefault()
    event.stopPropagation()

    const containerRect = canvasContainerRef.current.getBoundingClientRect()
    const panelRect = workbenchRef.current.getBoundingClientRect()

    workbenchDragRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      left: panelRect.left - containerRect.left,
      top: panelRect.top - containerRect.top
    }
    setIsWorkbenchDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleWorkbenchPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = workbenchDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId || !canvasContainerRef.current || !workbenchRef.current) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    const containerRect = canvasContainerRef.current.getBoundingClientRect()
    const panelRect = workbenchRef.current.getBoundingClientRect()
    const padding = 12
    const nextLeft = dragState.left + event.clientX - dragState.originX
    const nextTop = dragState.top + event.clientY - dragState.originY

    setWorkbenchPosition({
      left: Math.max(padding, Math.min(nextLeft, containerRect.width - panelRect.width - padding)),
      top: Math.max(padding, Math.min(nextTop, containerRect.height - panelRect.height - padding))
    })
  }

  const handleWorkbenchPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (workbenchDragRef.current?.pointerId === event.pointerId) {
      event.preventDefault()
      event.stopPropagation()
      workbenchDragRef.current = null
      setIsWorkbenchDragging(false)
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleWorkbenchResizePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    corner: WorkbenchResizeState['corner']
  ) => {
    if (event.button !== 0 || !canvasContainerRef.current || !workbenchRef.current) return
    event.preventDefault()
    event.stopPropagation()

    const containerRect = canvasContainerRef.current.getBoundingClientRect()
    const panelRect = workbenchRef.current.getBoundingClientRect()
    const left = panelRect.left - containerRect.left
    const top = panelRect.top - containerRect.top

    workbenchResizeRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      left,
      top,
      width: panelRect.width,
      height: panelRect.height,
      corner
    }
    setWorkbenchPosition({ left, top })
    setIsWorkbenchResizing(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleWorkbenchResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resizeState = workbenchResizeRef.current
    if (!resizeState || resizeState.pointerId !== event.pointerId || !canvasContainerRef.current) return
    event.preventDefault()
    event.stopPropagation()

    const containerRect = canvasContainerRef.current.getBoundingClientRect()
    const padding = 12
    const minWidth = 360
    const minHeight = 360
    const maxWidth = Math.max(minWidth, containerRect.width - padding * 2)
    const maxHeight = Math.max(minHeight, containerRect.height - 122)
    const deltaX = event.clientX - resizeState.originX
    const deltaY = event.clientY - resizeState.originY
    const resizingLeft = resizeState.corner.includes('left')
    const resizingTop = resizeState.corner.includes('top')
    const nextWidth = Math.min(maxWidth, Math.max(minWidth, resizeState.width + (resizingLeft ? -deltaX : deltaX)))
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, resizeState.height + (resizingTop ? -deltaY : deltaY)))
    const nextLeft = resizingLeft ? resizeState.left + resizeState.width - nextWidth : resizeState.left
    const nextTop = resizingTop ? resizeState.top + resizeState.height - nextHeight : resizeState.top

    setWorkbenchSize({ width: nextWidth, height: nextHeight })
    setWorkbenchPosition({
      left: Math.max(padding, Math.min(nextLeft, containerRect.width - nextWidth - padding)),
      top: Math.max(padding, Math.min(nextTop, containerRect.height - nextHeight - padding))
    })
  }

  const handleWorkbenchResizePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (workbenchResizeRef.current?.pointerId === event.pointerId) {
      event.preventDefault()
      event.stopPropagation()
      workbenchResizeRef.current = null
      setIsWorkbenchResizing(false)
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const keywordCount = panelKeywords.length
  const linkedQuoteText = quoteText.trim() || activeQuote?.text || ''
  const quoteCardSummary = activeQuote?.quoteCardSummary
  const structureSummaryItems = [
    { label: '原因', value: quoteCardSummary?.causeList.length ?? 0 },
    { label: '结果', value: quoteCardSummary?.effectList.length ?? 0 },
    { label: '待定', value: quoteCardSummary?.pendingList.length ?? 0 },
    { label: '中间步骤', value: quoteCardSummary?.middleStepList.length ?? 0 },
    { label: '候选节点', value: quoteCardSummary?.candidateNodes.length ?? 0 },
    { label: '候选关系', value: quoteCardSummary?.candidateEdges.length ?? 0 },
    { label: '待解问题', value: quoteCardSummary?.pendingQuestions.length ?? 0 },
    { label: '备注', value: quoteCardSummary?.notes.length ?? 0 }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0 }}>
      <header className="top-bar" style={{ flexShrink: 0 }}>
        <div className="breadcrumbs">
          <span>书籍</span>
          <span>/</span>
          <span>{currentBook?.title ?? '未选择书籍'}</span>
          <span>/</span>
          <span className="current">金句提炼</span>
        </div>
        <div className="top-bar-actions" style={{ marginLeft: 'auto' }}>
          <button className="primary" onClick={handleSaveWorkspace}>
            {saveState === 'saved' ? <Check size={14} /> : <Save size={14} />}
            {saveState === 'saved' ? '已保存' : saveState === 'error' ? '保存失败' : '保存'}
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

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <div className="workspace-area" style={{ flex: 1, minWidth: 0, borderTop: 'none' }}>
          <div className="canvas-container" ref={canvasContainerRef}>
            {isQuoteWorkbenchOpen ? (
              <>
                <div
                  ref={workbenchRef}
                  style={{
                    position: 'absolute',
                    ...(workbenchPosition
                      ? { left: `${workbenchPosition.left}px`, top: `${workbenchPosition.top}px` }
                      : { left: '50%', bottom: '86px', transform: 'translateX(-50%)' }),
                    width: `${workbenchSize.width}px`,
                    height: `${workbenchSize.height}px`,
                    maxWidth: 'calc(100% - 32px)',
                    maxHeight: 'calc(100% - 122px)',
                    zIndex: 18,
                    background: 'rgba(19, 23, 32, 0.88)',
                    border: '1px solid rgba(45, 212, 191, 0.28)',
                    borderRadius: '8px',
                    boxShadow: '0 18px 44px rgba(0,0,0,0.34)',
                    backdropFilter: 'blur(14px)',
                    overflow: 'visible',
                    opacity: isWorkbenchDragging || isWorkbenchResizing ? 0.9 : 1
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerMove={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: '-9px',
                      width: '16px',
                      height: '16px',
                      background: 'rgba(19, 23, 32, 0.88)',
                      borderRight: '1px solid rgba(45, 212, 191, 0.28)',
                      borderBottom: '1px solid rgba(45, 212, 191, 0.28)',
                      transform: 'translateX(-50%) rotate(45deg)',
                      zIndex: 0
                    }}
                  />
                  {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => (
                    <div
                      key={corner}
                      onPointerDown={(event) => handleWorkbenchResizePointerDown(event, corner)}
                      onPointerMove={handleWorkbenchResizePointerMove}
                      onPointerUp={handleWorkbenchResizePointerUp}
                      onPointerCancel={handleWorkbenchResizePointerUp}
                      style={{
                        position: 'absolute',
                        zIndex: 4,
                        width: '18px',
                        height: '18px',
                        cursor: corner === 'top-left' || corner === 'bottom-right' ? 'nwse-resize' : 'nesw-resize',
                        ...(corner.includes('top') ? { top: '-3px' } : { bottom: '-3px' }),
                        ...(corner.includes('left') ? { left: '-3px' } : { right: '-3px' })
                      }}
                      title="拖动调整工作台大小"
                    />
                  ))}
                  <div style={{ position: 'relative', zIndex: 1, height: '100%', overflow: 'hidden', borderRadius: '8px', background: 'rgba(19, 23, 32, 0.88)' }}>
                    <div
                      onPointerDown={handleWorkbenchPointerDown}
                      onPointerMove={handleWorkbenchPointerMove}
                      onPointerUp={handleWorkbenchPointerUp}
                      onPointerCancel={handleWorkbenchPointerUp}
                      style={{
                        height: '42px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 28px 28px',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0 10px 0 14px',
                        cursor: isWorkbenchDragging ? 'grabbing' : 'grab',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700 }}>金句工作台</span>
                      </div>
                      <ChevronUp size={14} color="var(--text-primary)" />
                      <button
                        className="icon-btn"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => setIsQuoteWorkbenchOpen(false)}
                        title="关闭工作台"
                        style={{ justifySelf: 'end', padding: '4px', color: 'var(--text-muted)' }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div style={{ height: 'calc(100% - 42px)', overflowY: 'auto', padding: '0 12px 12px 12px' }}>
                      <div style={{ minWidth: 0, display: 'grid', gridTemplateColumns: workbenchSize.width >= 620 ? 'minmax(0, 1.1fr) minmax(280px, 0.9fr)' : '1fr', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                          <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                              原文
                            </label>
                            <textarea
                              ref={quoteTextareaRef}
                              value={quoteText}
                              onChange={(event) => setQuoteText(event.target.value)}
                              onSelect={handleSelect}
                              onMouseUp={handleSelect}
                              onKeyUp={handleSelect}
                              onScroll={handleSelect}
                              placeholder="在这里输入或粘贴金句..."
                              style={{
                                width: '100%',
                                minHeight: '98px',
                                height: workbenchSize.width >= 620 ? '132px' : '112px',
                                maxHeight: `${Math.max(132, workbenchSize.height - 238)}px`,
                                background: 'rgba(14, 18, 26, 0.92)',
                                padding: '9px 10px 18px',
                                borderRadius: '6px',
                                border: '1px solid rgba(47, 57, 72, 0.95)',
                                fontSize: '12px',
                                lineHeight: '1.5',
                                color: 'var(--text-primary)',
                                resize: 'vertical',
                                outline: 'none',
                                fontFamily: 'inherit'
                              }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                right: '12px',
                                bottom: '8px',
                                color: 'var(--text-muted)',
                                fontSize: '11px'
                              }}
                            >
                              {quoteText.length}/300
                            </span>

                            {(currentHighlight || isSelecting) && selectionActionPosition && (
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${selectionActionPosition.left}px`,
                                  top: `${selectionActionPosition.top}px`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '3px',
                                  background: 'rgba(9, 11, 16, 0.9)',
                                  border: '1px solid rgba(45, 212, 191, 0.2)',
                                  borderRadius: '999px',
                                  boxShadow: '0 4px 10px rgba(0,0,0,0.18)'
                                }}
                              >
                                <button
                                  className="secondary"
                                  onClick={handleCombineHighlight}
                                  disabled={!isSelecting}
                                  style={{ justifyContent: 'center', padding: '3px 8px', fontSize: '10px' }}
                                >
                                  选中片段
                                </button>
                                <button
                                  className="primary"
                                  onClick={handleGenerateKeyword}
                                  disabled={!currentHighlight && !isSelecting}
                                  style={{ justifyContent: 'center', padding: '3px 8px', fontSize: '10px' }}
                                >
                                  生成关键词
                                </button>
                              </div>
                            )}
                          </div>

                          <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                              选中片段（可调整）
                            </label>
                            <div
                              style={{
                                minHeight: '42px',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 10px 16px',
                                background: 'rgba(14, 18, 26, 0.92)',
                                border: '1px solid rgba(47, 57, 72, 0.95)',
                                borderRadius: '6px',
                                color: 'var(--accent-color)',
                                fontSize: '12px',
                                lineHeight: 1.45
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  minHeight: '26px',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  background: currentHighlight || selectedText ? 'rgba(45, 212, 191, 0.16)' : 'transparent'
                                }}
                              >
                                {currentHighlight || selectedText || '选中文本后显示片段'}
                              </span>
                            </div>
                            <span
                              style={{
                                position: 'absolute',
                                right: '12px',
                                bottom: '8px',
                                color: 'var(--text-muted)',
                                fontSize: '11px'
                              }}
                            >
                              {(currentHighlight || selectedText).length}/100
                            </span>
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            生成的关键词
                          </label>
                          <div
                            style={{
                              minHeight: '58px',
                              maxHeight: '96px',
                              overflowY: 'auto',
                              padding: '8px',
                              background: 'rgba(14, 18, 26, 0.72)',
                              border: '1px solid rgba(47, 57, 72, 0.95)',
                              borderRadius: '6px',
                              display: 'flex',
                              alignContent: 'flex-start',
                              alignItems: 'flex-start',
                              flexWrap: 'wrap',
                              gap: '6px'
                            }}
                          >
                            {panelKeywords.length === 0 && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>选中文本后生成关键词</span>
                            )}
                            {panelKeywords.map((keyword) => (
                              <div
                                key={keyword.id}
                                onMouseEnter={() => setHoveredKeywordId(keyword.id)}
                                onMouseLeave={() => setHoveredKeywordId(null)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  minHeight: '26px',
                                  padding: '4px 8px',
                                  background: 'rgba(148, 163, 184, 0.12)',
                                  border: '1px solid rgba(148, 163, 184, 0.12)',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  lineHeight: '1.25',
                                  color: 'var(--text-primary)'
                                }}
                              >
                                <span>{keyword.text}</span>
                                {hoveredKeywordId === keyword.id && (
                                  <button
                                    className="icon-btn"
                                    onClick={() => handleDeleteKeyword(keyword.id)}
                                    style={{ padding: '1px', color: 'var(--error-color, #ef4444)' }}
                                    title="删除关键词"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={handleGenerateKeyword}
                              disabled={!currentHighlight && !selectedText}
                              style={{
                                minHeight: '26px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px dashed rgba(148, 163, 184, 0.42)',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                fontSize: '12px'
                              }}
                            >
                              <Plus size={14} /> 添加关键词
                            </button>
                          </div>

                          <div
                            style={{
                              display: 'none',
                              marginTop: '10px',
                              padding: '10px 12px',
                              background: 'rgba(14, 18, 26, 0.72)',
                              border: '1px solid rgba(47, 57, 72, 0.95)',
                              borderRadius: '6px',
                              flexDirection: 'column',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>结构摘要</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>来自当前保存卡</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {structureSummaryItems.map((item) => (
                                <span
                                  key={item.label}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    minHeight: '28px',
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    background: 'rgba(148, 163, 184, 0.08)',
                                    border: '1px solid rgba(148, 163, 184, 0.12)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '12px'
                                  }}
                                >
                                  <span>{item.label}</span>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.value}</span>
                                </span>
                              ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>原因 / 结果</div>
                                <div style={{ color: 'var(--text-primary)', fontSize: '12px', lineHeight: 1.55 }}>
                                  {[...(quoteCardSummary?.causeList ?? []), ...(quoteCardSummary?.effectList ?? [])].slice(0, 3).join(' / ') || '暂无'}
                                </div>
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>待定问题</div>
                                <div style={{ color: 'var(--text-primary)', fontSize: '12px', lineHeight: 1.55 }}>
                                  {quoteCardSummary?.pendingQuestions[0]?.question || '暂无'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                            <button
                              className="primary"
                              onClick={handleGenerateKeyword}
                              disabled={!currentHighlight && !selectedText}
                              style={{
                                minWidth: 0,
                                height: '34px',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                color: 'var(--accent-color)',
                                borderColor: 'rgba(45, 212, 191, 0.75)',
                                background: 'rgba(45, 212, 191, 0.06)',
                                fontSize: '13px',
                                fontWeight: 600
                              }}
                            >
                              <Sparkles size={14} /> 生成关键词
                            </button>
                            <button
                              className="primary"
                              onClick={handleGenerateNodesFromKeywords}
                              disabled={panelKeywords.length === 0}
                              style={{
                                minWidth: 0,
                                height: '34px',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                color: '#e6fffb',
                                borderColor: 'rgba(45, 212, 191, 0.82)',
                                background: 'linear-gradient(90deg, rgba(20, 184, 166, 0.78), rgba(94, 234, 212, 0.56))',
                                fontSize: '13px',
                                fontWeight: 600
                              }}
                            >
                              <Network size={14} /> 生成节点
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  className="primary"
                  onClick={() => setIsQuoteWorkbenchOpen(false)}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: '34px',
                    transform: 'translateX(-50%)',
                    zIndex: 19,
                    background: 'rgba(19, 23, 32, 0.94)',
                    border: '1px solid rgba(45, 212, 191, 0.68)',
                    borderRadius: '999px',
                    padding: '10px 18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '9px',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.34)',
                    backdropFilter: 'blur(10px)'
                  }}
                  title="收起金句输入"
                >
                  <Sparkles size={14} color="var(--accent-color)" />
                  <span style={{ fontSize: '14px', color: 'var(--accent-color)', fontWeight: 700 }}>金句输入</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>·</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{keywordCount}</span>
                  <ChevronUp size={14} color="var(--accent-color)" />
                </button>
              </>
            ) : (
              <button
                className="primary"
                onClick={() => setIsQuoteWorkbenchOpen(true)}
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: '34px',
                  transform: 'translateX(-50%)',
                  zIndex: 18,
                  background: 'rgba(9, 11, 16, 0.78)',
                  border: '1px solid rgba(45, 212, 191, 0.48)',
                  borderRadius: '999px',
                  padding: '9px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
                  backdropFilter: 'blur(10px)'
                }}
                title="打开金句输入"
              >
                <Sparkles size={14} color="var(--accent-color)" />
                <span style={{ fontSize: '13px', color: 'var(--accent-color)', fontWeight: 600 }}>金句输入</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>·</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{keywordCount}</span>
                <ChevronUp size={14} color="var(--accent-color)" />
              </button>
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

            {knowledgeNode && (
              <NodeKnowledgePanel
                selectedNode={knowledgeNode}
                linkedQuotes={linkedQuoteText ? [{ id: activeQuote?.id ?? 'current-quote', text: linkedQuoteText }] : []}
                onClose={() => setKnowledgeNodeId(null)}
                onUpdateLabel={(label) => {
                  updateNodeLabel(knowledgeNode.id, label)
                  if (activeQuoteId || selectedQuoteId) {
                    void runQuoteWorkspaceCommand('rename_node', { label }, {
                      targetId: knowledgeNode.id,
                      targetType: 'quote_node'
                    })
                  }
                }}
                onUpdateNotes={(notes) => {
                  updateNodeNotes(knowledgeNode.id, notes)
                  if (activeQuoteId || selectedQuoteId) {
                    void runQuoteWorkspaceCommand('update_node_notes', { noteCount: notes.length }, {
                      targetId: knowledgeNode.id,
                      targetType: 'quote_node'
                    })
                  }
                }}
                onUpdateMeta={(meta) => {
                  updateNodeMeta(knowledgeNode.id, meta)
                  if (activeQuoteId || selectedQuoteId) {
                    void runQuoteWorkspaceCommand('update_node_meta', {
                      knowledgeImageCount: Array.isArray(meta.knowledgeImages) ? meta.knowledgeImages.length : 0
                    }, {
                      targetId: knowledgeNode.id,
                      targetType: 'quote_node'
                    })
                  }
                }}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '16px',
                  bottom: '16px',
                  width: '320px',
                  zIndex: 20
                }}
              />
            )}

            <CanvasWorkspace
              onNodeSelect={setSelectedNodeId}
              onNodeInfoOpen={handleNodeInfoOpen}
              onCommand={(command) => {
                if (!(activeQuoteId || selectedQuoteId)) return
                void runQuoteWorkspaceCommand(command.commandName, command.payload ?? {}, {
                  targetId: command.targetId ?? null,
                  targetType: command.targetType === 'book_node' ? 'quote_node' : 'quote_workspace'
                })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
