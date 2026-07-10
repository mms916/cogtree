import type { BaseNode } from '../stores/useDocumentStore'

const BACKUP_FORMAT = 'cogtree.quote-workspace'
const BACKUP_VERSION = 1

export type QuoteWorkspaceBackup = {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  workspace: {
    sourceQuoteId?: string
    sourceBookId?: string
    title: string
    text: string
    keywords: string[]
    nodes: Record<string, BaseNode>
    rootNodeIds: string[]
  }
}

export type QuoteWorkspaceBackupSummary = {
  nodeCount: number
  rootCount: number
  knowledgeItemCount: number
  maxDepth: number
}

export type BookBackup = {
  format: 'cogtree.book'
  version: 1
  exportedAt: string
  book: {
    title: string
    author: string
    color: string
    coverUrl?: string | null
  }
  workspaces: QuoteWorkspaceBackup[]
}

export type LibraryBackup = {
  format: 'cogtree.library'
  version: 1
  exportedAt: string
  books: BookBackup[]
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'cogtree-workspace'
}

function cloneNodes(nodes: Record<string, BaseNode>) {
  return Object.fromEntries(
    Object.entries(nodes).map(([id, node]) => [
      id,
      {
        ...node,
        childrenIds: [...node.childrenIds],
        position: { ...node.position },
        meta: node.meta ? structuredClone(node.meta) : undefined,
      },
    ])
  )
}

export function createQuoteWorkspaceBackup(input: {
  sourceQuoteId?: string | null
  sourceBookId?: string | null
  title: string
  text: string
  keywords: string[]
  nodes: Record<string, BaseNode>
  rootNodeIds: string[]
}): QuoteWorkspaceBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: {
      sourceQuoteId: input.sourceQuoteId ?? undefined,
      sourceBookId: input.sourceBookId ?? undefined,
      title: input.title.trim() || '未命名工作区',
      text: input.text,
      keywords: [...input.keywords],
      nodes: cloneNodes(input.nodes),
      rootNodeIds: [...input.rootNodeIds],
    },
  }
}

export function summarizeQuoteWorkspaceBackup(backup: QuoteWorkspaceBackup): QuoteWorkspaceBackupSummary {
  const { nodes, rootNodeIds } = backup.workspace
  let knowledgeItemCount = 0
  let maxDepth = 0
  const pending = rootNodeIds.map((id) => ({ id, depth: 1 }))
  const visited = new Set<string>()

  Object.values(nodes).forEach((node) => {
    if (Array.isArray(node.meta?.knowledgeItems)) {
      knowledgeItemCount += node.meta.knowledgeItems.length
    }
  })

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || visited.has(current.id)) continue
    visited.add(current.id)
    maxDepth = Math.max(maxDepth, current.depth)
    nodes[current.id]?.childrenIds.forEach((id) => pending.push({ id, depth: current.depth + 1 }))
  }

  return {
    nodeCount: Object.keys(nodes).length,
    rootCount: rootNodeIds.length,
    knowledgeItemCount,
    maxDepth,
  }
}

export function parseQuoteWorkspaceBackup(raw: string): {
  backup: QuoteWorkspaceBackup
  summary: QuoteWorkspaceBackupSummary
} {
  const parsed = JSON.parse(raw) as Partial<QuoteWorkspaceBackup>
  if (parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION || !parsed.workspace) {
    throw new Error('这不是受支持的 CogTree 工作区备份文件。')
  }

  const workspace = parsed.workspace as QuoteWorkspaceBackup['workspace']
  if (!workspace.nodes || typeof workspace.nodes !== 'object' || !Array.isArray(workspace.rootNodeIds)) {
    throw new Error('备份文件缺少节点或根节点数据。')
  }
  if (!Array.isArray(workspace.keywords) || typeof workspace.text !== 'string' || typeof workspace.title !== 'string') {
    throw new Error('备份文件的工作区信息不完整。')
  }

  const nodeIds = new Set(Object.keys(workspace.nodes))
  workspace.rootNodeIds.forEach((id) => {
    if (!nodeIds.has(id)) throw new Error(`根节点 ${id} 不存在。`)
  })
  Object.entries(workspace.nodes).forEach(([id, node]) => {
    if (!node || node.id !== id || !Array.isArray(node.childrenIds) || !node.position) {
      throw new Error(`节点 ${id} 的数据结构不完整。`)
    }
    if (node.parentId && !nodeIds.has(node.parentId)) {
      throw new Error(`节点 ${id} 引用了不存在的父节点。`)
    }
    node.childrenIds.forEach((childId) => {
      if (!nodeIds.has(childId)) throw new Error(`节点 ${id} 引用了不存在的子节点。`)
    })
  })

  const backup = parsed as QuoteWorkspaceBackup
  return { backup, summary: summarizeQuoteWorkspaceBackup(backup) }
}

export function downloadQuoteWorkspaceBackup(backup: QuoteWorkspaceBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFilename(backup.workspace.title)}-完整备份.json`
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadBookBackup(backup: BookBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFilename(backup.book.title)}-整书备份.json`
  link.click()
  URL.revokeObjectURL(url)
}

export function parseBookBackup(raw: string): BookBackup {
  const parsed = JSON.parse(raw) as Partial<BookBackup>
  if (parsed.format !== 'cogtree.book' || parsed.version !== 1 || !parsed.book || !Array.isArray(parsed.workspaces)) {
    throw new Error('这不是受支持的 CogTree 整书备份文件。')
  }
  if (typeof parsed.book.title !== 'string' || typeof parsed.book.author !== 'string') {
    throw new Error('备份文件缺少书籍信息。')
  }
  parsed.workspaces.forEach((workspace) => {
    parseQuoteWorkspaceBackup(JSON.stringify(workspace))
  })
  return parsed as BookBackup
}

export function downloadLibraryBackup(backup: LibraryBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `CogTree-全部书籍备份-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export function parseLibraryBackup(raw: string): LibraryBackup {
  const parsed = JSON.parse(raw) as Partial<LibraryBackup>
  if (parsed.format !== 'cogtree.library' || parsed.version !== 1 || !Array.isArray(parsed.books)) {
    throw new Error('这不是受支持的 CogTree 全部书籍备份文件。')
  }
  parsed.books.forEach((book) => parseBookBackup(JSON.stringify(book)))
  return parsed as LibraryBackup
}
