import { create } from 'zustand'

export type CanvasNodeStatus = 'normal' | 'selected' | 'pending_verify' | 'collapsed'

export interface NodeNote {
  id: string
  title: string
  content: string
  contentHtml?: string
  createdAt: number
}

export interface NodeImageAttachment {
  id: string
  src: string
  name?: string
  type?: string
  createdAt: number
}

export type KnowledgeTagKind = 'quote' | 'reflection' | 'inspiration' | 'case' | 'question' | 'action' | 'custom'
export type QuestionTemplateType = 'causal' | 'system' | 'completeness' | 'overlap' | 'level' | 'verification'
export type QuestionStatus = 'not_started' | 'to_think' | 'in_progress' | 'to_verify' | 'resolved' | 'converted_to_action'
export type ActionStatus = 'todo' | 'in_progress' | 'done' | 'delayed' | 'cancelled'

export interface NodeActionStep {
  id: string
  title: string
  isDone: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface NodeKnowledgeTag {
  id: string
  name: string
  kind: KnowledgeTagKind
  type: 'system' | 'custom'
  systemKey?: 'quote'
  isFixed: boolean
  color: string
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface NodeKnowledgeItem {
  id: string
  tagId: string
  contentType: KnowledgeTagKind
  title: string
  content: string
  contentHtml?: string
  plainText?: string
  summary?: string
  sourceBookName?: string
  sourcePage?: string
  tags?: string[]
  status?: 'todo' | 'active' | 'done' | 'paused' | 'delayed' | 'cancelled' | QuestionStatus
  priority?: 'high' | 'medium' | 'low'
  progress?: number
  dueDate?: string
  questionType?: QuestionTemplateType
  convertedActionId?: string
  parentActionId?: string
  linkedQuestionId?: string
  actionSteps?: NodeActionStep[]
  linkedNodeIds?: string[]
  linkedQuoteIds?: string[]
  linkedCaseIds?: string[]
  sortOrder?: number
  imageSrc?: string
  imageAlt?: string
  chain?: string[]
  createdAt: number
  updatedAt: number
}

export interface BaseNode extends Record<string, unknown> {
  id: string
  label: string
  parentId: string | null
  childrenIds: string[]
  orderIndex: number
  nodeType: 'concept' | 'cause' | 'effect' | 'abstract' | 'pending'
  status: CanvasNodeStatus
  position: { x: number; y: number } // React Flow position
  meta?: {
    notes?: NodeNote[]
    knowledgeTags?: NodeKnowledgeTag[]
    knowledgeItems?: NodeKnowledgeItem[]
    nodeImages?: NodeImageAttachment[]
    knowledgeImages?: NodeImageAttachment[]
    canvasImage?: boolean
    canvasNote?: boolean
    noteBadge?: string
    noteBody?: string
    noteSize?: {
      width: number
      height: number
    }
    imageSize?: {
      width: number
      height: number
    }
    [key: string]: any
  } // Extendable metadata
  shortDefinition?: string
}

type DocumentSnapshot = {
  nodes: Record<string, BaseNode>
  rootNodeIds: string[]
  treeId: string | null
  version: number
}

type DocumentSnapshotSource = {
  nodes: Record<string, BaseNode>
  rootNodeIds: string[]
  treeId: string | null
  version: number
}

const DOCUMENT_HISTORY_LIMIT = 10
const ROOT_NODE_WIDTH = 174
const BRANCH_NODE_WIDTH = 208
const LEAF_NODE_MIN_WIDTH = 40
const LEAF_NODE_MAX_WIDTH = 220
const MIND_MAP_LINK_LENGTH = 108
const ROOT_CHILD_VERTICAL_GAP = 32
const BRANCH_CHILD_VERTICAL_GAP = 18
const LEAF_CHILD_VERTICAL_GAP = 14
const ROOT_VERTICAL_GAP = 120
const ROOT_NODE_HEIGHT = 58
const BRANCH_NODE_HEIGHT = 50
const LEAF_NODE_HEIGHT = 28
const BRANCH_NODE_VERTICAL_SPAN = 58
const LEAF_NODE_VERTICAL_SPAN = 28
const LEAF_TEXT_LINE_HEIGHT = 24
const LEAF_TEXT_CHARS_PER_LINE = 13

function getTextVisualLength(text: string) {
  return Array.from(text).reduce((total, char) => {
    if (/[\u4e00-\u9fff]/.test(char)) return total + 1
    if (/\s/.test(char)) return total + 0.35
    return total + 0.58
  }, 0)
}

function getLeafTextLineCount(label: string) {
  const segments = label.split(/\r?\n/)
  return Math.max(1, segments.reduce((total, segment) => {
    const visualLength = Math.max(1, getTextVisualLength(segment.trim() || ' '))
    return total + Math.ceil(visualLength / LEAF_TEXT_CHARS_PER_LINE)
  }, 0))
}

function getPlainLeafVisualHeight(node: BaseNode | undefined) {
  const lines = getLeafTextLineCount(node?.label ?? '')
  return Math.max(LEAF_NODE_HEIGHT, lines * LEAF_TEXT_LINE_HEIGHT)
}

function getExplicitNodeSize(node: BaseNode | undefined) {
  if (!node?.meta) return null

  const imageSize = node.meta.canvasImage === true ? node.meta.imageSize : null
  if (
    imageSize &&
    typeof imageSize.width === 'number' &&
    typeof imageSize.height === 'number'
  ) {
    return {
      width: Math.max(96, imageSize.width),
      height: Math.max(72, imageSize.height)
    }
  }

  const noteSize = node.meta.canvasNote === true ? node.meta.noteSize : null
  if (
    noteSize &&
    typeof noteSize.width === 'number' &&
    typeof noteSize.height === 'number'
  ) {
    return {
      width: Math.max(260, noteSize.width),
      height: Math.max(170, noteSize.height)
    }
  }

  return null
}

function getNodeDepth(nodes: Record<string, BaseNode>, nodeId: string): number {
  let depth = 0
  let currentNode = nodes[nodeId]

  while (currentNode?.parentId) {
    depth += 1
    currentNode = nodes[currentNode.parentId]
  }

  return depth
}

function getNodeVerticalSpan(nodes: Record<string, BaseNode>, nodeId: string): number {
  const explicitSize = getExplicitNodeSize(nodes[nodeId])
  if (explicitSize) return explicitSize.height
  return getNodeDepth(nodes, nodeId) <= 1 ? BRANCH_NODE_VERTICAL_SPAN : getPlainLeafVisualHeight(nodes[nodeId])
}

function getNodeVisualHeight(nodes: Record<string, BaseNode>, nodeId: string): number {
  const explicitSize = getExplicitNodeSize(nodes[nodeId])
  if (explicitSize) return explicitSize.height

  const depth = getNodeDepth(nodes, nodeId)
  if (depth === 0) return ROOT_NODE_HEIGHT
  if (depth === 1) return BRANCH_NODE_HEIGHT
  return getPlainLeafVisualHeight(nodes[nodeId])
}

function getNodeVisualWidth(nodes: Record<string, BaseNode>, nodeId: string): number {
  const node = nodes[nodeId]
  const explicitSize = getExplicitNodeSize(node)
  if (explicitSize) return explicitSize.width

  const depth = getNodeDepth(nodes, nodeId)
  if (depth === 0) return ROOT_NODE_WIDTH
  if (depth === 1) return BRANCH_NODE_WIDTH

  const textLength = Math.max(1, node?.label.trim().length ?? 1)
  return Math.max(LEAF_NODE_MIN_WIDTH, Math.min(LEAF_NODE_MAX_WIDTH, textLength * 16))
}

function getNodeCenterY(nodes: Record<string, BaseNode>, node: BaseNode): number {
  return node.position.y + getNodeVisualHeight(nodes, node.id) / 2
}

function getChildVerticalGap(nodes: Record<string, BaseNode>, parentNodeId: string): number {
  const parentDepth = getNodeDepth(nodes, parentNodeId)
  if (parentDepth === 0) return ROOT_CHILD_VERTICAL_GAP
  if (parentDepth === 1) return BRANCH_CHILD_VERTICAL_GAP
  return LEAF_CHILD_VERTICAL_GAP
}

function getChildHorizontalGap(nodes: Record<string, BaseNode>, parentNodeId: string): number {
  return getNodeVisualWidth(nodes, parentNodeId) + MIND_MAP_LINK_LENGTH
}

function getSubtreeSpan(nodes: Record<string, BaseNode>, nodeId: string): number {
  const node = nodes[nodeId]
  if (!node) return LEAF_NODE_VERTICAL_SPAN
  if (node.status === 'collapsed' || node.childrenIds.length === 0) {
    return getNodeVerticalSpan(nodes, nodeId)
  }

  const childGap = getChildVerticalGap(nodes, nodeId)
  const totalChildrenSpan = node.childrenIds.reduce((total, childId, index) => {
    return total + getSubtreeSpan(nodes, childId) + (index > 0 ? childGap : 0)
  }, 0)

  return Math.max(getNodeVerticalSpan(nodes, nodeId), totalChildrenSpan)
}

function layoutSubtree(nodes: Record<string, BaseNode>, nodeId: string) {
  const node = nodes[nodeId]
  if (!node || node.status === 'collapsed' || node.childrenIds.length === 0) return

  const childGap = getChildVerticalGap(nodes, nodeId)
  const childHorizontalGap = getChildHorizontalGap(nodes, nodeId)
  const childSpans = node.childrenIds.map((childId) => getSubtreeSpan(nodes, childId))
  const totalChildrenSpan = childSpans.reduce((total, span, index) => {
    return total + span + (index > 0 ? childGap : 0)
  }, 0)

  let currentTop = getNodeCenterY(nodes, node) - totalChildrenSpan / 2

  node.childrenIds.forEach((childId, index) => {
    const childNode = nodes[childId]
    if (!childNode) return

    const childSpan = childSpans[index]
    const childCenterY = currentTop + childSpan / 2
    const childTopY = childCenterY - getNodeVisualHeight(nodes, childId) / 2

    nodes[childId] = {
      ...childNode,
      parentId: nodeId,
      orderIndex: index,
      position: {
        x: node.position.x + childHorizontalGap,
        y: childTopY
      }
    }

    layoutSubtree(nodes, childId)
    currentTop += childSpan + childGap
  })
}

function relayoutChildren(
  nodes: Record<string, BaseNode>,
  parentNode: BaseNode,
  childIds: string[]
) {
  nodes[parentNode.id] = {
    ...parentNode,
    childrenIds: childIds
  }
  layoutSubtree(nodes, parentNode.id)
}

function relayoutAncestors(nodes: Record<string, BaseNode>, startNodeId: string | null) {
  let currentNodeId = startNodeId
  while (currentNodeId) {
    const currentNode = nodes[currentNodeId]
    if (!currentNode) break
    layoutSubtree(nodes, currentNodeId)
    currentNodeId = currentNode.parentId
  }
}

function getRootNodeId(nodes: Record<string, BaseNode>, nodeId: string): string | null {
  let currentNode = nodes[nodeId]
  if (!currentNode) return null

  while (currentNode.parentId) {
    currentNode = nodes[currentNode.parentId]
    if (!currentNode) return null
  }

  return currentNode.id
}

function relayoutFromRoot(nodes: Record<string, BaseNode>, nodeId: string) {
  const rootNodeId = getRootNodeId(nodes, nodeId)
  if (!rootNodeId) return
  layoutSubtree(nodes, rootNodeId)
}

function collectSubtreeIds(nodes: Record<string, BaseNode>, nodeId: string): string[] {
  const node = nodes[nodeId]
  if (!node) return []

  return [nodeId, ...node.childrenIds.flatMap((childId) => collectSubtreeIds(nodes, childId))]
}

function shiftSubtree(
  nodes: Record<string, BaseNode>,
  nodeId: string,
  deltaX: number,
  deltaY: number,
  skipRoot = false
) {
  if (deltaX === 0 && deltaY === 0) return
  const subtreeIds = collectSubtreeIds(nodes, nodeId)

  subtreeIds.forEach((subtreeId, index) => {
    if (skipRoot && index === 0) return
    const subtreeNode = nodes[subtreeId]
    if (!subtreeNode) return

    nodes[subtreeId] = {
      ...subtreeNode,
      position: {
        x: subtreeNode.position.x + deltaX,
        y: subtreeNode.position.y + deltaY
      }
    }
  })
}

function removeFromParent(
  nodes: Record<string, BaseNode>,
  rootNodeIds: string[],
  nodeId: string
) {
  const targetNode = nodes[nodeId]
  if (!targetNode) return { rootNodeIds }

  if (targetNode.parentId) {
    const parentNode = nodes[targetNode.parentId]
    if (!parentNode) return { rootNodeIds }
    const siblingIds = parentNode.childrenIds.filter((childId) => childId !== nodeId)
    nodes[parentNode.id] = {
      ...parentNode,
      childrenIds: siblingIds
    }
    relayoutChildren(nodes, parentNode, siblingIds)
    relayoutAncestors(nodes, parentNode.parentId)
    relayoutFromRoot(nodes, parentNode.id)
    return { rootNodeIds }
  }

  const nextRootNodeIds = rootNodeIds.filter((rootId) => rootId !== nodeId)
  nextRootNodeIds.forEach((rootId, index) => {
    const rootNode = nodes[rootId]
    if (!rootNode) return
    nodes[rootId] = {
      ...rootNode,
      orderIndex: index
    }
  })
  return { rootNodeIds: nextRootNodeIds }
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

function createDocumentSnapshot(state: DocumentSnapshotSource): DocumentSnapshot {
  return {
    nodes: state.nodes,
    rootNodeIds: state.rootNodeIds,
    treeId: state.treeId,
    version: state.version
  }
}

function pushUndoHistory(state: DocumentSnapshotSource & { undoStack: DocumentSnapshot[] }) {
  return {
    undoStack: [...state.undoStack, createDocumentSnapshot(state)].slice(-DOCUMENT_HISTORY_LIMIT),
    redoStack: []
  }
}

interface DocumentState {
  nodes: Record<string, BaseNode>
  rootNodeIds: string[]
  treeId: string | null
  version: number
  undoStack: DocumentSnapshot[]
  redoStack: DocumentSnapshot[]
  
  // Actions / Commands
  setTree: (treeId: string, nodes: Record<string, BaseNode>, rootNodeIds: string[], version?: number) => void
  undo: () => void
  redo: () => void
  clearHistory: () => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void
  updateNodePositionWithChildren: (id: string, position: { x: number; y: number }) => void
  updateNodeLabel: (id: string, label: string) => void
  updateNodeType: (id: string, nodeType: BaseNode['nodeType']) => void
  updateNodeShortDefinition: (id: string, shortDefinition: string) => void
  createNode: (parentId: string | null, label: string, position: { x: number; y: number }, nodeType?: BaseNode['nodeType']) => string | null
  createSiblingNode: (nodeId: string, label: string, nodeType?: BaseNode['nodeType']) => string | null
  duplicateSubtree: (
    sourceNodeId: string,
    options?: {
      parentId?: string | null
      afterNodeId?: string | null
      position?: { x: number; y: number }
    }
  ) => string | null
  deleteNode: (nodeId: string) => void
  moveNodeAsChild: (nodeId: string, parentId: string) => boolean
  moveNodeAsSibling: (nodeId: string, targetNodeId: string) => boolean
  toggleNodeCollapsed: (nodeId: string) => void
  updateNodeMeta: (id: string, meta: Record<string, unknown>) => void
  updateSubtreeEdgeColor: (nodeId: string, edgeColor: string) => void
  updateNodeNotes: (id: string, notes: NodeNote[]) => void
  clearNodes: () => void
}

function generateNodeId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useDocumentStore = create<DocumentState>((set) => ({
  nodes: {},
  rootNodeIds: [],
  treeId: null,
  version: 1,
  undoStack: [],
  redoStack: [],

  setTree: (treeId, nodes, rootNodeIds, version = 1) => 
    set((state) => ({
      treeId,
      nodes,
      rootNodeIds,
      version,
      ...(state.treeId === treeId ? {} : { undoStack: [], redoStack: [] })
    })),

  undo: () =>
    set((state) => {
      const previousSnapshot = state.undoStack[state.undoStack.length - 1]
      if (!previousSnapshot) return state

      return {
        ...previousSnapshot,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [createDocumentSnapshot(state), ...state.redoStack].slice(0, DOCUMENT_HISTORY_LIMIT)
      }
    }),

  redo: () =>
    set((state) => {
      const nextSnapshot = state.redoStack[0]
      if (!nextSnapshot) return state

      return {
        ...nextSnapshot,
        undoStack: [...state.undoStack, createDocumentSnapshot(state)].slice(-DOCUMENT_HISTORY_LIMIT),
        redoStack: state.redoStack.slice(1)
      }
    }),

  clearHistory: () => set({ undoStack: [], redoStack: [] }),

  updateNodePosition: (id, position) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: { ...state.nodes[id], position }
      }
    })),

  updateNodePositionWithChildren: (id: string, position: { x: number; y: number }) =>
    set((state) => {
      const node = state.nodes[id]
      if (!node) return state

      const deltaX = position.x - node.position.x
      const deltaY = position.y - node.position.y

      const getAllDescendants = (nodeId: string): string[] => {
        const children = state.nodes[nodeId]?.childrenIds ?? []
        return children.reduce<string[]>((acc, childId) => {
          return [...acc, childId, ...getAllDescendants(childId)]
        }, [])
      }

      const descendantIds = getAllDescendants(id)
      const nodesToUpdate = [id, ...descendantIds]

      const nextNodes = { ...state.nodes }
      nodesToUpdate.forEach((nodeId) => {
        const n = nextNodes[nodeId]
        if (n) {
          nextNodes[nodeId] = {
            ...n,
            position: {
              x: n.position.x + deltaX,
              y: n.position.y + deltaY
            }
          }
        }
      })

      return { nodes: nextNodes }
    }),

  updateNodeLabel: (id, label) =>
    set((state) => {
      const node = state.nodes[id]
      if (!node || node.label === label) return state
      const nextNodes = {
        ...state.nodes,
        [id]: { ...node, label }
      }
      relayoutFromRoot(nextNodes, id)

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        version: state.version + 1
      }
    }),

  updateNodeType: (id, nodeType) =>
    set((state) => {
      const node = state.nodes[id]
      if (!node || node.nodeType === nodeType) return state

      return {
        ...pushUndoHistory(state),
        nodes: {
          ...state.nodes,
          [id]: { ...node, nodeType }
        },
        version: state.version + 1
      }
    }),

  updateNodeShortDefinition: (id, shortDefinition) =>
    set((state) => {
      const node = state.nodes[id]
      if (!node || node.shortDefinition === shortDefinition) return state

      return {
        ...pushUndoHistory(state),
        nodes: {
          ...state.nodes,
          [id]: { ...node, shortDefinition }
        },
        version: state.version + 1
      }
    }),

  updateNodeMeta: (id, meta) =>
    set((state) => {
      const node = state.nodes[id]
      if (!node) return state
      const nextMeta = {
        ...(node.meta ?? {}),
        ...meta
      }
      const nextNodes = {
        ...state.nodes,
        [id]: {
          ...node,
          meta: nextMeta
        }
      }
      const shouldRelayout =
        'imageSize' in meta ||
        'noteSize' in meta ||
        'canvasImage' in meta ||
        'canvasNote' in meta

      if (shouldRelayout) {
        relayoutFromRoot(nextNodes, id)
      }

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        version: state.version + 1
      }
    }),

  updateSubtreeEdgeColor: (nodeId, edgeColor) =>
    set((state) => {
      const node = state.nodes[nodeId]
      if (!node) return state

      const subtreeIds = collectSubtreeIds(state.nodes, nodeId)
      const nextNodes = { ...state.nodes }

      subtreeIds.forEach((subtreeId) => {
        const subtreeNode = nextNodes[subtreeId]
        if (!subtreeNode) return

        nextNodes[subtreeId] = {
          ...subtreeNode,
          meta: {
            ...(subtreeNode.meta ?? {}),
            edgeColor,
          },
        }
      })

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        version: state.version + 1,
      }
    }),

  updateNodeNotes: (id, notes) => set((state) => {
    const node = state.nodes[id]
    if (!node) return state
    return { 
      ...pushUndoHistory(state),
      nodes: { 
        ...state.nodes, 
        [id]: { 
          ...node, 
          meta: { ...(node.meta || {}), notes } 
        } 
      },
      version: state.version + 1
    }
  }),

  clearNodes: () => set({ nodes: {}, rootNodeIds: [], version: Date.now(), undoStack: [], redoStack: [] }),

  createNode: (parentId, label, position, nodeType = 'concept') => {
    let createdNodeId: string | null = null

    set((state) => {
      const newNodeId = generateNodeId()
      createdNodeId = newNodeId
      const parentNode = parentId ? state.nodes[parentId] : null
      const siblingIds = parentNode ? [...parentNode.childrenIds, newNodeId] : []
      const siblingIndex = siblingIds.length - 1
      const rootIndex = state.rootNodeIds.length
      const childHorizontalGap = parentNode && parentId ? getChildHorizontalGap(state.nodes, parentId) : ROOT_NODE_WIDTH + MIND_MAP_LINK_LENGTH
      const childVerticalGap = parentNode && parentId ? getChildVerticalGap(state.nodes, parentId) : ROOT_CHILD_VERTICAL_GAP
      const parentCenterY = parentNode ? getNodeCenterY(state.nodes, parentNode) : position.y
      const nextPosition = parentNode
        ? {
            x: parentNode.position.x + childHorizontalGap,
            y: parentCenterY +
              (siblingIndex - (siblingIds.length - 1) / 2) * childVerticalGap -
              LEAF_NODE_HEIGHT / 2
          }
        : {
            x: position.x,
            y: position.y + rootIndex * ROOT_VERTICAL_GAP
          }
      const newNode: BaseNode = {
        id: newNodeId,
        label,
        parentId,
        childrenIds: [],
        orderIndex: siblingIndex,
        nodeType,
        status: 'normal',
        position: nextPosition,
      }
      
      const nextNodes = { ...state.nodes, [newNodeId]: newNode }
      
      if (parentNode && parentId && nextNodes[parentId]) {
        const expandedParentNode = {
          ...parentNode,
          status: 'normal' as CanvasNodeStatus,
          childrenIds: siblingIds
        }
        nextNodes[parentId] = expandedParentNode

        relayoutChildren(nextNodes, expandedParentNode, siblingIds)
        relayoutAncestors(nextNodes, expandedParentNode.parentId)
        relayoutFromRoot(nextNodes, expandedParentNode.id)
      }

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        rootNodeIds: parentId ? state.rootNodeIds : [...state.rootNodeIds, newNodeId],
        version: state.version + 1
      }
    })

    return createdNodeId
  },

  createSiblingNode: (nodeId, label, nodeType = 'concept') => {
    let createdNodeId: string | null = null

    set((state) => {
      const targetNode = state.nodes[nodeId]
      if (!targetNode) return state

      const newNodeId = generateNodeId()
      createdNodeId = newNodeId

      if (targetNode.parentId) {
        const parentNode = state.nodes[targetNode.parentId]
        if (!parentNode) return state

        const siblingIds = [...parentNode.childrenIds]
        const targetIndex = Math.max(0, siblingIds.indexOf(nodeId))
        siblingIds.splice(targetIndex + 1, 0, newNodeId)

        const newNode: BaseNode = {
          id: newNodeId,
          label,
          parentId: parentNode.id,
          childrenIds: [],
          orderIndex: targetIndex + 1,
          nodeType,
          status: 'normal',
          position: {
            x: parentNode.position.x + getChildHorizontalGap(state.nodes, parentNode.id),
            y: getNodeCenterY(state.nodes, targetNode) + getChildVerticalGap(state.nodes, parentNode.id) - LEAF_NODE_HEIGHT / 2
          }
        }

        const nextNodes: Record<string, BaseNode> = {
          ...state.nodes,
          [newNodeId]: newNode
        }

        nextNodes[parentNode.id] = {
          ...parentNode,
          childrenIds: siblingIds
        }

        relayoutChildren(nextNodes, parentNode, siblingIds)
        relayoutAncestors(nextNodes, parentNode.parentId)
        relayoutFromRoot(nextNodes, parentNode.id)

        return {
          ...pushUndoHistory(state),
          nodes: nextNodes,
          rootNodeIds: state.rootNodeIds,
          version: state.version + 1
        }
      }

      const rootNodeIds = [...state.rootNodeIds]
      const targetIndex = Math.max(0, rootNodeIds.indexOf(nodeId))
      rootNodeIds.splice(targetIndex + 1, 0, newNodeId)

      const newRootNode: BaseNode = {
        id: newNodeId,
        label,
        parentId: null,
        childrenIds: [],
        orderIndex: targetIndex + 1,
        nodeType,
        status: 'normal',
        position: {
          x: targetNode.position.x,
          y: targetNode.position.y + ROOT_VERTICAL_GAP
        }
      }

      const nextNodes: Record<string, BaseNode> = {
        ...state.nodes,
        [newNodeId]: newRootNode
      }

      rootNodeIds.forEach((rootId, index) => {
        const rootNode = nextNodes[rootId]
        if (!rootNode) return
        nextNodes[rootId] = {
          ...rootNode,
          orderIndex: index
        }
      })

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        rootNodeIds,
        version: state.version + 1
      }
    })

    return createdNodeId
  },

  duplicateSubtree: (sourceNodeId, options = {}) => {
    let duplicatedRootId: string | null = null

    set((state) => {
      const sourceNode = state.nodes[sourceNodeId]
      if (!sourceNode) return state

      const targetParentId = options.parentId === undefined ? sourceNode.parentId : options.parentId
      const targetParent = targetParentId ? state.nodes[targetParentId] : null
      if (targetParentId && !targetParent) return state

      const sourceRootPosition = sourceNode.position
      const targetRootPosition = options.position ?? {
        x: sourceNode.position.x + 48,
        y: sourceNode.position.y + 48
      }
      const nextNodes: Record<string, BaseNode> = { ...state.nodes }

      const cloneMeta = (meta: BaseNode['meta']) => {
        if (!meta) return undefined
        try {
          return JSON.parse(JSON.stringify(meta))
        } catch {
          return { ...meta }
        }
      }

      const cloneSubtree = (nodeId: string, parentId: string | null, isRootClone: boolean): string | null => {
        const node = state.nodes[nodeId]
        if (!node) return null

        const newNodeId = generateNodeId()
        if (isRootClone) duplicatedRootId = newNodeId

        const clonedChildIds = node.childrenIds
          .map((childId) => cloneSubtree(childId, newNodeId, false))
          .filter((childId): childId is string => childId !== null)

        nextNodes[newNodeId] = {
          ...node,
          id: newNodeId,
          label: node.label,
          parentId,
          childrenIds: clonedChildIds,
          orderIndex: 0,
          position: {
            x: targetRootPosition.x + (node.position.x - sourceRootPosition.x),
            y: targetRootPosition.y + (node.position.y - sourceRootPosition.y)
          },
          meta: cloneMeta(node.meta),
        }

        clonedChildIds.forEach((childId, index) => {
          const childNode = nextNodes[childId]
          if (!childNode) return
          nextNodes[childId] = {
            ...childNode,
            orderIndex: index
          }
        })

        return newNodeId
      }

      const newRootId = cloneSubtree(sourceNodeId, targetParentId ?? null, true)
      if (!newRootId) return state

      if (targetParentId && targetParent) {
        const siblingIds = [...targetParent.childrenIds]
        const afterIndex = options.afterNodeId ? siblingIds.indexOf(options.afterNodeId) : -1
        const insertIndex = afterIndex >= 0 ? afterIndex + 1 : siblingIds.length
        siblingIds.splice(insertIndex, 0, newRootId)

        nextNodes[newRootId] = {
          ...nextNodes[newRootId],
          parentId: targetParentId,
          orderIndex: insertIndex
        }
        nextNodes[targetParentId] = {
          ...targetParent,
          childrenIds: siblingIds
        }
        relayoutChildren(nextNodes, targetParent, siblingIds)
        relayoutAncestors(nextNodes, targetParent.parentId)
        relayoutFromRoot(nextNodes, targetParent.id)

        return {
          ...pushUndoHistory(state),
          nodes: nextNodes,
          rootNodeIds: state.rootNodeIds,
          version: state.version + 1
        }
      }

      const rootNodeIds = [...state.rootNodeIds]
      const afterIndex = options.afterNodeId ? rootNodeIds.indexOf(options.afterNodeId) : -1
      const insertIndex = afterIndex >= 0 ? afterIndex + 1 : rootNodeIds.length
      rootNodeIds.splice(insertIndex, 0, newRootId)
      rootNodeIds.forEach((rootId, index) => {
        const rootNode = nextNodes[rootId]
        if (!rootNode) return
        nextNodes[rootId] = {
          ...rootNode,
          parentId: null,
          orderIndex: index
        }
      })
      layoutSubtree(nextNodes, newRootId)

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        rootNodeIds,
        version: state.version + 1
      }
    })

    return duplicatedRootId
  },

  deleteNode: (nodeId) =>
    set((state) => {
      const targetNode = state.nodes[nodeId]
      if (!targetNode) return state

      const subtreeIds = collectSubtreeIds(state.nodes, nodeId)
      const nextNodes = { ...state.nodes }
      subtreeIds.forEach((id) => {
        delete nextNodes[id]
      })

      if (targetNode.parentId) {
        const parentNode = nextNodes[targetNode.parentId]
        if (!parentNode) {
          return {
            ...pushUndoHistory(state),
            nodes: nextNodes,
            rootNodeIds: state.rootNodeIds,
            version: state.version + 1
          }
        }

        const siblingIds = parentNode.childrenIds.filter((childId) => childId !== nodeId)
        nextNodes[parentNode.id] = {
          ...parentNode,
          childrenIds: siblingIds
        }
        relayoutChildren(nextNodes, parentNode, siblingIds)
        relayoutAncestors(nextNodes, parentNode.parentId)
        relayoutFromRoot(nextNodes, parentNode.id)

        return {
          ...pushUndoHistory(state),
          nodes: nextNodes,
          rootNodeIds: state.rootNodeIds,
          version: state.version + 1
        }
      }

      const rootNodeIds = state.rootNodeIds.filter((rootId) => rootId !== nodeId)
      rootNodeIds.forEach((rootId, index) => {
        const rootNode = nextNodes[rootId]
        if (!rootNode) return
        nextNodes[rootId] = {
          ...rootNode,
          orderIndex: index
        }
      })

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        rootNodeIds,
        version: state.version + 1
      }
    }),

  moveNodeAsChild: (nodeId, parentId) => {
    let moved = false

    set((state) => {
      const targetNode = state.nodes[nodeId]
      const parentNode = state.nodes[parentId]
      if (!targetNode || !parentNode) return state
      if (nodeId === parentId || isDescendant(state.nodes, nodeId, parentId)) return state
      if (targetNode.parentId === parentId) return state

      const nextNodes = { ...state.nodes }
      const removed = removeFromParent(nextNodes, state.rootNodeIds, nodeId)
      const nextRootNodeIds = removed.rootNodeIds
      const refreshedParent = nextNodes[parentId]
      if (!refreshedParent) return state

      const childIds = [...refreshedParent.childrenIds, nodeId]
      nextNodes[nodeId] = {
        ...nextNodes[nodeId],
        parentId,
        orderIndex: childIds.length - 1
      }
      nextNodes[parentId] = {
        ...refreshedParent,
        childrenIds: childIds
      }
      relayoutChildren(nextNodes, refreshedParent, childIds)
      relayoutAncestors(nextNodes, refreshedParent.parentId)
      relayoutFromRoot(nextNodes, refreshedParent.id)
      moved = true

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        rootNodeIds: nextRootNodeIds,
        version: state.version + 1
      }
    })

    return moved
  },

  moveNodeAsSibling: (nodeId, targetNodeId) => {
    let moved = false

    set((state) => {
      const movingNode = state.nodes[nodeId]
      const targetNode = state.nodes[targetNodeId]
      if (!movingNode || !targetNode) return state
      if (nodeId === targetNodeId || isDescendant(state.nodes, nodeId, targetNodeId)) return state

      const nextNodes = { ...state.nodes }
      const removed = removeFromParent(nextNodes, state.rootNodeIds, nodeId)
      const previousPosition = nextNodes[nodeId].position

      if (targetNode.parentId) {
        const parentNode = nextNodes[targetNode.parentId]
        if (!parentNode) return state

        const siblingIds = [...parentNode.childrenIds]
        const targetIndex = Math.max(0, siblingIds.indexOf(targetNodeId))
        siblingIds.splice(targetIndex + 1, 0, nodeId)

        nextNodes[nodeId] = {
          ...nextNodes[nodeId],
          parentId: parentNode.id,
          orderIndex: targetIndex + 1
        }
        nextNodes[parentNode.id] = {
          ...parentNode,
          childrenIds: siblingIds
        }
        relayoutChildren(nextNodes, parentNode, siblingIds)
        relayoutAncestors(nextNodes, parentNode.parentId)
        relayoutFromRoot(nextNodes, parentNode.id)
      } else {
        const rootNodeIds = [...removed.rootNodeIds]
        const targetIndex = Math.max(0, rootNodeIds.indexOf(targetNodeId))
        rootNodeIds.splice(targetIndex + 1, 0, nodeId)

        nextNodes[nodeId] = {
          ...nextNodes[nodeId],
          parentId: null,
          orderIndex: targetIndex + 1
        }

        rootNodeIds.forEach((rootId, index) => {
          const rootNode = nextNodes[rootId]
          if (!rootNode) return
          nextNodes[rootId] = {
            ...rootNode,
            orderIndex: index,
            position: index === rootNodeIds.indexOf(nodeId)
              ? {
                  x: targetNode.position.x,
                  y: targetNode.position.y + ROOT_VERTICAL_GAP
                }
              : rootNode.position
          }
        })

        const movedNode = nextNodes[nodeId]
        const deltaX = movedNode.position.x - previousPosition.x
        const deltaY = movedNode.position.y - previousPosition.y
        shiftSubtree(nextNodes, nodeId, deltaX, deltaY, true)

        moved = true
        return {
          ...pushUndoHistory(state),
          nodes: nextNodes,
          rootNodeIds,
          version: state.version + 1
        }
      }

      moved = true

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        rootNodeIds: removed.rootNodeIds,
        version: state.version + 1
      }
    })

    return moved
  },

  toggleNodeCollapsed: (nodeId) => {
    set((state) => {
      const targetNode = state.nodes[nodeId]
      if (!targetNode) return state

      const nextNodes: Record<string, BaseNode> = {
        ...state.nodes,
        [nodeId]: {
          ...targetNode,
          status: targetNode.status === 'collapsed' ? 'normal' : 'collapsed'
        }
      }

      relayoutFromRoot(nextNodes, nodeId)

      return {
        ...pushUndoHistory(state),
        nodes: nextNodes,
        version: state.version + 1
      }
    })
  }
}))
