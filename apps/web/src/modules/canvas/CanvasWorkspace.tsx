import { startTransition, useMemo, useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Position,
} from '@xyflow/react'
import type { Node, Edge, NodeChange, NodeTypes, ReactFlowInstance, NodePositionChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CircleCheck, CircleDot, CircleHelp, ClipboardPaste, Copy, Edit3, Eye, GitBranchPlus, ImagePlus, ListPlus, Palette, PanelTopClose, PanelTopOpen, Star, StickyNote, Trash2 } from 'lucide-react'

import type { BaseNode, NodeImageAttachment } from '../../stores/useDocumentStore'
import { useDocumentStore } from '../../stores/useDocumentStore'
import { getImageFilesFromClipboard, readImageFile } from './imageAttachments'
import { MindMapEdge } from './MindMapEdge'
import { ThemeNodeRenderer } from './ThemeNodeRenderer'

const nodeTypes: NodeTypes = {
  themeNode: ThemeNodeRenderer,
}

const edgeTypes = {
  mindMap: MindMapEdge,
}

const BRANCH_STYLES = [
  { color: '#8b5cf6', icon: 'lightbulb' },
  { color: '#3b82f6', icon: 'users' },
  { color: '#14b8a6', icon: 'gift' },
  { color: '#f59e0b', icon: 'heart' },
  { color: '#ef4444', icon: 'rocket' },
  { color: '#4f46e5', icon: 'shield' },
] as const

const EDGE_COLOR_SWATCHES = [
  '#8b5cf6',
  '#3b82f6',
  '#14b8a6',
  '#f59e0b',
  '#ef4444',
  '#4f46e5',
  '#2dd4bf',
  '#f8fafc',
] as const

const AUTO_FIT_VIEW_NODE_LIMIT = 180
const LARGE_TREE_VISIBLE_NODE_LIMIT = 650
const LARGE_TREE_COLLAPSE_DEPTH = 2
const LARGE_TREE_FANOUT_COLLAPSE_LIMIT = 80
const KEYBOARD_NAVIGATION_VISIBILITY_PADDING = 8

type CanvasNodeClipboard = {
  rootNodeId: string
  nodes: Record<string, BaseNode>
}

let canvasNodeClipboard: CanvasNodeClipboard | null = null

type CanvasNodeData = BaseNode & {
  depth: number
  branchIndex: number
  branchColor: string
  branchIcon: string
  outlineNumber: string
  isEditing: boolean
  editDraft: string
  isDropTarget: boolean
  dropPreviewMode: 'child' | 'sibling' | 'invalid' | null
  isCollapsed: boolean
  onStartEdit: () => void
  onEditDraftChange: (value: string) => void
  onSaveEdit: (value?: string) => void
  onCancelEdit: () => void
  onAddChild: () => void
  onAddSibling: () => void
  onDelete: () => void
  onToggleCollapsed: () => void
  onOpenKnowledge: () => void
  onResizeImage: (size: { width: number; height: number }, commit?: boolean) => void
  onResizeNote: (size: { width: number; height: number }, commit?: boolean) => void
  onUpdateNoteMeta: (meta: { noteBadge?: string; noteBody?: string }, commit?: boolean) => void
}

type DragPreviewState = {
  targetNodeId: string | null
  mode: 'child' | 'sibling' | 'invalid' | null
  message: string
}

type ContextMenuState = {
  nodeId: string
  x: number
  y: number
}

type PaneContextMenuState = {
  x: number
  y: number
  position: { x: number; y: number }
}

type EdgeContextMenuState = {
  edgeId: string
  targetNodeId: string
  x: number
  y: number
  color: string
  applyToDescendants: boolean
}

type CanvasContextMenuGroup = 'edit' | 'create' | 'state' | 'danger'

type CanvasContextMenuItem = {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  action: () => void
  disabled?: boolean
  danger?: boolean
  group?: CanvasContextMenuGroup
  wide?: boolean
}

function isDescendant(
  nodes: Record<string, BaseNode>,
  ancestorId: string,
  candidateId: string
): boolean {
  const ancestor = nodes[ancestorId]
  if (!ancestor) return false

  return ancestor.childrenIds.some((childId) => childId === candidateId || isDescendant(nodes, childId, candidateId))
}

function collectDescendantIds(
  nodes: Record<string, BaseNode>,
  ancestorId: string
): string[] {
  const ancestor = nodes[ancestorId]
  if (!ancestor) return []

  return ancestor.childrenIds.reduce<string[]>((allIds, childId) => {
    return [...allIds, childId, ...collectDescendantIds(nodes, childId)]
  }, [])
}

function getNodeDepth(
  nodes: Record<string, BaseNode>,
  node: BaseNode
) {
  let depth = 0
  let currentNode = node

  while (currentNode.parentId) {
    const parentNode = nodes[currentNode.parentId]
    if (!parentNode) break
    depth += 1
    currentNode = parentNode
  }

  return depth
}

function estimateNodeSize(
  nodes: Record<string, BaseNode>,
  node: BaseNode
) {
  const depth = getNodeDepth(nodes, node)

  if (node.parentId === null) {
    if (node.meta?.canvasNote === true) {
      const noteSize = node.meta.noteSize
      if (
        noteSize &&
        typeof noteSize.width === 'number' &&
        typeof noteSize.height === 'number'
      ) {
        return { width: noteSize.width, height: noteSize.height }
      }
      return { width: 330, height: 220 }
    }
    if (node.meta?.canvasImage === true) {
      const imageSize = node.meta.imageSize
      if (
        imageSize &&
        typeof imageSize.width === 'number' &&
        typeof imageSize.height === 'number'
      ) {
        return { width: imageSize.width, height: imageSize.height }
      }
      return { width: 260, height: 180 }
    }
    return { width: 174, height: 58 }
  }

  if (depth === 1) {
    return { width: 208, height: 50 }
  }

  const labelLength = Math.max(1, node.label.trim().length)
  return {
    width: Math.min(220, Math.max(40, labelLength * 16 + 26)),
    height: 28,
  }
}

function collectVisibleNodeIds(
  nodes: Record<string, BaseNode>,
  rootNodeIds: string[]
): string[] {
  const visibleIds: string[] = []

  const visit = (nodeId: string) => {
    const node = nodes[nodeId]
    if (!node) return
    visibleIds.push(nodeId)
    if (node.status === 'collapsed') return
    node.childrenIds.forEach(visit)
  }

  rootNodeIds.forEach(visit)
  return visibleIds
}

function getNodeLineage(nodes: Record<string, BaseNode>, nodeId: string): string[] {
  const lineage: string[] = []
  let currentNode: BaseNode | undefined = nodes[nodeId]

  while (currentNode) {
    lineage.unshift(currentNode.id)
    currentNode = currentNode.parentId ? nodes[currentNode.parentId] : undefined
  }

  return lineage
}

function getNodePresentation(
  nodes: Record<string, BaseNode>,
  nodeId: string
) {
  const lineage = getNodeLineage(nodes, nodeId)
  const depth = Math.max(0, lineage.length - 1)
  const rootNode = nodes[lineage[0]]
  const branchId = lineage[1]
  const branchIndex = branchId && rootNode
    ? Math.max(0, rootNode.childrenIds.indexOf(branchId))
    : 0
  const branchStyle = BRANCH_STYLES[branchIndex % BRANCH_STYLES.length]
  const outlineNumber = depth >= 2
    ? lineage
        .slice(1)
        .map((lineageNodeId) => {
          const node = nodes[lineageNodeId]
          return Math.max(0, node?.orderIndex ?? 0) + 1
        })
        .join('.')
    : ''

  return {
    depth,
    branchIndex,
    branchColor: branchStyle.color,
    branchIcon: branchStyle.icon,
    outlineNumber,
  }
}

type KeyboardNavigationDirection = 'up' | 'down' | 'left' | 'right'

function getNodeCenter(
  nodes: Record<string, BaseNode>,
  nodeId: string
) {
  const node = nodes[nodeId]
  if (!node) return null

  const nodeSize = estimateNodeSize(nodes, node)
  return {
    x: node.position.x + nodeSize.width / 2,
    y: node.position.y + nodeSize.height / 2,
  }
}

function findNearestVisibleNodeInDirection(
  nodes: Record<string, BaseNode>,
  visibleNodeIds: string[],
  selectedNodeId: string,
  direction: KeyboardNavigationDirection
) {
  const currentCenter = getNodeCenter(nodes, selectedNodeId)
  if (!currentCenter) return null

  const scoredCandidates = visibleNodeIds
    .filter((nodeId) => nodeId !== selectedNodeId)
    .map((nodeId) => {
      const candidateCenter = getNodeCenter(nodes, nodeId)
      if (!candidateCenter) return null

      const deltaX = candidateCenter.x - currentCenter.x
      const deltaY = candidateCenter.y - currentCenter.y
      const isCandidateInDirection =
        direction === 'up'
          ? deltaY < -4
          : direction === 'down'
            ? deltaY > 4
            : direction === 'left'
              ? deltaX < -4
              : deltaX > 4

      if (!isCandidateInDirection) return null

      const primaryDistance = direction === 'up' || direction === 'down'
        ? Math.abs(deltaY)
        : Math.abs(deltaX)
      const secondaryDistance = direction === 'up' || direction === 'down'
        ? Math.abs(deltaX)
        : Math.abs(deltaY)

      return {
        nodeId,
        score: primaryDistance * 1.8 + secondaryDistance * 0.52,
      }
    })
    .filter((candidate): candidate is { nodeId: string; score: number } => candidate !== null)
    .sort((left, right) => left.score - right.score)

  return scoredCandidates[0]?.nodeId ?? null
}

function findKeyboardNavigationTarget(
  nodes: Record<string, BaseNode>,
  visibleNodeIds: string[],
  selectedNodeId: string | null,
  direction: KeyboardNavigationDirection
) {
  if (visibleNodeIds.length === 0) return null
  if (!selectedNodeId || !nodes[selectedNodeId] || !visibleNodeIds.includes(selectedNodeId)) {
    return visibleNodeIds[0]
  }

  const selectedNode = nodes[selectedNodeId]

  if (direction === 'left' && selectedNode.parentId && visibleNodeIds.includes(selectedNode.parentId)) {
    return selectedNode.parentId
  }

  if (direction === 'right') {
    const firstVisibleChildId = selectedNode.childrenIds.find((childId) => visibleNodeIds.includes(childId))
    if (firstVisibleChildId) return firstVisibleChildId
  }

  return findNearestVisibleNodeInDirection(nodes, visibleNodeIds, selectedNodeId, direction)
}

function shouldCenterNodeForKeyboardNavigation(
  instance: ReactFlowInstance,
  containerElement: HTMLElement | null,
  nodes: Record<string, BaseNode>,
  nodeId: string
) {
  const node = nodes[nodeId]
  if (!node || !containerElement) return false

  const nodeSize = estimateNodeSize(nodes, node)
  const containerRect = containerElement.getBoundingClientRect()
  const topLeft = instance.flowToScreenPosition(node.position)
  const bottomRight = instance.flowToScreenPosition({
    x: node.position.x + nodeSize.width,
    y: node.position.y + nodeSize.height,
  })
  const padding = KEYBOARD_NAVIGATION_VISIBILITY_PADDING

  return (
    topLeft.x < containerRect.left + padding ||
    topLeft.y < containerRect.top + padding ||
    bottomRight.x > containerRect.right - padding ||
    bottomRight.y > containerRect.bottom - padding
  )
}

interface CanvasWorkspaceProps {
  onNodeSelect?: (nodeId: string | null) => void
  focusNodeRequest?: {
    nodeId: string
    requestId: number
  } | null
  title?: string
  subtitle?: string
  nodes?: any[]
  onFlowReady?: (helpers: {
    screenToFlowPosition: ReactFlowInstance['screenToFlowPosition']
    fitView: ReactFlowInstance['fitView']
  }) => void
  onNodeInfoOpen?: (nodeId: string) => void
  onCommand?: (command: {
    commandName:
      | 'create_node'
      | 'create_sibling_node'
      | 'rename_node'
      | 'delete_node'
      | 'move_node_as_child'
      | 'move_node_as_sibling'
      | 'toggle_node_collapsed'
      | 'update_node_meta'
    targetId?: string | null
    targetType?: 'book_tree' | 'book_node' | 'quote_card'
    payload?: Record<string, unknown>
  }) => void
  getExtraContextMenuItems?: (context: {
    nodeId: string
    node: BaseNode
  }) => CanvasContextMenuItem[]
}

export function CanvasWorkspace({ onNodeSelect, focusNodeRequest, onFlowReady, onNodeInfoOpen, onCommand, getExtraContextMenuItems }: CanvasWorkspaceProps) {
  const {
    nodes: documentNodes,
    updateNodePosition,
    updateNodePositions,
    updateNodePositionWithChildren,
    updateNodeLabel,
    createNode,
    createSiblingNode,
    duplicateSubtree,
    deleteNode,
    moveNodeAsChild,
    moveNodeAsSibling,
    toggleNodeCollapsed,
    expandAllNodes,
    updateNodeMeta,
    updateSubtreeEdgeColor,
    collapseNodesDeeperThan,
    relayoutTree,
    rootNodeIds,
    treeId,
  } = useDocumentStore()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [paneContextMenu, setPaneContextMenu] = useState<PaneContextMenuState | null>(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuState | null>(null)
  const [recentEdgeColors, setRecentEdgeColors] = useState<string[]>([])
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(
    () => canvasNodeClipboard?.rootNodeId ?? null
  )
  const [focusedRootNodeId, setFocusedRootNodeId] = useState<string | null>(null)
  const [flowReadyVersion, setFlowReadyVersion] = useState(0)
  const dragStartDescendantPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const dragStartNodePositionRef = useRef<{ x: number; y: number } | null>(null)
  const canvasRootRef = useRef<HTMLDivElement | null>(null)
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const imageFileInputRef = useRef<HTMLInputElement | null>(null)
  const lastHandledFocusRequestRef = useRef<number | null>(null)
  const focusCenterTimeoutRef = useRef<number | null>(null)
  const protectedLargeTreeIdRef = useRef<string | null>(null)
  const manuallyExpandedLargeTreeIdRef = useRef<string | null>(null)
  const relayoutedCollapsedTreeIdRef = useRef<string | null>(null)
  const pendingNewNodeSelectionRef = useRef<string | null>(null)
  const lastKnowledgeToggleRef = useRef<{ nodeId: string | null; timestamp: number }>({
    nodeId: null,
    timestamp: 0,
  })

  const selectNode = useCallback(
    (nodeId: string | null) => {
      setSelectedNodeId(nodeId)
      onNodeSelect?.(nodeId)
    },
    [onNodeSelect]
  )

  const startEditing = useCallback(
    (nodeId: string) => {
      const node = documentNodes[nodeId]
      if (!node) return
      setEditingNodeId(nodeId)
      setEditingDraft(node.label)
      selectNode(nodeId)
    },
    [documentNodes, selectNode]
  )

  const cancelEditing = useCallback(() => {
    setEditingNodeId(null)
    setEditingDraft('')
  }, [])

  const saveEditing = useCallback((draftOverride?: string) => {
    if (!editingNodeId) return
    const nextLabel = (draftOverride ?? editingDraft).trim() || '\u65b0\u8282\u70b9'
    updateNodeLabel(editingNodeId, nextLabel)
    onCommand?.({
      commandName: 'rename_node',
      targetId: editingNodeId,
      targetType: 'book_node',
      payload: { label: nextLabel }
    })
    setEditingNodeId(null)
    setEditingDraft('')
  }, [editingDraft, editingNodeId, onCommand, updateNodeLabel])

  const centerNodeInViewport = useCallback((nodeId: string, options?: { duration?: number; zoom?: number }) => {
    const node = documentNodes[nodeId]
    const instance = reactFlowInstanceRef.current
    if (!node || !instance) return false

    const nodeSize = estimateNodeSize(documentNodes, node)
    void instance.setCenter(
      node.position.x + nodeSize.width / 2,
      node.position.y + nodeSize.height / 2,
      {
        duration: options?.duration ?? 560,
        zoom: options?.zoom ?? 1.28,
      }
    )
    return true
  }, [documentNodes])

  useEffect(() => {
    if (!focusNodeRequest) return
    if (lastHandledFocusRequestRef.current === focusNodeRequest.requestId) return
    if (!documentNodes[focusNodeRequest.nodeId]) return
    if (!reactFlowInstanceRef.current) return

    lastHandledFocusRequestRef.current = focusNodeRequest.requestId
    setFocusedRootNodeId(null)
    selectNode(focusNodeRequest.nodeId)

    if (focusCenterTimeoutRef.current !== null) {
      window.clearTimeout(focusCenterTimeoutRef.current)
    }

    const runCenter = () => {
      focusCenterTimeoutRef.current = null
      centerNodeInViewport(focusNodeRequest.nodeId, { duration: 560, zoom: 1.28 })
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        focusCenterTimeoutRef.current = window.setTimeout(runCenter, 40)
      })
    })
  }, [centerNodeInViewport, documentNodes, flowReadyVersion, focusNodeRequest, selectNode])

  useEffect(() => {
    return () => {
      if (focusCenterTimeoutRef.current !== null) {
        window.clearTimeout(focusCenterTimeoutRef.current)
      }
    }
  }, [])

  const handleAddChild = useCallback(
    (nodeId: string) => {
      const node = documentNodes[nodeId]
      if (!node) return
      const newNodeId = createNode(nodeId, '\u65b0\u8282\u70b9', node.position, 'concept')
      if (!newNodeId) return
      onCommand?.({
        commandName: 'create_node',
        targetId: newNodeId,
        targetType: 'book_node',
        payload: { parentId: nodeId, label: '\u65b0\u8282\u70b9', nodeType: 'concept' }
      })
      pendingNewNodeSelectionRef.current = newNodeId
      setEditingNodeId(newNodeId)
      setEditingDraft('\u65b0\u8282\u70b9')
      selectNode(newNodeId)
    },
    [createNode, documentNodes, onCommand, selectNode]
  )

  const handleAddPresetChild = useCallback(
    (nodeId: string, label: string) => {
      const node = documentNodes[nodeId]
      if (!node) return
      const newNodeId = createNode(nodeId, label, node.position, 'concept')
      if (!newNodeId) return
      onCommand?.({
        commandName: 'create_node',
        targetId: newNodeId,
        targetType: 'book_node',
        payload: { parentId: nodeId, label, nodeType: 'concept' }
      })
      setEditingNodeId(null)
      setEditingDraft('')
      selectNode(newNodeId)
    },
    [createNode, documentNodes, onCommand, selectNode]
  )

  const handleAddOptionChildren = useCallback(
    (nodeId: string) => {
      const node = documentNodes[nodeId]
      if (!node) return

      const labels = ['\u63d0\u70bc\u56e0\u679c', '\u8f6c\u6362\u56e0\u679c', '\u601d\u8003\u76ee\u6807', '\u641c\u96c6\u62fc\u56fe']
      const newNodeIds = labels
        .map((label) => createNode(nodeId, label, node.position, 'concept'))
        .filter((newNodeId): newNodeId is string => Boolean(newNodeId))

      if (newNodeIds.length === 0) return

      onCommand?.({
        commandName: 'create_node',
        targetId: nodeId,
        targetType: 'book_node',
        payload: { parentId: nodeId, labels, nodeIds: newNodeIds, preset: 'framework' }
      })
      setEditingNodeId(null)
      setEditingDraft('')
      selectNode(newNodeIds[0])
    },
    [createNode, documentNodes, onCommand, selectNode]
  )

  const handleAddSibling = useCallback(
    (nodeId: string) => {
      const newNodeId = createSiblingNode(nodeId, '\u65b0\u8282\u70b9', 'concept')
      if (!newNodeId) return
      onCommand?.({
        commandName: 'create_sibling_node',
        targetId: newNodeId,
        targetType: 'book_node',
        payload: { siblingOfNodeId: nodeId, label: '\u65b0\u8282\u70b9', nodeType: 'concept' }
      })
      pendingNewNodeSelectionRef.current = newNodeId
      setEditingNodeId(newNodeId)
      setEditingDraft('\u65b0\u8282\u70b9')
      selectNode(newNodeId)
    },
    [createSiblingNode, onCommand, selectNode]
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const node = documentNodes[nodeId]
      deleteNode(nodeId)
      onCommand?.({
        commandName: 'delete_node',
        targetId: nodeId,
        targetType: 'book_node',
        payload: { parentId: node?.parentId ?? null }
      })
      if (selectedNodeId === nodeId) {
        selectNode(node?.parentId ?? null)
      }
      if (editingNodeId === nodeId) {
        cancelEditing()
      }
      setContextMenu((current) => (current?.nodeId === nodeId ? null : current))
    },
    [cancelEditing, deleteNode, documentNodes, editingNodeId, onCommand, selectNode, selectedNodeId]
  )

  const handleCopyNode = useCallback(
    (nodeId: string) => {
      if (!documentNodes[nodeId]) return
      const subtreeNodes: Record<string, BaseNode> = {}
      const pendingNodeIds = [nodeId]

      while (pendingNodeIds.length > 0) {
        const currentNodeId = pendingNodeIds.pop()
        if (!currentNodeId || subtreeNodes[currentNodeId]) continue
        const currentNode = documentNodes[currentNodeId]
        if (!currentNode) continue
        subtreeNodes[currentNodeId] = structuredClone(currentNode)
        pendingNodeIds.push(...currentNode.childrenIds)
      }

      canvasNodeClipboard = {
        rootNodeId: nodeId,
        nodes: subtreeNodes,
      }
      setCopiedNodeId(nodeId)
      setContextMenu(null)
    },
    [documentNodes]
  )

  const handlePasteNode = useCallback(
    (targetNodeId: string | null = selectedNodeId) => {
      const clipboard = canvasNodeClipboard
      if (!clipboard || clipboard.rootNodeId !== copiedNodeId) return
      const targetNode = targetNodeId ? documentNodes[targetNodeId] : null
      const sourceNode = clipboard.nodes[clipboard.rootNodeId]
      if (!sourceNode) return
      const newNodeId = duplicateSubtree(clipboard.rootNodeId, targetNode
        ? {
            parentId: targetNode.id,
            sourceNodes: clipboard.nodes,
          }
        : {
            parentId: null,
            position: {
              x: sourceNode.position.x + 48,
              y: sourceNode.position.y + 48,
            },
            sourceNodes: clipboard.nodes,
          })
      if (!newNodeId) return

      onCommand?.({
        commandName: 'create_node',
        targetId: newNodeId,
        targetType: 'book_node',
        payload: {
          parentId: targetNode?.id ?? null,
          copiedFromNodeId: clipboard.rootNodeId,
        }
      })
      selectNode(newNodeId)
      setContextMenu(null)
      setEdgeContextMenu(null)
    },
    [copiedNodeId, documentNodes, duplicateSubtree, onCommand, selectNode, selectedNodeId]
  )

  const handleToggleCollapsed = useCallback(
    (nodeId: string) => {
      toggleNodeCollapsed(nodeId)
      onCommand?.({
        commandName: 'toggle_node_collapsed',
        targetId: nodeId,
        targetType: 'book_node'
      })
      setContextMenu(null)
    },
    [onCommand, toggleNodeCollapsed]
  )

  const handleFocusSubtree = useCallback((nodeId: string) => {
    if (!documentNodes[nodeId]) return
    const subtreeNodeCount = collectVisibleNodeIds(documentNodes, [nodeId]).length
    startTransition(() => {
      setFocusedRootNodeId(nodeId)
    })
    selectNode(nodeId)
    setContextMenu(null)
    setPaneContextMenu(null)
    setEdgeContextMenu(null)
    if (subtreeNodeCount <= AUTO_FIT_VIEW_NODE_LIMIT) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          reactFlowInstanceRef.current?.fitView({ padding: 0.24, duration: 180 })
        })
      })
    }
  }, [documentNodes, selectNode])

  const handleShowAllNodes = useCallback(() => {
    const allNodeCount = collectVisibleNodeIds(documentNodes, rootNodeIds).length
    startTransition(() => {
      setFocusedRootNodeId(null)
    })
    setContextMenu(null)
    setPaneContextMenu(null)
    setEdgeContextMenu(null)
    if (allNodeCount <= AUTO_FIT_VIEW_NODE_LIMIT) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 180 })
        })
      })
    }
  }, [documentNodes, rootNodeIds])

  const handleExpandAllNodes = useCallback(() => {
    const currentTreeKey = treeId ?? `anonymous-${rootNodeIds.join('|')}`
    const totalNodeCount = Object.keys(documentNodes).length
    if (totalNodeCount > LARGE_TREE_VISIBLE_NODE_LIMIT) {
      manuallyExpandedLargeTreeIdRef.current = currentTreeKey
      protectedLargeTreeIdRef.current = currentTreeKey
    }

    startTransition(() => {
      expandAllNodes()
      setFocusedRootNodeId(null)
    })
    setContextMenu(null)
    setPaneContextMenu(null)
    setEdgeContextMenu(null)
    if (totalNodeCount > AUTO_FIT_VIEW_NODE_LIMIT) return

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 180 })
      })
    })
  }, [documentNodes, expandAllNodes, rootNodeIds, treeId])

  useEffect(() => {
    if (!editingNodeId || documentNodes[editingNodeId]) return
    cancelEditing()
  }, [cancelEditing, documentNodes, editingNodeId])

  useEffect(() => {
    if (!editingNodeId || pendingNewNodeSelectionRef.current !== editingNodeId) return

    const selectNewNodeLabel = () => {
      if (pendingNewNodeSelectionRef.current !== editingNodeId) return
      const nodeElement = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node[data-id]'))
        .find((element) => element.dataset.id === editingNodeId)
      const editor = nodeElement?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input.tree-node-edit-input, textarea.tree-node-note-editor'
      )
      if (!editor) return
      if (editor.value !== editingDraft) {
        pendingNewNodeSelectionRef.current = null
        return
      }
      editor.focus({ preventScroll: true })
      editor.select()
    }

    const frameId = window.requestAnimationFrame(selectNewNodeLabel)
    const timers = [60, 160, 280].map((delay) => window.setTimeout(() => {
      selectNewNodeLabel()
      if (delay === 280) pendingNewNodeSelectionRef.current = null
    }, delay))

    return () => {
      window.cancelAnimationFrame(frameId)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [documentNodes, editingDraft, editingNodeId])

  useEffect(() => {
    if (!focusedRootNodeId || documentNodes[focusedRootNodeId]) return
    setFocusedRootNodeId(null)
  }, [documentNodes, focusedRootNodeId])

  useEffect(() => {
    try {
      const savedColors = window.localStorage.getItem('cogtree.recentEdgeColors')
      if (!savedColors) return
      const parsedColors = JSON.parse(savedColors)
      if (!Array.isArray(parsedColors)) return
      setRecentEdgeColors(parsedColors.filter((color): color is string => typeof color === 'string').slice(0, 5))
    } catch {
      setRecentEdgeColors([])
    }
  }, [])

  const visibleNodeIds = useMemo(
    () => collectVisibleNodeIds(documentNodes, focusedRootNodeId ? [focusedRootNodeId] : rootNodeIds),
    [documentNodes, focusedRootNodeId, rootNodeIds]
  )

  const visibleNodeIdSet = useMemo(() => new Set(visibleNodeIds), [visibleNodeIds])

  const selectNodeByKeyboard = useCallback(
    (direction: KeyboardNavigationDirection) => {
      const nextNodeId = findKeyboardNavigationTarget(documentNodes, visibleNodeIds, selectedNodeId, direction)
      if (!nextNodeId) return false

      selectNode(nextNodeId)
      setContextMenu(null)
      setPaneContextMenu(null)
      setEdgeContextMenu(null)

      const instance = reactFlowInstanceRef.current
      const nextNode = documentNodes[nextNodeId]
      if (
        instance &&
        nextNode &&
        shouldCenterNodeForKeyboardNavigation(instance, canvasRootRef.current, documentNodes, nextNodeId)
      ) {
        const nodeSize = estimateNodeSize(documentNodes, nextNode)
        void instance.setCenter(
          nextNode.position.x + nodeSize.width / 2,
          nextNode.position.y + nodeSize.height / 2,
          {
            duration: 140,
            zoom: instance.getZoom(),
          }
        )
      }

      return true
    },
    [documentNodes, selectNode, selectedNodeId, visibleNodeIds]
  )

  const nodePresentationById = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof getNodePresentation>>()

    const resolvePresentation = (nodeId: string): ReturnType<typeof getNodePresentation> => {
      const cached = cache.get(nodeId)
      if (cached) return cached

      const node = documentNodes[nodeId]
      if (!node) {
        return getNodePresentation(documentNodes, nodeId)
      }

      if (!node.parentId || !documentNodes[node.parentId]) {
        const rootPresentation = {
          depth: 0,
          branchIndex: 0,
          branchColor: BRANCH_STYLES[0].color,
          branchIcon: BRANCH_STYLES[0].icon,
          outlineNumber: '',
        }
        cache.set(nodeId, rootPresentation)
        return rootPresentation
      }

      const parentPresentation = resolvePresentation(node.parentId)
      const depth = parentPresentation.depth + 1
      const branchIndex = depth === 1 ? Math.max(0, node.orderIndex) : parentPresentation.branchIndex
      const branchStyle = BRANCH_STYLES[branchIndex % BRANCH_STYLES.length]
      const sequence = Math.max(0, node.orderIndex) + 1
      const outlineNumber = depth === 1
        ? ''
        : parentPresentation.depth === 1
          ? `${parentPresentation.branchIndex + 1}.${sequence}`
          : `${parentPresentation.outlineNumber}.${sequence}`
      const presentation = {
        depth,
        branchIndex,
        branchColor: branchStyle.color,
        branchIcon: branchStyle.icon,
        outlineNumber,
      }
      cache.set(nodeId, presentation)
      return presentation
    }

    visibleNodeIds.forEach(resolvePresentation)
    return cache
  }, [documentNodes, visibleNodeIds])

  useEffect(() => {
    const currentTreeKey = treeId ?? `anonymous-${rootNodeIds.join('|')}`
    if (!currentTreeKey || relayoutedCollapsedTreeIdRef.current === currentTreeKey) return
    const hasCollapsedNodes = Object.values(documentNodes).some((node) => node.status === 'collapsed')
    if (!hasCollapsedNodes) return

    relayoutedCollapsedTreeIdRef.current = currentTreeKey
    relayoutTree()
  }, [documentNodes, relayoutTree, rootNodeIds, treeId])

  useEffect(() => {
    const currentTreeKey = treeId ?? `anonymous-${rootNodeIds.join('|')}`
    if (!currentTreeKey || protectedLargeTreeIdRef.current === currentTreeKey) return
    if (manuallyExpandedLargeTreeIdRef.current === currentTreeKey) return
    if (visibleNodeIds.length <= LARGE_TREE_VISIBLE_NODE_LIMIT) return

    protectedLargeTreeIdRef.current = currentTreeKey
    collapseNodesDeeperThan(LARGE_TREE_COLLAPSE_DEPTH, LARGE_TREE_FANOUT_COLLAPSE_LIMIT)
  }, [collapseNodesDeeperThan, rootNodeIds, treeId, visibleNodeIds.length])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.key === 'Process') return
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      const isTypingElement = tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable
      if (isTypingElement) return

      if (event.key === 'Escape' && editingNodeId) {
        event.preventDefault()
        cancelEditing()
        return
      }

      const isModifierPressed = event.ctrlKey || event.metaKey
      if (isModifierPressed && event.key.toLowerCase() === 'c' && selectedNodeId && !editingNodeId) {
        event.preventDefault()
        handleCopyNode(selectedNodeId)
        return
      }

      const arrowDirectionByKey: Partial<Record<string, KeyboardNavigationDirection>> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      }
      const arrowDirection = arrowDirectionByKey[event.key]
      if (arrowDirection && !editingNodeId) {
        const didSelectNode = selectNodeByKeyboard(arrowDirection)
        if (didSelectNode) {
          event.preventDefault()
          event.stopPropagation()
        }
        return
      }

      if (!selectedNodeId || editingNodeId) return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        handleDeleteNode(selectedNodeId)
        return
      }

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault()
        handleToggleCollapsed(selectedNodeId)
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        handleAddChild(selectedNodeId)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        handleAddSibling(selectedNodeId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelEditing, editingNodeId, handleAddChild, handleAddSibling, handleCopyNode, handleDeleteNode, selectNodeByKeyboard, selectedNodeId])

  const handleResizeNote = useCallback((nodeId: string, size: { width: number; height: number }, commit = false) => {
    const node = documentNodes[nodeId]
    if (!node) return
    const width = Math.max(260, Math.min(640, Math.round(size.width)))
    const height = Math.max(170, Math.min(460, Math.round(size.height)))

    updateNodeMeta(nodeId, {
      ...(node.meta ?? {}),
      noteSize: { width, height },
    })
    if (!commit) return

    onCommand?.({
      commandName: 'update_node_meta',
      targetId: nodeId,
      targetType: 'book_node',
      payload: { noteSize: { width, height } }
    })
  }, [documentNodes, onCommand, updateNodeMeta])

  const handleResizeImage = useCallback((nodeId: string, size: { width: number; height: number }, commit = false) => {
    const node = documentNodes[nodeId]
    if (!node) return
    const width = Math.max(96, Math.min(900, Math.round(size.width)))
    const height = Math.max(72, Math.min(640, Math.round(size.height)))

    updateNodeMeta(nodeId, {
      ...(node.meta ?? {}),
      imageSize: { width, height },
    })
    if (!commit) return

    onCommand?.({
      commandName: 'update_node_meta',
      targetId: nodeId,
      targetType: 'book_node',
      payload: { imageSize: { width, height } }
    })
  }, [documentNodes, onCommand, updateNodeMeta])

  const handleUpdateNoteMeta = useCallback((nodeId: string, meta: { noteBadge?: string; noteBody?: string }, commit = false) => {
    const node = documentNodes[nodeId]
    if (!node) return

    updateNodeMeta(nodeId, {
      ...(node.meta ?? {}),
      ...meta,
    })
    if (!commit) return

    onCommand?.({
      commandName: 'update_node_meta',
      targetId: nodeId,
      targetType: 'book_node',
      payload: meta
    })
  }, [documentNodes, onCommand, updateNodeMeta])

  // Derive React Flow nodes from Document Store (Tree First approach)
  const flowNodes: Node[] = useMemo(() => {
    return visibleNodeIds.map((nodeId) => {
      const node = documentNodes[nodeId]
      const presentation = nodePresentationById.get(node.id) ?? getNodePresentation(documentNodes, node.id)
      return ({
      id: node.id,
      type: 'themeNode',
      position: node.position,
      data: {
        ...node,
        ...presentation,
        isEditing: editingNodeId === node.id,
        editDraft: editingNodeId === node.id ? editingDraft : node.label,
        isDropTarget: dragPreview?.targetNodeId === node.id,
        dropPreviewMode: dragPreview?.targetNodeId === node.id ? dragPreview.mode : null,
        isCollapsed: node.status === 'collapsed',
        onStartEdit: () => startEditing(node.id),
        onEditDraftChange: setEditingDraft,
        onSaveEdit: saveEditing,
        onCancelEdit: cancelEditing,
        onAddChild: () => handleAddChild(node.id),
        onAddSibling: () => handleAddSibling(node.id),
        onDelete: () => handleDeleteNode(node.id),
        onToggleCollapsed: () => handleToggleCollapsed(node.id),
        onOpenKnowledge: () => {
          const now = performance.now()
          const lastToggle = lastKnowledgeToggleRef.current
          if (lastToggle.nodeId === node.id && now - lastToggle.timestamp < 220) {
            return
          }
          lastKnowledgeToggleRef.current = { nodeId: node.id, timestamp: now }
          selectNode(node.id)
          onNodeInfoOpen?.(node.id)
        },
        onResizeImage: (size, commit) => handleResizeImage(node.id, size, commit),
        onResizeNote: (size, commit) => handleResizeNote(node.id, size, commit),
        onUpdateNoteMeta: (meta, commit) => handleUpdateNoteMeta(node.id, meta, commit),
      } satisfies CanvasNodeData,
      draggable: editingNodeId !== node.id,
      selectable: true,
      selected: selectedNodeId === node.id,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      })
    })
  }, [
    cancelEditing,
    documentNodes,
    dragPreview,
    editingDraft,
    editingNodeId,
    selectedNodeId,
    handleAddChild,
    handleAddPresetChild,
    handleAddSibling,
    handleDeleteNode,
    handleResizeImage,
    handleResizeNote,
    handleUpdateNoteMeta,
    handleToggleCollapsed,
    onNodeInfoOpen,
    nodePresentationById,
    selectNode,
    visibleNodeIds,
    saveEditing,
    startEditing,
  ])

  // Derive React Flow edges from parentId (Tree First approach)
  const flowEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = []
    const visibleChildCountByParent = new Map<string, number>()
    visibleNodeIds.forEach((nodeId) => {
      const parentId = documentNodes[nodeId]?.parentId
      if (!parentId || !visibleNodeIdSet.has(parentId)) return
      visibleChildCountByParent.set(parentId, (visibleChildCountByParent.get(parentId) ?? 0) + 1)
    })

    visibleNodeIds.forEach((nodeId) => {
      const node = documentNodes[nodeId]
      if (!node) return
      if (node.parentId && visibleNodeIdSet.has(node.id) && visibleNodeIdSet.has(node.parentId)) {
        edges.push({
          id: `e-${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          type: 'mindMap',
          animated: false,
          data: {
            color: typeof node.meta?.edgeColor === 'string'
              ? node.meta.edgeColor
              : nodePresentationById.get(node.id)?.branchColor ?? getNodePresentation(documentNodes, node.id).branchColor,
            siblingCount: visibleChildCountByParent.get(node.parentId) ?? 1,
          },
        })
      }
    })
    if (
      draggingNodeId &&
      dragPreview?.mode === 'child' &&
      dragPreview.targetNodeId &&
      visibleNodeIdSet.has(draggingNodeId) &&
      visibleNodeIdSet.has(dragPreview.targetNodeId)
    ) {
      edges.push({
        id: `drag-preview-${dragPreview.targetNodeId}-${draggingNodeId}`,
        source: dragPreview.targetNodeId,
        target: draggingNodeId,
        type: 'mindMap',
        animated: true,
        data: {
          color: '#94a3b8',
          isPreview: true,
          siblingCount: 1,
        },
      })
    }
    return edges
  }, [documentNodes, dragPreview, draggingNodeId, nodePresentationById, visibleNodeIds, visibleNodeIdSet])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Handle position changes to update our store (Tree First)
      // When dragging (dragging=true), move all descendants with the node
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const positionChange = change as NodePositionChange
          if (positionChange.dragging) {
            updateNodePositionWithChildren(change.id, change.position)
          } else {
            updateNodePosition(change.id, change.position)
          }
        }
      })
    },
    [updateNodePosition, updateNodePositionWithChildren]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (editingNodeId && editingNodeId !== node.id) {
        saveEditing()
      }
      selectNode(node.id)
    },
    [editingNodeId, saveEditing, selectNode]
  )

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      startEditing(node.id)
    },
    [startEditing]
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      selectNode(node.id)
      setPaneContextMenu(null)
      setEdgeContextMenu(null)
      setContextMenu({
        nodeId: node.id,
        x: event.clientX,
        y: event.clientY
      })
    },
    [selectNode]
  )

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      event.stopPropagation()
      const targetNode = documentNodes[edge.target]
      if (!targetNode) return
      const fallbackColor = getNodePresentation(documentNodes, targetNode.id).branchColor

      setContextMenu(null)
      setPaneContextMenu(null)
      setEdgeContextMenu({
        edgeId: edge.id,
        targetNodeId: targetNode.id,
        x: event.clientX,
        y: event.clientY,
        color: typeof targetNode.meta?.edgeColor === 'string' ? targetNode.meta.edgeColor : fallbackColor,
        applyToDescendants: false,
      })
    },
    [documentNodes]
  )

  const handleApplyEdgeColor = useCallback(() => {
    if (!edgeContextMenu) return
    const node = documentNodes[edgeContextMenu.targetNodeId]
    if (!node) return
    const nextColor = edgeContextMenu.color
    const subtreeIds = collectDescendantIds(documentNodes, edgeContextMenu.targetNodeId)
    const affectedNodeIds = edgeContextMenu.applyToDescendants
      ? [edgeContextMenu.targetNodeId, ...subtreeIds]
      : [edgeContextMenu.targetNodeId]

    if (edgeContextMenu.applyToDescendants) {
      updateSubtreeEdgeColor(edgeContextMenu.targetNodeId, nextColor)
    } else {
      updateNodeMeta(edgeContextMenu.targetNodeId, {
        ...(node.meta ?? {}),
        edgeColor: nextColor,
      })
    }
    onCommand?.({
      commandName: 'update_node_meta',
      targetId: edgeContextMenu.targetNodeId,
      targetType: 'book_node',
      payload: {
        edgeColor: nextColor,
        edgeColorScope: edgeContextMenu.applyToDescendants ? 'subtree' : 'edge',
        affectedNodeIds,
      }
    })
    setRecentEdgeColors((currentColors) => {
      const nextColors = [nextColor, ...currentColors.filter((color) => color !== nextColor)].slice(0, 5)
      window.localStorage.setItem('cogtree.recentEdgeColors', JSON.stringify(nextColors))
      return nextColors
    })
    setEdgeContextMenu(null)
  }, [documentNodes, edgeContextMenu, onCommand, updateNodeMeta, updateSubtreeEdgeColor])

  const handleToggleImportant = useCallback((nodeId: string) => {
    const node = documentNodes[nodeId]
    if (!node) return

    updateNodeMeta(nodeId, {
      ...(node.meta ?? {}),
      isImportant: node.meta?.isImportant !== true,
    })
  }, [documentNodes, updateNodeMeta])

  const createCanvasImageNode = useCallback((
    images: NodeImageAttachment[],
    options: { position?: { x: number; y: number }; parentId?: string | null } = {}
  ) => {
    if (images.length === 0) return

    const instance = reactFlowInstanceRef.current
    const parentNode = options.parentId ? documentNodes[options.parentId] : null
    const canvasPosition = options.position ?? instance?.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }) ?? { x: 120, y: 120 }
    const newNodeId = createNode(parentNode?.id ?? null, images[0]?.name || '\u56fe\u7247', parentNode?.position ?? canvasPosition, 'concept')
    if (!newNodeId) return

    if (!parentNode) {
      updateNodePosition(newNodeId, canvasPosition)
    }
    updateNodeMeta(newNodeId, {
      canvasImage: true,
      nodeImages: images,
      imageSize: { width: 260, height: 180 },
    })
    onCommand?.({
      commandName: 'create_node',
      targetId: newNodeId,
      targetType: 'book_node',
      payload: { parentId: parentNode?.id ?? null, label: images[0]?.name || '\u56fe\u7247', nodeType: 'concept', canvasImage: true }
    })
    onCommand?.({
      commandName: 'update_node_meta',
      targetId: newNodeId,
      targetType: 'book_node',
      payload: { canvasImage: true, nodeImageCount: images.length, imageSize: { width: 260, height: 180 } }
    })
    selectNode(newNodeId)
  }, [createNode, documentNodes, onCommand, selectNode, updateNodeMeta, updateNodePosition])

  const createCanvasNoteNode = useCallback((position?: { x: number; y: number }) => {
    const instance = reactFlowInstanceRef.current
    const canvasPosition = position ?? instance?.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }) ?? { x: 160, y: 160 }
    const newNodeId = createNode(null, '\u65b0\u4fbf\u7b7e', canvasPosition, 'concept')
    if (!newNodeId) return

    updateNodePosition(newNodeId, canvasPosition)
    updateNodeMeta(newNodeId, {
      canvasNote: true,
      noteBadge: '\u5fc3\u7406\u6210\u957f\u6d1e\u89c1',
      noteBody: '\u5728\u8fd9\u91cc\u8bb0\u5f55\u8fd9\u4e2a\u6d1e\u89c1\u7684\u80cc\u666f\u3001\u5224\u65ad\u548c\u4e0b\u4e00\u6b65\u884c\u52a8\u3002',
      noteSize: { width: 330, height: 220 },
    })
    onCommand?.({
      commandName: 'create_node',
      targetId: newNodeId,
      targetType: 'book_node',
      payload: { parentId: null, label: '\u65b0\u4fbf\u7b7e', nodeType: 'concept', canvasNote: true }
    })
    onCommand?.({
      commandName: 'update_node_meta',
      targetId: newNodeId,
      targetType: 'book_node',
      payload: {
        canvasNote: true,
        noteBadge: '\u5fc3\u7406\u6210\u957f\u6d1e\u89c1',
        noteBody: '\u5728\u8fd9\u91cc\u8bb0\u5f55\u8fd9\u4e2a\u6d1e\u89c1\u7684\u80cc\u666f\u3001\u5224\u65ad\u548c\u4e0b\u4e00\u6b65\u884c\u52a8\u3002',
        noteSize: { width: 330, height: 220 }
      }
    })
    setEditingNodeId(newNodeId)
    setEditingDraft('\u65b0\u4fbf\u7b7e')
    selectNode(newNodeId)
  }, [createNode, onCommand, selectNode, updateNodeMeta, updateNodePosition])

  const addImagesFromFiles = useCallback(async (files: File[], targetNodeId: string | null) => {
    if (files.length === 0) return
    const images = await Promise.all(files.map(readImageFile))

    createCanvasImageNode(images, {
      parentId: targetNodeId && documentNodes[targetNodeId] ? targetNodeId : null,
    })
  }, [createCanvasImageNode, documentNodes])

  const handleAddImageToNode = useCallback((nodeId: string) => {
    selectNode(nodeId)
    imageFileInputRef.current?.click()
  }, [selectNode])

  useEffect(() => {
    const handlePasteImage = (event: ClipboardEvent) => {
      if (editingNodeId) return
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) return
      if (target?.closest('.node-knowledge-panel')) return

      const files = getImageFilesFromClipboard(event.clipboardData)
      if (files.length > 0) {
        event.preventDefault()
        void addImagesFromFiles(files, selectedNodeId)
        return
      }

      if (copiedNodeId && canvasNodeClipboard?.rootNodeId === copiedNodeId) {
        event.preventDefault()
        handlePasteNode(selectedNodeId)
      }
    }

    window.addEventListener('paste', handlePasteImage)
    return () => window.removeEventListener('paste', handlePasteImage)
  }, [addImagesFromFiles, copiedNodeId, editingNodeId, handlePasteNode, selectedNodeId])

  const resolveDragPreview = useCallback(
    (draggedNodeId: string, nodePosition: { x: number; y: number }, pointerPosition?: { x: number; y: number }) => {
      const draggedNode = documentNodes[draggedNodeId]
      if (!draggedNode) return null

      const candidates = Object.values(documentNodes).filter((candidate) => {
        if (candidate.id === draggedNodeId) return false
        if (!visibleNodeIdSet.has(candidate.id)) return false
        if (isDescendant(documentNodes, draggedNodeId, candidate.id)) return false
        return true
      })

      const draggedSize = estimateNodeSize(documentNodes, draggedNode)
      const intentX = pointerPosition?.x ?? nodePosition.x + draggedSize.width / 2
      const intentY = pointerPosition?.y ?? nodePosition.y + draggedSize.height / 2

      type DragAnchor = {
        node: BaseNode
        mode: 'child' | 'sibling'
        score: number
      }

      const anchorCandidate = candidates
        .flatMap<DragAnchor>((candidate) => {
          const candidateSize = estimateNodeSize(documentNodes, candidate)
          const candidateDepth = getNodeDepth(documentNodes, candidate)
          const isTextNode = candidateDepth >= 2
          const candidateCenterX = candidate.position.x + candidateSize.width / 2
          const candidateCenterY = candidate.position.y + candidateSize.height / 2
          const candidateRight = candidate.position.x + candidateSize.width
          const candidateBottom = candidate.position.y + candidateSize.height
          const childAnchorX = candidateRight + (isTextNode ? 44 : 38)
          const childAnchorY = candidateCenterY
          const siblingAnchorX = candidateCenterX
          const siblingAnchorY = candidateBottom + (isTextNode ? 22 : 30)
          const childDx = Math.abs(intentX - childAnchorX)
          const childDy = Math.abs(intentY - childAnchorY)
          const siblingDx = Math.abs(intentX - siblingAnchorX)
          const siblingDy = Math.abs(intentY - siblingAnchorY)
          const childInRange =
            intentX > candidate.position.x + candidateSize.width * 0.35 &&
            childDx < (isTextNode ? 190 : 150) &&
            childDy < (isTextNode ? 54 : 66)
          const siblingInRange =
            intentY > candidateCenterY &&
            siblingDx < Math.max(isTextNode ? 150 : 170, candidateSize.width * 0.8) &&
            siblingDy < (isTextNode ? 58 : 72)
          const anchors: DragAnchor[] = []

          if (childInRange) {
            anchors.push({
              node: candidate,
              mode: 'child',
              score: childDx * 0.85 + childDy * 2.35,
            })
          }

          if (siblingInRange) {
            anchors.push({
              node: candidate,
              mode: 'sibling',
              score: siblingDx * 0.62 + siblingDy * 2.15 + (candidate.parentId === draggedNode.parentId ? -18 : 0),
            })
          }

          return anchors
        })
        .sort((left, right) => left.score - right.score)[0]

      if (!anchorCandidate) return null

      return {
        targetNodeId: anchorCandidate.node.id,
        mode: anchorCandidate.mode,
        message: anchorCandidate.mode === 'child'
          ? `\u5c06\u6210\u4e3a\u201c${anchorCandidate.node.label}\u201d\u7684\u5b50\u8282\u70b9`
          : `\u5c06\u63d2\u5165\u4e3a\u201c${anchorCandidate.node.label}\u201d\u7684\u540c\u7ea7\u8282\u70b9`
      }
    },
    [documentNodes, visibleNodeIdSet]
  )
  const onNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    setDraggingNodeId(node.id)
    setDragPreview(null)
    dragStartNodePositionRef.current = documentNodes[node.id]
      ? { ...documentNodes[node.id].position }
      : { ...node.position }
    const descendantIds = collectDescendantIds(documentNodes, node.id)
    dragStartDescendantPositionsRef.current = Object.fromEntries(
      descendantIds
        .map((descendantId) => {
          const descendantNode = documentNodes[descendantId]
          return descendantNode
            ? [descendantId, { ...descendantNode.position }]
            : null
        })
        .filter((entry): entry is [string, { x: number; y: number }] => entry !== null)
    )
  }, [documentNodes])

  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (editingNodeId) return
      const pointerPosition = reactFlowInstanceRef.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      setDragPreview(resolveDragPreview(node.id, node.position, pointerPosition))
    },
    [editingNodeId, resolveDragPreview]
  )

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setDraggingNodeId(null)
      if (editingNodeId) return

      const draggedNode = documentNodes[node.id]
      if (!draggedNode) return

      const pointerPosition = reactFlowInstanceRef.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const preview = resolveDragPreview(draggedNode.id, node.position, pointerPosition) ?? dragPreview
      const startPosition = dragStartNodePositionRef.current
      const descendantStartPositions = dragStartDescendantPositionsRef.current
      dragStartDescendantPositionsRef.current = {}
      dragStartNodePositionRef.current = null
      setDragPreview(null)
      if (!preview || !preview.targetNodeId) {
        if (startPosition) {
          const deltaX = node.position.x - startPosition.x
          const deltaY = node.position.y - startPosition.y
          updateNodePositions(Object.fromEntries(
            Object.entries(descendantStartPositions).map(([id, position]) => [
              id,
              { x: position.x + deltaX, y: position.y + deltaY }
            ])
          ))
        }
        return
      }
      if (preview.mode === 'invalid') return

      if (preview.mode === 'child') {
        const moved = moveNodeAsChild(draggedNode.id, preview.targetNodeId)
        if (!moved) return
        onCommand?.({
          commandName: 'move_node_as_child',
          targetId: draggedNode.id,
          targetType: 'book_node',
          payload: { parentId: preview.targetNodeId }
        })
        selectNode(draggedNode.id)
        return
      }

      if (preview.mode === 'sibling') {
        const moved = moveNodeAsSibling(draggedNode.id, preview.targetNodeId)
        if (!moved) return
        onCommand?.({
          commandName: 'move_node_as_sibling',
          targetId: draggedNode.id,
          targetType: 'book_node',
          payload: { siblingOfNodeId: preview.targetNodeId }
        })
        selectNode(draggedNode.id)
      }
    },
    [documentNodes, dragPreview, editingNodeId, moveNodeAsChild, moveNodeAsSibling, onCommand, resolveDragPreview, selectNode, updateNodePositions]
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
    setContextMenu(null)
    setPaneContextMenu(null)
    setEdgeContextMenu(null)
    if (editingNodeId) {
      saveEditing()
    }
  }, [editingNodeId, saveEditing, selectNode])

  const openKnowledgeFromInfoButton = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const button = target?.closest<HTMLButtonElement>('.tree-node-info-button[data-node-id]')
    const nodeId = button?.dataset.nodeId
    if (!nodeId) return

    event.preventDefault()
    event.stopPropagation()

    const now = performance.now()
    const lastToggle = lastKnowledgeToggleRef.current
    if (lastToggle.nodeId === nodeId && now - lastToggle.timestamp < 220) {
      return
    }

    lastKnowledgeToggleRef.current = { nodeId, timestamp: now }
    selectNode(nodeId)
    onNodeInfoOpen?.(nodeId)
  }, [onNodeInfoOpen, selectNode])

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
    const instance = reactFlowInstanceRef.current
    if (!instance) return
    const target = event.target as HTMLElement | null
    if (
      target?.closest('.react-flow__node') ||
      target?.closest('.react-flow__edge') ||
      target?.closest('.canvas-context-menu')
    ) {
      return
    }

    event.preventDefault()
    selectNode(null)
    setContextMenu(null)
    setEdgeContextMenu(null)
    setPaneContextMenu({
      x: event.clientX,
      y: event.clientY,
      position: instance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
    })
  }, [])

  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const instance = reactFlowInstanceRef.current
      if (!instance || editingNodeId) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest('.react-flow__node') ||
        target?.closest('.react-flow__edge') ||
        target?.closest('.canvas-context-menu')
      ) {
        return
      }

      event.preventDefault()
      setContextMenu(null)
      setPaneContextMenu(null)
      setEdgeContextMenu(null)

      const position = instance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const newNodeId = createNode(null, '\u65b0\u8282\u70b9', position, 'concept')
      if (!newNodeId) return

      onCommand?.({
        commandName: 'create_node',
        targetId: newNodeId,
        targetType: 'book_node',
        payload: { parentId: null, label: '\u65b0\u8282\u70b9', nodeType: 'concept' }
      })
      pendingNewNodeSelectionRef.current = newNodeId
      setEditingNodeId(newNodeId)
      setEditingDraft('\u65b0\u8282\u70b9')
      selectNode(newNodeId)
    },
    [createNode, editingNodeId, onCommand, selectNode]
  )

  const contextMenuItems = contextMenu && documentNodes[contextMenu.nodeId]
    ? [
        { key: 'rename', label: '\u91cd\u547d\u540d', icon: Edit3, action: () => startEditing(contextMenu.nodeId), group: 'edit' },
        { key: 'copy', label: '\u590d\u5236\u8282\u70b9', icon: Copy, action: () => handleCopyNode(contextMenu.nodeId), group: 'edit' },
        { key: 'paste', label: '\u7c98\u8d34\u8282\u70b9', icon: ClipboardPaste, action: () => handlePasteNode(contextMenu.nodeId), disabled: !copiedNodeId, group: 'edit' },
        { key: 'child', label: '\u65b0\u589e\u5b50\u8282\u70b9', icon: GitBranchPlus, action: () => handleAddChild(contextMenu.nodeId), group: 'create' },
        { key: 'sibling', label: '\u65b0\u589e\u540c\u7ea7', icon: ListPlus, action: () => handleAddSibling(contextMenu.nodeId), group: 'create' },
        { key: 'cause', label: '\u65b0\u5efa\u56e0', icon: CircleDot, action: () => handleAddPresetChild(contextMenu.nodeId, '\u56e0'), group: 'create' },
        { key: 'effect', label: '\u65b0\u5efa\u679c', icon: CircleCheck, action: () => handleAddPresetChild(contextMenu.nodeId, '\u679c'), group: 'create' },
        { key: 'question', label: '\u65b0\u5efa\uff1f', icon: CircleHelp, action: () => handleAddPresetChild(contextMenu.nodeId, '\uff1f'), group: 'create' },
        { key: 'options', label: '\u65b0\u5efa\u6846\u67b6', icon: ListPlus, action: () => handleAddOptionChildren(contextMenu.nodeId), group: 'create' },
        { key: 'image', label: '\u65b0\u5efa\u56fe\u8282\u70b9', icon: ImagePlus, action: () => handleAddImageToNode(contextMenu.nodeId), group: 'create', wide: true },
        {
          key: 'important',
          label: documentNodes[contextMenu.nodeId].meta?.isImportant === true ? '\u53d6\u6d88\u91cd\u8981' : '\u975e\u5e38\u91cd\u8981',
          icon: Star,
          action: () => handleToggleImportant(contextMenu.nodeId),
          group: 'state'
        },
        {
          key: 'focus-subtree',
          label: focusedRootNodeId === contextMenu.nodeId ? '\u663e\u793a\u5168\u90e8' : '\u4ec5\u663e\u793a\u6b64\u5206\u652f',
          icon: Eye,
          action: () => {
            if (focusedRootNodeId === contextMenu.nodeId) {
              handleShowAllNodes()
              return
            }
            handleFocusSubtree(contextMenu.nodeId)
          },
          group: 'state',
        },
        {
          key: 'show-all-expanded',
          label: '\u663e\u793a\u5168\u90e8',
          icon: PanelTopOpen,
          action: handleExpandAllNodes,
          group: 'state'
        },
        ...(getExtraContextMenuItems?.({
          nodeId: contextMenu.nodeId,
          node: documentNodes[contextMenu.nodeId],
        }) ?? []).map((item) => ({ ...item, group: item.group ?? 'state' as CanvasContextMenuGroup })),
        {
          key: 'collapse',
          label: documentNodes[contextMenu.nodeId].status === 'collapsed' ? '\u5c55\u5f00\u5b50\u6811 Space' : '\u6298\u53e0\u5b50\u6811 Space',
          icon: documentNodes[contextMenu.nodeId].status === 'collapsed' ? PanelTopOpen : PanelTopClose,
          action: () => handleToggleCollapsed(contextMenu.nodeId),
          group: 'state'
        },
        { key: 'delete', label: '\u5220\u9664\u8282\u70b9', icon: Trash2, action: () => handleDeleteNode(contextMenu.nodeId), danger: true, group: 'edit' }
      ]
    : []

  const contextMenuSections = [
    { key: 'edit', label: '\u7f16\u8f91', className: 'node-context-menu-section node-context-menu-edit-grid', items: contextMenuItems.filter((item) => item.group === 'edit') },
    { key: 'create', label: '\u65b0\u5efa', className: 'node-context-menu-section node-context-menu-grid', items: contextMenuItems.filter((item) => item.group === 'create') },
    { key: 'state', label: '\u72b6\u6001', className: 'node-context-menu-section node-context-menu-state-grid', items: contextMenuItems.filter((item) => item.group === 'state') },
    { key: 'danger', label: '', className: 'node-context-menu-section node-context-menu-danger', items: contextMenuItems.filter((item) => item.group === 'danger') },
  ].filter((section) => section.items.length > 0)

  return (
    <div
      ref={canvasRootRef}
      style={{ width: '100%', height: '100%' }}
      onDoubleClick={onPaneDoubleClick}
      onPointerDownCapture={openKnowledgeFromInfoButton}
      onMouseDownCapture={openKnowledgeFromInfoButton}
    >
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          const panePosition = paneContextMenu?.position
          if (!contextMenu?.nodeId && !selectedNodeId && panePosition) {
            void Promise.all(files.map(readImageFile)).then((images) => createCanvasImageNode(images, { position: panePosition }))
            setPaneContextMenu(null)
            return
          }
          void addImagesFromFiles(files, contextMenu?.nodeId ?? selectedNodeId)
        }}
      />
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance
          setFlowReadyVersion((version) => version + 1)
          onFlowReady?.({
            screenToFlowPosition: instance.screenToFlowPosition.bind(instance),
            fitView: instance.fitView.bind(instance)
          })
        }}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          color="var(--border-color)" 
          gap={24} 
          size={1} 
        />
        {draggingNodeId && dragPreview?.mode && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '18px',
              transform: 'translateX(-50%)',
              zIndex: 20,
              padding: '9px 14px',
              borderRadius: '999px',
              background: dragPreview.mode === 'invalid'
                ? 'rgba(127, 29, 29, 0.92)'
                : dragPreview.mode === 'child'
                  ? 'rgba(13, 148, 136, 0.22)'
                  : 'rgba(9, 11, 16, 0.9)',
              border: dragPreview.mode === 'invalid'
                ? '1px solid rgba(248, 113, 113, 0.5)'
                : dragPreview.mode === 'child'
                  ? '1px solid rgba(45, 212, 191, 0.68)'
                  : '1px solid rgba(45, 212, 191, 0.24)',
              color: dragPreview.mode === 'invalid'
                ? '#fecaca'
                : dragPreview.mode === 'child'
                  ? '#ccfbf1'
                  : 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700,
              boxShadow: dragPreview.mode === 'child'
                ? '0 12px 28px rgba(0,0,0,0.24), 0 0 24px rgba(45, 212, 191, 0.22)'
                : '0 12px 28px rgba(0,0,0,0.24)',
              pointerEvents: 'none'
            }}
          >
            {dragPreview.message}
          </div>
        )}
        {contextMenu && documentNodes[contextMenu.nodeId] && (
          <div
            className="canvas-context-menu node-context-menu"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {contextMenuSections.map((section) => (
              <div key={section.key} className={section.className}>
                {section.label && <div className="node-context-menu-title">{section.label}</div>}
                {section.items.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`canvas-context-menu-item${item.danger ? ' is-danger' : ''}${item.wide ? ' is-wide' : ''}`}
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return
                        item.action()
                        setContextMenu(null)
                      }}
                    >
                      <Icon size={14} strokeWidth={1.8} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
        {paneContextMenu && (
          <div
            className="canvas-context-menu"
            style={{
              left: paneContextMenu.x,
              top: paneContextMenu.y,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="canvas-context-menu-item"
              onClick={() => {
                createCanvasNoteNode(paneContextMenu.position)
                setPaneContextMenu(null)
              }}
            >
              <StickyNote size={14} strokeWidth={1.8} />
              新建便签
            </button>
            {focusedRootNodeId && (
              <button
                type="button"
                className="canvas-context-menu-item"
                onClick={handleShowAllNodes}
              >
                <Eye size={14} strokeWidth={1.8} />
                显示全部
              </button>
            )}
            <button
              type="button"
              className="canvas-context-menu-item"
              onClick={() => {
                imageFileInputRef.current?.click()
              }}
            >
              <ImagePlus size={14} strokeWidth={1.8} />
              添加图片
            </button>
          </div>
        )}
        {edgeContextMenu && documentNodes[edgeContextMenu.targetNodeId] && (
          <div
            className="canvas-context-menu edge-color-menu"
            style={{
              left: edgeContextMenu.x,
              top: edgeContextMenu.y,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="edge-color-menu-title">
              <Palette size={14} strokeWidth={1.8} />
              更改颜色
            </div>
            {recentEdgeColors.length > 0 && (
              <div className="edge-color-recent">
                <span>最近使用</span>
                <div className="edge-color-recent-list">
                  {recentEdgeColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`edge-color-recent-button${edgeContextMenu.color === color ? ' is-active' : ''}`}
                      aria-label={`选择最近使用颜色 ${color}`}
                      onClick={() => setEdgeContextMenu((current) => current ? { ...current, color } : current)}
                    >
                      <span style={{ background: color }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="edge-color-swatches">
              {EDGE_COLOR_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`edge-color-swatch${edgeContextMenu.color === color ? ' is-active' : ''}`}
                  style={{ background: color }}
                  aria-label={`选择颜色 ${color}`}
                  onClick={() => setEdgeContextMenu((current) => current ? { ...current, color } : current)}
                />
              ))}
            </div>
            <label className="edge-color-custom">
              <span>自定义颜色</span>
              <input
                type="color"
                value={edgeContextMenu.color}
                onChange={(event) => setEdgeContextMenu((current) => (
                  current ? { ...current, color: event.target.value } : current
                ))}
              />
            </label>
            <button
              type="button"
              className={`edge-color-scope${edgeContextMenu.applyToDescendants ? ' is-active' : ''}`}
              onClick={() => setEdgeContextMenu((current) => (
                current ? { ...current, applyToDescendants: !current.applyToDescendants } : current
              ))}
            >
              <span />
              同步后续分支
            </button>
            <button
              type="button"
              className="canvas-context-menu-item edge-color-confirm"
              onClick={handleApplyEdgeColor}
            >
              确定
            </button>
          </div>
        )}
        {/* We can hide default controls if we implement custom floating toolbars, 
            but for now, we'll keep them as fallback or place them hidden */}
        <Controls showInteractive={false} style={{ opacity: 0, pointerEvents: 'none' }} />
      </ReactFlow>
    </div>
  )
}
