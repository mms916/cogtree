import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ArchiveRestore, DatabaseBackup, Download, Layers3, Plus, Trash2, Upload, X } from 'lucide-react'

import { fetchJson } from '../lib/api'
import {
  createQuoteWorkspaceBackup,
  downloadLibraryBackup,
  parseBookBackup,
  parseLibraryBackup,
} from '../lib/workspaceBackup'
import type { BookBackup, LibraryBackup } from '../lib/workspaceBackup'
import type { Book, QuoteItem } from '../stores/useLibraryStore'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useCanvasPreferencesStore } from '../stores/useCanvasPreferencesStore'
import type { FrameworkTemplateNode } from '../stores/useCanvasPreferencesStore'

type RestorableBackup = BookBackup | LibraryBackup

function TemplateNodeEditor({
  node,
  templateId,
  depth,
  canDelete = true,
}: {
  node: FrameworkTemplateNode
  templateId: string
  depth: number
  canDelete?: boolean
}) {
  const { addTemplateNode, updateTemplateNode, deleteTemplateNode } = useCanvasPreferencesStore()

  return (
    <div className="settings-template-node" style={{ marginLeft: depth * 22 }}>
      <div className="settings-template-node-row">
        <span className="settings-template-branch">{depth > 0 ? '└' : '•'}</span>
        <input
          value={node.label}
          placeholder="节点内容"
          onChange={(event) => updateTemplateNode(templateId, node.id, { label: event.target.value })}
        />
        <button type="button" title="添加子节点" onClick={() => addTemplateNode(templateId, node.id)}><Plus size={14} /></button>
        <button type="button" title={canDelete ? '删除节点' : '框架至少保留两个一级节点'} disabled={!canDelete} className="is-danger" onClick={() => deleteTemplateNode(templateId, node.id)}><Trash2 size={14} /></button>
      </div>
      {node.children.map((child) => (
        <TemplateNodeEditor key={child.id} node={child} templateId={templateId} depth={depth + 1} />
      ))}
    </div>
  )
}

export function SettingsPage() {
  const backupInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingRestore, setPendingRestore] = useState<RestorableBackup | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const {
    frameworkTemplates,
    addFrameworkTemplate,
    updateFrameworkTemplate,
    deleteFrameworkTemplate,
    addTemplateNode,
  } = useCanvasPreferencesStore()
  const {
    books,
    quotes,
    groups,
    loadLibraryFromApi,
    addGroup,
    addBook,
    updateBookAuthor,
    updateBookCover,
    saveQuoteWorkspace,
  } = useLibraryStore()

  useEffect(() => {
    loadLibraryFromApi().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : '无法读取书籍数据。')
    })
  }, [loadLibraryFromApi])

  const restoreBooks = useMemo(
    () => pendingRestore
      ? pendingRestore.format === 'cogtree.library' ? pendingRestore.books : [pendingRestore]
      : [],
    [pendingRestore]
  )
  const restoreWorkspaceCount = useMemo(
    () => restoreBooks.reduce((total, book) => total + book.workspaces.length, 0),
    [restoreBooks]
  )

  const buildBookBackup = async (book: Book): Promise<BookBackup> => {
    const bookQuotes = quotes.filter((quote) => quote.bookId === book.id)
    const workspaces: BookBackup['workspaces'] = []
    for (let index = 0; index < bookQuotes.length; index += 1) {
      setStatus(`正在读取《${book.title.replaceAll('《', '').replaceAll('》', '')}》 ${index + 1} / ${bookQuotes.length}`)
      const response = await fetchJson<{ success: true; data: QuoteItem }>(`/quote-workspaces/${bookQuotes[index].id}`)
      const quote = response.data
      if (!quote.treeSnapshot) continue
      workspaces.push(createQuoteWorkspaceBackup({
        sourceQuoteId: quote.id,
        sourceBookId: book.id,
        title: quote.treeTitle || quote.text.slice(0, 24) || '未命名工作区',
        text: quote.text,
        keywords: quote.workspaceKeywords ?? [],
        nodes: quote.treeSnapshot.nodes,
        rootNodeIds: quote.treeSnapshot.rootNodeIds,
      }))
    }
    return {
      format: 'cogtree.book',
      version: 1,
      exportedAt: new Date().toISOString(),
      book: {
        title: book.title,
        author: book.author,
        color: book.color,
        coverUrl: book.coverUrl,
      },
      workspaces,
    }
  }

  const handleExportLibrary = async () => {
    if (isWorking) return
    setIsWorking(true)
    setError('')
    try {
      const bookBackups: BookBackup[] = []
      for (let index = 0; index < books.length; index += 1) {
        setStatus(`正在备份书籍 ${index + 1} / ${books.length}`)
        bookBackups.push(await buildBookBackup(books[index]))
      }
      downloadLibraryBackup({
        format: 'cogtree.library',
        version: 1,
        exportedAt: new Date().toISOString(),
        books: bookBackups,
      })
      setStatus(`备份完成，共 ${books.length} 本书。`)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : '导出全部书籍失败。')
      setStatus('')
    } finally {
      setIsWorking(false)
    }
  }

  const handleBackupFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const raw = await file.text()
      const header = JSON.parse(raw) as { format?: string }
      setPendingRestore(header.format === 'cogtree.library' ? parseLibraryBackup(raw) : parseBookBackup(raw))
    } catch (fileError) {
      setPendingRestore(null)
      setError(fileError instanceof Error ? fileError.message : '无法读取备份文件。')
    }
  }

  const confirmRestore = async () => {
    if (!pendingRestore || isWorking) return
    setIsWorking(true)
    setError('')
    try {
      let targetGroupId = groups[0]?.id ?? null
      if (!targetGroupId) targetGroupId = (await addGroup('恢复的书籍')).id

      let completedWorkspaces = 0
      for (let bookIndex = 0; bookIndex < restoreBooks.length; bookIndex += 1) {
        const backup = restoreBooks[bookIndex]
        setStatus(`正在恢复书籍 ${bookIndex + 1} / ${restoreBooks.length}`)
        const restoredBook = await addBook(targetGroupId, `${backup.book.title}（恢复）`)
        if (backup.book.author) await updateBookAuthor(restoredBook.id, backup.book.author)
        if (backup.book.coverUrl) await updateBookCover(restoredBook.id, backup.book.coverUrl)

        for (const item of backup.workspaces) {
          completedWorkspaces += 1
          setStatus(`正在恢复工作区 ${completedWorkspaces} / ${restoreWorkspaceCount}`)
          const workspace = item.workspace
          await saveQuoteWorkspace({
            bookId: restoredBook.id,
            text: workspace.text,
            nodes: workspace.nodes,
            rootNodeIds: workspace.rootNodeIds,
            treeTitle: workspace.title,
            workspaceKeywords: workspace.keywords,
          })
        }
      }
      setPendingRestore(null)
      setStatus(`恢复完成，共新增 ${restoreBooks.length} 本书。`)
      await loadLibraryFromApi()
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : '恢复备份失败。')
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>设置</h1>
          <p className="muted">管理 CogTree 的数据备份与恢复。</p>
        </div>
      </header>

      <section className="settings-section">
        <div className="settings-section-heading">
          <Layers3 size={20} />
          <div>
            <h2>框架模板</h2>
            <p>自定义节点右键菜单中的框架。模板支持任意层级，每一层都可以设置节点文字。</p>
          </div>
          <button type="button" className="primary-button" onClick={addFrameworkTemplate}><Plus size={16} /> 新建模板</button>
        </div>
        <div className="settings-template-list">
          {frameworkTemplates.map((template) => (
            <article key={template.id} className="settings-template-card">
              <div className="settings-template-header">
                <input
                  value={template.name}
                  aria-label="框架名称"
                  onChange={(event) => updateFrameworkTemplate(template.id, { name: event.target.value })}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={template.enabled}
                    onChange={(event) => updateFrameworkTemplate(template.id, { enabled: event.target.checked })}
                  />
                  显示在右键菜单
                </label>
                <button type="button" className="is-danger" title="删除模板" onClick={() => deleteFrameworkTemplate(template.id)}><Trash2 size={15} /></button>
              </div>
              <div className="settings-template-tree">
                {template.nodes.map((node) => (
                  <TemplateNodeEditor key={node.id} node={node} templateId={template.id} depth={0} canDelete={template.nodes.length > 2} />
                ))}
              </div>
              <button type="button" className="secondary-button" disabled={template.nodes.length >= 5} onClick={() => addTemplateNode(template.id)}><Plus size={15} /> {template.nodes.length >= 5 ? '最多 5 个一级节点' : '添加一级节点'}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <DatabaseBackup size={20} />
          <div>
            <h2>数据备份与恢复</h2>
            <p>备份范围以书籍为单位，包含书籍下的金句画布、节点结构和节点知识。</p>
          </div>
        </div>

        <div className="settings-action-grid">
          <article className="settings-action-card">
            <div className="settings-action-icon"><Download size={22} /></div>
            <div>
              <h3>导出全部书籍</h3>
              <p>将当前书库中的 {books.length} 本书合并为一个 CogTree 备份文件。</p>
            </div>
            <button type="button" className="primary-button" disabled={isWorking || books.length === 0} onClick={() => void handleExportLibrary()}>
              <DatabaseBackup size={17} />
              导出全部
            </button>
          </article>

          <article className="settings-action-card">
            <div className="settings-action-icon"><Upload size={22} /></div>
            <div>
              <h3>恢复书籍备份</h3>
              <p>支持单本或全部书籍备份；恢复时创建新书，不覆盖现有内容。</p>
            </div>
            <button type="button" className="secondary-button" disabled={isWorking} onClick={() => backupInputRef.current?.click()}>
              <ArchiveRestore size={17} />
              选择备份
            </button>
          </article>
        </div>

        {(status || error) && (
          <div className={`settings-backup-status${error ? ' is-error' : ''}`}>
            <span>{error || status}</span>
            {isWorking && <div className="settings-backup-progress"><span /></div>}
          </div>
        )}
      </section>

      <input ref={backupInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void handleBackupFile(event)} />

      {pendingRestore && (
        <div className="markdown-import-dialog-backdrop" role="presentation" onMouseDown={() => !isWorking && setPendingRestore(null)}>
          <section className="markdown-import-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="markdown-import-dialog-head">
              <div>
                <strong>{pendingRestore.format === 'cogtree.library' ? '恢复全部书籍备份' : '恢复整书备份'}</strong>
                <p>备份内容将作为新书加入当前书库。</p>
              </div>
              <button type="button" disabled={isWorking} onClick={() => setPendingRestore(null)}><X size={18} /></button>
            </div>
            <div className="markdown-import-stats">
              <div><span>书籍</span><strong>{restoreBooks.length}</strong></div>
              <div><span>工作区</span><strong>{restoreWorkspaceCount}</strong></div>
              <div><span>现有书籍</span><strong>{books.length}</strong></div>
              <div><span>恢复方式</span><strong>新增</strong></div>
            </div>
            <div className="markdown-import-preview">
              <span>将恢复的书籍</span>
              <strong>{restoreBooks.slice(0, 3).map((book) => book.book.title).join('、')}{restoreBooks.length > 3 ? ` 等 ${restoreBooks.length} 本` : ''}</strong>
              <p>现有书籍和工作区不会被修改或删除。</p>
            </div>
            <div className="markdown-import-dialog-actions">
              <button type="button" disabled={isWorking} onClick={() => setPendingRestore(null)}>取消</button>
              <button type="button" className="is-primary" disabled={isWorking} onClick={() => void confirmRestore()}>
                {isWorking ? status || '正在恢复...' : '确认恢复'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
