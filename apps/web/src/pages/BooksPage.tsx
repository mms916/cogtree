import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ArchiveRestore,
  Check,
  Clock,
  Filter,
  FolderOpen,
  ImagePlus,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  DatabaseBackup,
  X,
} from 'lucide-react'

import { fetchJson } from '../lib/api'
import { createQuoteWorkspaceBackup, downloadBookBackup, parseBookBackup } from '../lib/workspaceBackup'
import type { BookBackup } from '../lib/workspaceBackup'
import { readImageFile } from '../modules/canvas/imageAttachments'
import type { Book, QuoteItem } from '../stores/useLibraryStore'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useUIStore } from '../stores/useUIStore'

const fallbackCoverColors = ['#090b10', '#1a1010', '#1f1308', '#170f1c', '#1a1808']

type BookGroupView = 'all' | 'grouped' | string
type BooksDialogMode = 'create-book' | 'edit-book' | 'create-group' | 'rename-group' | 'delete-book' | 'delete-group'
type BooksDialogState = {
  mode: BooksDialogMode
  book?: Book
  group?: { id: string; name: string }
}

export function BooksPage() {
  const navigate = useNavigate()
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const bookBackupInputRef = useRef<HTMLInputElement | null>(null)
  const groupMenuRef = useRef<HTMLDivElement | null>(null)
  const [coverTargetBookId, setCoverTargetBookId] = useState<string | null>(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<BookGroupView>('all')
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false)
  const [bookActionMenuId, setBookActionMenuId] = useState<string | null>(null)
  const [dialogState, setDialogState] = useState<BooksDialogState | null>(null)
  const [dialogBookTitle, setDialogBookTitle] = useState('')
  const [dialogBookAuthor, setDialogBookAuthor] = useState('')
  const [dialogGroupName, setDialogGroupName] = useState('')
  const [isDialogSubmitting, setIsDialogSubmitting] = useState(false)
  const [pendingBookRestore, setPendingBookRestore] = useState<BookBackup | null>(null)
  const [bookBackupStatus, setBookBackupStatus] = useState('')
  const {
    groups,
    books,
    quotes,
    loadLibraryFromApi,
    selectBook,
    addGroup,
    updateGroup,
    deleteGroup,
    addBook,
    updateBook,
    updateBookAuthor,
    deleteBook,
    updateBookCover,
    saveQuoteWorkspace,
  } = useLibraryStore()
  const { openResourceDrawer, setResourceDrawerView } = useUIStore()

  useEffect(() => {
    loadLibraryFromApi().catch((error) => {
      console.warn('Failed to load books page library.', error)
    })
  }, [loadLibraryFromApi])

  useEffect(() => {
    if (selectedGroupId === 'all' || selectedGroupId === 'grouped') return
    if (groups.some((group) => group.id === selectedGroupId)) return
    setSelectedGroupId('all')
  }, [groups, selectedGroupId])

  useEffect(() => {
    if (!isGroupMenuOpen) return

    const closeMenu = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && groupMenuRef.current?.contains(target)) return
      setIsGroupMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [isGroupMenuOpen])

  useEffect(() => {
    if (!bookActionMenuId) return

    const closeMenu = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.book-card-action-menu') || target?.closest('[data-book-action-trigger="true"]')) return
      setBookActionMenuId(null)
    }

    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [bookActionMenuId])

  const selectedGroup = selectedGroupId === 'all' || selectedGroupId === 'grouped'
    ? null
    : groups.find((group) => group.id === selectedGroupId) ?? null

  const visibleBooks = useMemo(
    () => selectedGroupId === 'all' || selectedGroupId === 'grouped'
      ? books
      : books.filter((book) => book.groupId === selectedGroupId),
    [books, selectedGroupId]
  )

  const groupBookCounts = useMemo(() => {
    const counts = new Map<string, number>()
    books.forEach((book) => {
      counts.set(book.groupId, (counts.get(book.groupId) ?? 0) + 1)
    })
    return counts
  }, [books])

  const groupedBooks = useMemo(() => {
    const knownGroupIds = new Set(groups.map((group) => group.id))
    const sections = groups.map((group) => ({
      id: group.id,
      name: group.name,
      books: books.filter((book) => book.groupId === group.id),
    }))
    const ungroupedBooks = books.filter((book) => !knownGroupIds.has(book.groupId))
    return ungroupedBooks.length > 0
      ? [...sections, { id: 'ungrouped', name: '未分组', books: ungroupedBooks }]
      : sections
  }, [books, groups])

  const pageTitle = selectedGroupId === 'grouped'
    ? '分组书籍'
    : selectedGroup
      ? selectedGroup.name
      : '全部书籍'

  const menuLabel = selectedGroupId === 'grouped'
    ? '分组展示'
    : selectedGroup
      ? `${selectedGroup.name} (${visibleBooks.length})`
      : `全部书籍 (${books.length})`

  const openBook = (bookId: string) => {
    selectBook(bookId)
    setResourceDrawerView('quotes')
    openResourceDrawer()
    navigate('/app/quotes')
  }

  const startCoverUpload = (bookId: string, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setCoverTargetBookId(bookId)
    coverInputRef.current?.click()
  }

  const handleCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const bookId = coverTargetBookId
    event.target.value = ''

    if (!file || !bookId) return

    setIsUploadingCover(true)
    try {
      const image = await readImageFile(file)
      await updateBookCover(bookId, image.src)
    } catch (error) {
      console.warn('Failed to update book cover.', error)
    } finally {
      setIsUploadingCover(false)
      setCoverTargetBookId(null)
    }
  }

  const chooseGroupView = (groupId: BookGroupView) => {
    setSelectedGroupId(groupId)
    setIsGroupMenuOpen(false)
  }

  const normalizeBookTitle = (title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('《') && trimmed.endsWith('》')) return trimmed
    return `《${trimmed.replace(/^《/, '').replace(/》$/, '')}》`
  }

  const closeDialog = () => {
    if (isDialogSubmitting) return
    setDialogState(null)
    setDialogBookTitle('')
    setDialogBookAuthor('')
    setDialogGroupName('')
  }

  const handleCreateGroup = () => {
    setDialogGroupName('新分组')
    setIsGroupMenuOpen(false)
    setDialogState({ mode: 'create-group' })
  }

  const handleRenameSelectedGroup = () => {
    if (!selectedGroup) return
    setDialogGroupName(selectedGroup.name)
    setIsGroupMenuOpen(false)
    setDialogState({ mode: 'rename-group', group: selectedGroup })
  }

  const handleDeleteSelectedGroup = () => {
    if (!selectedGroup) return
    setIsGroupMenuOpen(false)
    setDialogState({ mode: 'delete-group', group: selectedGroup })
  }

  const handleCreateBook = () => {
    setDialogBookTitle('新书籍')
    setDialogBookAuthor('')
    setDialogState({ mode: 'create-book' })
  }

  const handleRenameBook = (book: Book, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setBookActionMenuId(null)
    setDialogBookTitle(book.title)
    setDialogBookAuthor(book.author === '未知作者' ? '' : book.author)
    setDialogState({ mode: 'edit-book', book })
  }

  const handleDeleteBook = (book: Book, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setBookActionMenuId(null)
    setDialogState({ mode: 'delete-book', book })
  }

  const handleExportBookBackup = async (book: Book, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setBookActionMenuId(null)
    setBookBackupStatus('正在读取书籍工作区...')

    try {
      const bookQuotes = quotes.filter((quote) => quote.bookId === book.id)
      const workspaces = []
      for (let index = 0; index < bookQuotes.length; index += 1) {
        setBookBackupStatus(`正在打包 ${index + 1} / ${bookQuotes.length}`)
        const summary = bookQuotes[index]
        const response = await fetchJson<{ success: true; data: QuoteItem }>(`/quote-workspaces/${summary.id}`)
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

      downloadBookBackup({
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
      })
      setBookBackupStatus('')
    } catch (error) {
      setBookBackupStatus(error instanceof Error ? error.message : '整书备份失败。')
    }
  }

  const handleBookBackupFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setPendingBookRestore(parseBookBackup(await file.text()))
      setBookBackupStatus('')
    } catch (error) {
      setPendingBookRestore(null)
      setBookBackupStatus(error instanceof Error ? error.message : '无法读取整书备份。')
    }
  }

  const confirmBookRestore = async () => {
    if (!pendingBookRestore) return
    setIsDialogSubmitting(true)
    try {
      let targetGroupId = selectedGroup?.id ?? groups[0]?.id ?? null
      if (!targetGroupId) {
        targetGroupId = (await addGroup('恢复的书籍')).id
      }
      const restoredBook = await addBook(targetGroupId, `${pendingBookRestore.book.title}（恢复）`)
      if (pendingBookRestore.book.author) {
        await updateBookAuthor(restoredBook.id, pendingBookRestore.book.author)
      }
      if (pendingBookRestore.book.coverUrl) {
        await updateBookCover(restoredBook.id, pendingBookRestore.book.coverUrl)
      }
      for (let index = 0; index < pendingBookRestore.workspaces.length; index += 1) {
        setBookBackupStatus(`正在恢复 ${index + 1} / ${pendingBookRestore.workspaces.length}`)
        const workspace = pendingBookRestore.workspaces[index].workspace
        await saveQuoteWorkspace({
          bookId: restoredBook.id,
          text: workspace.text,
          nodes: workspace.nodes,
          rootNodeIds: workspace.rootNodeIds,
          treeTitle: workspace.title,
          workspaceKeywords: workspace.keywords,
        })
      }
      setSelectedGroupId(targetGroupId)
      setPendingBookRestore(null)
      setBookBackupStatus('')
    } catch (error) {
      setBookBackupStatus(error instanceof Error ? error.message : '恢复整书备份失败。')
    } finally {
      setIsDialogSubmitting(false)
    }
  }

  const submitDialog = async () => {
    if (!dialogState) return

    setIsDialogSubmitting(true)
    try {
      if (dialogState.mode === 'create-group') {
        const name = dialogGroupName.trim()
        if (!name) return
        const newGroup = await addGroup(name)
        setSelectedGroupId(newGroup.id)
        setIsGroupMenuOpen(false)
      }

      if (dialogState.mode === 'rename-group' && dialogState.group) {
        const name = dialogGroupName.trim()
        if (!name || name === dialogState.group.name) return
        await updateGroup(dialogState.group.id, name)
      }

      if (dialogState.mode === 'delete-group' && dialogState.group) {
        await deleteGroup(dialogState.group.id)
        setSelectedGroupId('all')
        setIsGroupMenuOpen(false)
      }

      if (dialogState.mode === 'create-book') {
        let targetGroupId = selectedGroup?.id ?? groups[0]?.id ?? null
        if (!targetGroupId) {
          const newGroup = await addGroup('默认分组')
          targetGroupId = newGroup.id
        }

        const title = normalizeBookTitle(dialogBookTitle)
        if (!title) return
        const newBook = await addBook(targetGroupId, title)
        const author = dialogBookAuthor.trim()
        if (author) await updateBookAuthor(newBook.id, author)
        setSelectedGroupId(targetGroupId)
      }

      if (dialogState.mode === 'edit-book' && dialogState.book) {
        const title = normalizeBookTitle(dialogBookTitle)
        if (!title) return
        const author = dialogBookAuthor.trim() || '未知作者'
        if (title !== dialogState.book.title) await updateBook(dialogState.book.id, title)
        if (author !== dialogState.book.author) await updateBookAuthor(dialogState.book.id, author)
      }

      if (dialogState.mode === 'delete-book' && dialogState.book) {
        await deleteBook(dialogState.book.id)
      }

      setDialogState(null)
      setDialogBookTitle('')
      setDialogBookAuthor('')
      setDialogGroupName('')
    } catch (error) {
      console.warn('Failed to submit books dialog.', error)
    } finally {
      setIsDialogSubmitting(false)
    }
  }

  const toggleBookActionMenu = (bookId: string, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setBookActionMenuId((current) => (current === bookId ? null : bookId))
  }

  const isDeleteDialog = dialogState?.mode === 'delete-book' || dialogState?.mode === 'delete-group'
  const dialogTitle = dialogState?.mode === 'create-book'
    ? '新增书籍'
    : dialogState?.mode === 'edit-book'
      ? '编辑书籍'
      : dialogState?.mode === 'create-group'
        ? '新增分组'
        : dialogState?.mode === 'rename-group'
          ? '重命名分组'
          : dialogState?.mode === 'delete-group'
            ? '删除分组'
            : '删除书籍'

  const dialogDescription = dialogState?.mode === 'create-book'
    ? '添加一本书籍到当前分组，后续可在金句视角继续整理内容。'
    : dialogState?.mode === 'edit-book'
      ? '调整书籍的标题和作者信息。'
      : dialogState?.mode === 'create-group'
        ? '新分组会同步出现在金句页的书籍视角中。'
        : dialogState?.mode === 'rename-group'
          ? '分组名称会同步更新到书籍页和金句页。'
          : dialogState?.mode === 'delete-group'
            ? `确定删除「${dialogState.group?.name ?? ''}」吗？该分组下的 ${dialogState.group ? groupBookCounts.get(dialogState.group.id) ?? 0 : 0} 本书籍也会一起删除。`
            : `确定删除${dialogState?.book?.title ?? ''}吗？相关金句和笔记也会一起删除。`

  const isDialogSubmitDisabled = isDialogSubmitting
    || (dialogState?.mode === 'create-book' && !dialogBookTitle.trim())
    || (dialogState?.mode === 'edit-book' && !dialogBookTitle.trim())
    || (dialogState?.mode === 'create-group' && !dialogGroupName.trim())
    || (dialogState?.mode === 'rename-group' && !dialogGroupName.trim())

  const renderBookCard = (book: Book, index: number) => (
    <div
      key={book.id}
      className="book-grid-card"
      onClick={() => openBook(book.id)}
    >
      <div
        className="book-grid-cover"
        style={{ backgroundColor: book.color || fallbackCoverColors[index % fallbackCoverColors.length] }}
      >
        {book.coverUrl ? (
          <img className="book-grid-cover-image" src={book.coverUrl} alt={`${book.title} 封面`} />
        ) : (
          <>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
              }}
            />
            <BookOpen size={48} color="rgba(255, 255, 255, 0.1)" />
          </>
        )}

        <button
          className="book-cover-upload-btn"
          disabled={isUploadingCover && coverTargetBookId === book.id}
          onClick={(event) => startCoverUpload(book.id, event)}
        >
          <ImagePlus size={14} />
          {book.coverUrl ? '更换封面' : '添加封面'}
        </button>

        <div className="book-grid-cover-count">
          {book.extractedCount} 已提炼
        </div>
      </div>

      <div className="book-grid-info">
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 className="book-grid-title">{book.title}</h3>
          <button
            className="icon-btn"
            style={{ padding: 2, margin: '-4px -4px 0 0' }}
            onClick={(event) => toggleBookActionMenu(book.id, event)}
            aria-label="书籍操作"
            aria-expanded={bookActionMenuId === book.id}
            data-book-action-trigger="true"
            title="书籍操作"
          >
            <MoreVertical size={14} />
          </button>
          {bookActionMenuId === book.id && (
            <div className="book-card-action-menu">
              <button type="button" onClick={(event) => handleRenameBook(book, event)}>
                <Pencil size={14} />
                重命名
              </button>
              <button type="button" onClick={(event) => startCoverUpload(book.id, event)}>
                <ImagePlus size={14} />
                更换封面
              </button>
              <button type="button" onClick={(event) => void handleExportBookBackup(book, event)}>
                <DatabaseBackup size={14} />
                导出整书备份
              </button>
              <button type="button" className="is-danger" onClick={(event) => handleDeleteBook(book, event)}>
                <Trash2 size={14} />
                删除书籍
              </button>
            </div>
          )}
        </div>
        <p className="book-grid-author">{book.author}</p>

        <div className="book-grid-stats">
          <span>{book.quotesCount} 条金句</span>
          <span style={{ margin: '0 8px', color: 'var(--border-color)' }}>|</span>
          <span>{book.extractedCount} 条已提炼</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="workspace-area" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={handleCoverChange}
      />
      <input
        ref={bookBackupInputRef}
        type="file"
        accept=".json,application/json"
        className="visually-hidden"
        onChange={handleBookBackupFile}
      />

      {(pendingBookRestore || bookBackupStatus) && (
        <div className="books-dialog-backdrop" role="presentation">
          <section className="books-dialog" role="dialog" aria-modal="true">
            <div className="books-dialog-head">
              <div>
                <strong>{pendingBookRestore ? '恢复整书备份' : '整书备份'}</strong>
                <p>{pendingBookRestore?.book.title ?? bookBackupStatus}</p>
              </div>
              <button type="button" disabled={isDialogSubmitting} onClick={() => {
                setPendingBookRestore(null)
                setBookBackupStatus('')
              }}><X size={18} /></button>
            </div>
            {pendingBookRestore && (
              <div className="markdown-import-stats">
                <div><span>工作区</span><strong>{pendingBookRestore.workspaces.length}</strong></div>
                <div><span>作者</span><strong>{pendingBookRestore.book.author || '未知'}</strong></div>
              </div>
            )}
            {bookBackupStatus && <div className="markdown-import-warnings"><p>{bookBackupStatus}</p></div>}
            <div className="books-dialog-actions">
              <button type="button" disabled={isDialogSubmitting} onClick={() => {
                setPendingBookRestore(null)
                setBookBackupStatus('')
              }}>取消</button>
              {pendingBookRestore && (
                <button type="button" className="is-primary" disabled={isDialogSubmitting} onClick={() => void confirmBookRestore()}>
                  {isDialogSubmitting ? '恢复中...' : '恢复为新书'}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {dialogState && (
        <div className="books-dialog-backdrop" role="presentation" onMouseDown={closeDialog}>
          <form
            className={`books-dialog${isDeleteDialog ? ' is-danger' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="books-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void submitDialog()
            }}
          >
            <div className="books-dialog-head">
              <div className="books-dialog-icon">
                {isDeleteDialog ? <Trash2 size={18} /> : dialogState.mode.includes('book') ? <BookOpen size={18} /> : <FolderOpen size={18} />}
              </div>
              <div>
                <h2 id="books-dialog-title">{dialogTitle}</h2>
                <p>{dialogDescription}</p>
              </div>
            </div>

            {!isDeleteDialog && (
              <div className="books-dialog-fields">
                {(dialogState.mode === 'create-book' || dialogState.mode === 'edit-book') && (
                  <>
                    <label>
                      <span>书籍名称</span>
                      <input
                        autoFocus
                        value={dialogBookTitle}
                        onChange={(event) => setDialogBookTitle(event.target.value)}
                        placeholder="请输入书籍名称"
                      />
                    </label>
                    <label>
                      <span>作者</span>
                      <input
                        value={dialogBookAuthor}
                        onChange={(event) => setDialogBookAuthor(event.target.value)}
                        placeholder="请输入作者，留空则为未知作者"
                      />
                    </label>
                  </>
                )}

                {(dialogState.mode === 'create-group' || dialogState.mode === 'rename-group') && (
                  <label>
                    <span>分组名称</span>
                    <input
                      autoFocus
                      value={dialogGroupName}
                      onChange={(event) => setDialogGroupName(event.target.value)}
                      placeholder="请输入分组名称"
                    />
                  </label>
                )}
              </div>
            )}

            <div className="books-dialog-actions">
              <button type="button" className="books-dialog-secondary" onClick={closeDialog} disabled={isDialogSubmitting}>
                取消
              </button>
              <button type="submit" className="books-dialog-primary" disabled={isDialogSubmitDisabled}>
                {isDialogSubmitting ? '处理中...' : isDeleteDialog ? '确认删除' : '确认'}
              </button>
            </div>
          </form>
        </div>
      )}

      <header className="top-bar">
        <div className="breadcrumbs">
          <span className="current">我的书籍库</span>
        </div>

        <div
          className="top-bar-actions"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('button.primary')) {
              void handleCreateBook()
            }
          }}
        >
          <div className="search-box" style={{ width: 280, marginRight: 16 }}>
            <Search size={16} />
            <input type="text" placeholder="搜索书名、作者..." />
          </div>
          <div className="books-group-menu-wrap" ref={groupMenuRef}>
            <button
              type="button"
              className={`icon-btn books-group-menu-trigger${isGroupMenuOpen ? ' is-active' : ''}`}
              title="书籍分组视图"
              aria-label="书籍分组视图"
              aria-expanded={isGroupMenuOpen}
              onClick={() => setIsGroupMenuOpen((current) => !current)}
            >
              <FolderOpen size={16} />
            </button>
            {isGroupMenuOpen && (
              <div className="books-group-menu">
                <div className="books-group-menu-title">书籍分组</div>
                <button
                  type="button"
                  className={selectedGroupId === 'all' ? 'is-active' : ''}
                  onClick={() => chooseGroupView('all')}
                >
                  <span><BookOpen size={14} /> 全部书籍</span>
                  <small>{books.length}</small>
                  {selectedGroupId === 'all' && <Check size={13} />}
                </button>
                <button
                  type="button"
                  className={selectedGroupId === 'grouped' ? 'is-active' : ''}
                  onClick={() => chooseGroupView('grouped')}
                >
                  <span><FolderOpen size={14} /> 分组展示</span>
                  <small>{groups.length}</small>
                  {selectedGroupId === 'grouped' && <Check size={13} />}
                </button>
                <div className="books-group-menu-separator" />
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={selectedGroupId === group.id ? 'is-active' : ''}
                    onClick={() => chooseGroupView(group.id)}
                  >
                    <span><FolderOpen size={14} /> {group.name}</span>
                    <small>{groupBookCounts.get(group.id) ?? 0}</small>
                    {selectedGroupId === group.id && <Check size={13} />}
                  </button>
                ))}
                <div className="books-group-menu-separator" />
                <div className="books-group-menu-actions">
                  <button type="button" onClick={handleCreateGroup}>
                    <span><Plus size={14} /> 新增分组</span>
                  </button>
                  {selectedGroup && (
                    <>
                      <button type="button" onClick={handleRenameSelectedGroup}>
                        <span><Pencil size={14} /> 重命名当前分组</span>
                      </button>
                      <button type="button" className="is-danger" onClick={handleDeleteSelectedGroup}>
                        <span><Trash2 size={14} /> 删除当前分组</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="icon-btn"><Filter size={16} /></button>
          <button className="icon-btn"><Settings2 size={16} /></button>
          <button className="icon-btn" title="恢复整书备份" onClick={() => bookBackupInputRef.current?.click()}>
            <ArchiveRestore size={16} />
          </button>
          <button className="primary"><Plus size={16} /> 新增书籍</button>
        </div>
      </header>

      <div style={{ padding: '32px 48px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: '32px' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {pageTitle}
            </h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {selectedGroupId === 'grouped'
                ? `共 ${books.length} 本书籍，按 ${groups.length} 个分组展示`
                : `共 ${visibleBooks.length} 本书籍正在阅读与整理中`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="books-active-view-pill">
              <FolderOpen size={14} />
              {menuLabel}
            </span>
            <button className="text-btn" style={{ color: 'var(--text-muted)' }}>
              <Clock size={14} /> 最近阅读
            </button>
          </div>
        </div>

        {selectedGroupId === 'grouped' ? (
          <div className="books-grouped-list">
            {groupedBooks.map((groupSection) => (
              <section key={groupSection.id} className="books-group-section">
                <div className="books-group-section-head">
                  <div>
                    <FolderOpen size={16} />
                    <strong>{groupSection.name}</strong>
                  </div>
                  <span>{groupSection.books.length} 本</span>
                </div>
                {groupSection.books.length > 0 ? (
                  <div className="books-grid">
                    {groupSection.books.map(renderBookCard)}
                  </div>
                ) : (
                  <div className="books-group-empty">这个分组还没有书籍</div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="books-grid">
            {visibleBooks.map(renderBookCard)}
          </div>
        )}
      </div>
    </div>
  )
}
