import { useState } from 'react'
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Plus,
  Quote,
  BookOpen,
  FolderOpen,
  Folder,
  Pencil,
  Trash2,
  LayoutTemplate
} from 'lucide-react'
import { useLibraryStore } from '../../stores/useLibraryStore'
import { useUIStore } from '../../stores/useUIStore'

export function ResourceDrawer() {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ g1: true })
  
  // Inline edit state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [editingBookAuthorId, setEditingBookAuthorId] = useState<string | null>(null)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null)
  const [hoveredQuoteId, setHoveredQuoteId] = useState<string | null>(null)
  const [pendingDeleteQuoteId, setPendingDeleteQuoteId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const { 
    groups, 
    books, 
    quotes, 
    addGroup, 
    addBook, 
    updateGroup, 
    updateBook,
    updateBookAuthor,
    deleteGroup,
    deleteBook,
    deleteQuote,
    selectedBookId,
    selectedQuoteId,
    selectBook,
    loadQuoteWorkspace
  } = useLibraryStore()
  const { resourceDrawerView: viewMode, setResourceDrawerView } = useUIStore()

  const currentBook = books.find((book) => book.id === selectedBookId) || books[0] || null
  const currentQuote = selectedQuoteId
    ? quotes.find((quote) => quote.id === selectedQuoteId) || null
    : currentBook
      ? quotes.find((quote) => quote.bookId === currentBook.id && quote.status === 'pending') || quotes.find((quote) => quote.bookId === currentBook.id) || null
      : null
  const currentBookQuotes = currentBook ? quotes.filter((quote) => quote.bookId === currentBook.id) : []
  const pendingQuoteCount = currentBookQuotes.filter((quote) => quote.status === 'pending').length
  const extractedQuoteCount = currentBookQuotes.filter((quote) => quote.status === 'extracted').length

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  // Handle Create Group
  const handleCreateGroup = async () => {
    try {
      const newGroup = await addGroup('新分组')
      setEditingGroupId(newGroup.id)
      setEditValue('新分组')
    } catch (error) {
      console.warn('Failed to create group.', error)
      alert('创建分组失败，请稍后再试。')
    }
  }

  // Handle Create Book
  const handleCreateBook = async (groupId?: string) => {
    const targetGroupId = groupId || (groups.length > 0 ? groups[0].id : null)
    if (!targetGroupId) {
      alert('请先创建一个分组！')
      return
    }

    if (!expandedGroups[targetGroupId]) {
      toggleGroup(targetGroupId)
    }

    try {
      const newBook = await addBook(targetGroupId, '《新书籍》')
      setEditingBookId(newBook.id)
      setEditValue('《新书籍》')
    } catch (error) {
      console.warn('Failed to create book.', error)
      alert('创建书籍失败，请稍后再试。')
    }
  }

  // Handle Edit Book
  const handleEditBook = (e: React.MouseEvent, bookId: string, oldTitle: string) => {
    e.stopPropagation()
    setEditingBookId(bookId)
    setEditValue(oldTitle)
  }

  const handleSaveBook = async (bookId: string) => {
    let finalTitle = editValue.trim()
    if (finalTitle) {
      if (!finalTitle.startsWith('《')) finalTitle = '《' + finalTitle
      if (!finalTitle.endsWith('》')) finalTitle = finalTitle + '》'
      try {
        await updateBook(bookId, finalTitle)
      } catch (error) {
        console.warn('Failed to update book title.', error)
        alert('修改书名失败，请稍后再试。')
        return
      }
    }
    setEditingBookId(null)
  }

  const handleBookKeyDown = (e: React.KeyboardEvent, bookId: string) => {
    if (e.key === 'Enter') void handleSaveBook(bookId)
    if (e.key === 'Escape') setEditingBookId(null)
  }

  const handleDeleteBook = async (e: React.MouseEvent, bookId: string, title: string) => {
    e.stopPropagation()
    if (window.confirm(`确定要删除《${title}》吗？这将会删除相关的金句和笔记。`)) {
      try {
        await deleteBook(bookId)
      } catch (error) {
        console.warn('Failed to delete book.', error)
        alert('删除书籍失败，请稍后再试。')
      }
    }
  }

  // Handle Edit Book Author
  const handleEditBookAuthor = (e: React.MouseEvent, bookId: string, oldAuthor: string) => {
    e.stopPropagation()
    setEditingBookAuthorId(bookId)
    setEditValue(oldAuthor)
  }

  const handleSaveBookAuthor = async (bookId: string) => {
    if (editValue.trim()) {
      try {
        await updateBookAuthor(bookId, editValue.trim())
      } catch (error) {
        console.warn('Failed to update book author.', error)
        alert('修改作者失败，请稍后再试。')
        return
      }
    }
    setEditingBookAuthorId(null)
  }

  const handleBookAuthorKeyDown = (e: React.KeyboardEvent, bookId: string) => {
    if (e.key === 'Enter') void handleSaveBookAuthor(bookId)
    if (e.key === 'Escape') setEditingBookAuthorId(null)
  }

  // Handle Edit Group
  const handleEditGroup = (e: React.MouseEvent, groupId: string, oldName: string) => {
    e.stopPropagation()
    setEditingGroupId(groupId)
    setEditValue(oldName)
  }

  const handleSaveGroup = async (groupId: string) => {
    if (editValue.trim()) {
      try {
        await updateGroup(groupId, editValue.trim())
      } catch (error) {
        console.warn('Failed to update group.', error)
        alert('修改分组失败，请稍后再试。')
        return
      }
    }
    setEditingGroupId(null)
  }

  const handleGroupKeyDown = (e: React.KeyboardEvent, groupId: string) => {
    if (e.key === 'Enter') void handleSaveGroup(groupId)
    if (e.key === 'Escape') setEditingGroupId(null)
  }

  const handleDeleteGroup = async (e: React.MouseEvent, groupId: string, name: string) => {
    e.stopPropagation()
    if (window.confirm(`确定要删除分组 [${name}] 吗？分组下的所有书籍也会被一并删除！`)) {
      try {
        await deleteGroup(groupId)
      } catch (error) {
        console.warn('Failed to delete group.', error)
        alert('删除分组失败，请稍后再试。')
      }
    }
  }

  const handleRequestDeleteQuote = (e: React.MouseEvent, quoteId: string) => {
    e.stopPropagation()
    setPendingDeleteQuoteId(quoteId)
  }

  const handleConfirmDeleteQuote = async (e: React.MouseEvent, quoteId: string) => {
    e.stopPropagation()
    try {
      await deleteQuote(quoteId)
      setPendingDeleteQuoteId(null)
      setHoveredQuoteId(null)
    } catch (error) {
      console.warn('Failed to delete quote.', error)
      alert('删除金句失败，请稍后再试。')
    }
  }

  const handleCancelDeleteQuote = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDeleteQuoteId(null)
  }

  return (
    <aside className="secondary-panel" style={{ width: '320px', height: '100%' }}>
      {/* Top Switch Area */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', background: 'var(--bg-dark)', borderRadius: '6px', padding: '4px' }}>
          <button 
            type="button"
            className="text-btn" 
            style={{ 
              flex: 1, 
              padding: '6px', 
              borderRadius: '4px',
              background: viewMode === 'books' ? 'var(--bg-panel)' : 'transparent',
              color: viewMode === 'books' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: viewMode === 'books' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.2s'
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              setResourceDrawerView('books')
            }}
          >
            <BookOpen size={14} style={{ marginRight: 6 }} /> 书籍视角
          </button>
          <button 
            type="button"
            className="text-btn" 
            style={{ 
              flex: 1, 
              padding: '6px', 
              borderRadius: '4px',
              background: viewMode === 'quotes' ? 'var(--bg-panel)' : 'transparent',
              color: viewMode === 'quotes' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: viewMode === 'quotes' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.2s'
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              setResourceDrawerView('quotes')
            }}
          >
            <Quote size={14} style={{ marginRight: 6 }} /> 金句视角
          </button>
        </div>
      </div>
      
      {/* Middle Content Area */}
      <div className="panel-content" style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <div className="search-box" style={{ marginBottom: '16px' }}>
          <Search size={16} />
          <input type="text" placeholder={viewMode === 'books' ? "搜索分组、书名、作者..." : "搜索金句内容、标签..."} />
        </div>

        {viewMode === 'books' && (
          <div className="books-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {groups.map(group => (
              <div key={group.id} className="group-section">
                <div 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px 0', color: 'var(--text-muted)' }}
                  onClick={() => toggleGroup(group.id)}
                  onMouseEnter={() => setHoveredGroupId(group.id)}
                  onMouseLeave={() => setHoveredGroupId(null)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, flex: 1, minWidth: 0 }}>
                    {expandedGroups[group.id] ? <ChevronDown size={14} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} style={{ flexShrink: 0 }} />}
                    <FolderOpen size={14} style={{ flexShrink: 0 }} /> 
                    {editingGroupId === group.id ? (
                      <input 
                        type="text" 
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveGroup(group.id)}
                        onKeyDown={(e) => handleGroupKeyDown(e, group.id)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        style={{
                          background: 'var(--bg-dark)',
                          border: '1px solid var(--accent-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          fontSize: '13px',
                          width: '120px',
                          outline: 'none'
                        }}
                      />
                    ) : (
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.name}</span>
                    )}
                  </div>
                  {!editingGroupId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, minHeight: '20px' }}>
                      {hoveredGroupId === group.id ? (
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button className="icon-btn" style={{ padding: '2px' }} onClick={(e) => handleEditGroup(e, group.id, group.name)} title="重命名分组">
                            <Pencil size={12} />
                          </button>
                          <button className="icon-btn" style={{ padding: '2px', color: 'var(--error-color, #ef4444)' }} onClick={(e) => handleDeleteGroup(e, group.id, group.name)} title="删除分组">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px' }}>{group.bookCount}</span>
                      )}
                    </div>
                  )}
                </div>
                
                {expandedGroups[group.id] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', paddingLeft: '12px' }}>
                    {books.filter(b => b.groupId === group.id).map(book => (
                      <div 
                        key={book.id} 
                        className={`book-card ${currentBook && book.id === currentBook.id ? 'active' : ''}`}
                        style={{ display: 'flex', gap: '12px', padding: '8px', cursor: 'pointer', alignItems: 'center' }}
                        onClick={() => selectBook(book.id)}
                        onMouseEnter={() => setHoveredBookId(book.id)}
                        onMouseLeave={() => setHoveredBookId(null)}
                      >
                        <div style={{ width: '32px', height: '44px', background: book.color, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <BookOpen size={16} color="rgba(255,255,255,0.2)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editingBookId === book.id ? (
                            <input 
                              type="text" 
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveBook(book.id)}
                              onKeyDown={(e) => handleBookKeyDown(e, book.id)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              style={{
                                background: 'var(--bg-dark)',
                                border: '1px solid var(--accent-color)',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                padding: '2px 4px',
                                fontSize: '13px',
                                width: '100%',
                                outline: 'none'
                              }}
                            />
                          ) : (
                            <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</div>
                          )}
                          
                          {editingBookAuthorId === book.id ? (
                            <input 
                              type="text" 
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveBookAuthor(book.id)}
                              onKeyDown={(e) => handleBookAuthorKeyDown(e, book.id)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              style={{
                                background: 'var(--bg-dark)',
                                border: '1px solid var(--accent-color)',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                padding: '2px 4px',
                                fontSize: '11px',
                                width: '100%',
                                marginTop: '2px',
                                outline: 'none'
                              }}
                            />
                          ) : (
                            <div 
                              style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}
                              onClick={(e) => handleEditBookAuthor(e, book.id, book.author)}
                              title="点击修改作者"
                            >
                              {book.author}
                            </div>
                          )}

                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                            <span>金句 {book.quotesCount}</span>
                            <span>已提炼 {book.extractedCount}</span>
                          </div>
                        </div>
                        {!editingBookId && hoveredBookId === book.id && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                            <button className="icon-btn" style={{ padding: '4px' }} onClick={(e) => handleEditBook(e, book.id, book.title)} title="修改书名">
                              <Pencil size={12} />
                            </button>
                            <button className="icon-btn" style={{ padding: '4px', color: 'var(--error-color, #ef4444)' }} onClick={(e) => handleDeleteBook(e, book.id, book.title)} title="删除书籍">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    <button 
                      className="text-btn" 
                      style={{ justifyContent: 'flex-start', padding: '4px 8px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}
                      onClick={() => handleCreateBook(group.id)}
                    >
                      <Plus size={12} style={{ marginRight: '4px' }} /> 添加书籍
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'quotes' && (
          <div className="quotes-view" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                {currentBook ? `${currentBook.title} 的金句 (${currentBookQuotes.length})` : '金句视角'}
              </span>
              <button className="icon-btn" style={{ padding: 2 }}><Filter size={14} /></button>
            </div>
            
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '4px' }} className="hide-scrollbar">
              <span className="tag" style={{ background: 'var(--bg-hover)' }}>未提炼 ({pendingQuoteCount})</span>
              <span className="tag" style={{ background: 'rgba(45, 212, 191, 0.1)', color: 'var(--accent-color)' }}>已完成 ({extractedQuoteCount})</span>
              <span className="tag">收藏</span>
            </div>

            {currentBookQuotes.map((quote) => (
              (() => {
                const isExtracted = quote.status === 'extracted'
                const deleteAccent = isExtracted ? '#f59e0b' : '#ef4444'
                const deleteBackground = isExtracted ? 'rgba(245, 158, 11, 0.14)' : 'rgba(239, 68, 68, 0.14)'
                const deleteBorder = isExtracted ? 'rgba(245, 158, 11, 0.28)' : 'rgba(239, 68, 68, 0.28)'
                const deleteLabel = isExtracted ? '删除已提炼' : '删除待处理'
                const confirmText = isExtracted ? '确认删除这条已提炼金句？' : '确认删除这条待处理金句？'

                return (
              <div 
                className={`book-card ${currentQuote && quote.id === currentQuote.id ? 'active' : ''}`} 
                key={quote.id} 
                onClick={() => {
                  loadQuoteWorkspace(quote.id).catch((error) => {
                    console.warn('Failed to load quote workspace.', error)
                  })
                }}
                style={{ 
                  padding: '12px', 
                  cursor: 'pointer', 
                  position: 'relative',
                  border: currentQuote && quote.id === currentQuote.id ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                  background: currentQuote && quote.id === currentQuote.id ? 'rgba(45, 212, 191, 0.05)' : 'var(--bg-dark)',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={() => setHoveredQuoteId(quote.id)}
                onMouseLeave={() => {
                  setHoveredQuoteId(null)
                  if (pendingDeleteQuoteId === quote.id) {
                    setPendingDeleteQuoteId(null)
                  }
                }}
              >
                {hoveredQuoteId === quote.id && pendingDeleteQuoteId !== quote.id && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        height: '22px',
                        padding: '0 8px',
                        borderRadius: '999px',
                        border: `1px solid ${deleteBorder}`,
                        background: deleteBackground,
                        color: deleteAccent,
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '11px',
                        fontWeight: 600
                      }}
                    >
                      {deleteLabel}
                    </span>
                    <button
                      className="icon-btn"
                      style={{
                        width: '24px',
                        height: '24px',
                        padding: 0,
                        color: deleteAccent,
                        border: `1px solid ${deleteBorder}`,
                        background: deleteBackground
                      }}
                      onClick={(event) => handleRequestDeleteQuote(event, quote.id)}
                      title={deleteLabel}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                {pendingDeleteQuoteId === quote.id && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      zIndex: 3,
                      width: '196px',
                      borderRadius: '10px',
                      border: `1px solid ${deleteBorder}`,
                      background: 'rgba(9, 11, 16, 0.96)',
                      boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
                      padding: '10px'
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: deleteAccent, marginBottom: '6px' }}>
                      {confirmText}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '10px' }}>
                      {isExtracted ? '删除后对应提炼结果也会一起移除。' : '删除后这条待处理金句将不再保留。'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={handleCancelDeleteQuote}
                        style={{ fontSize: '11px' }}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleConfirmDeleteQuote(event, quote.id)}
                        style={{
                          minHeight: '26px',
                          padding: '0 10px',
                          borderRadius: '999px',
                          border: `1px solid ${deleteBorder}`,
                          background: deleteBackground,
                          color: deleteAccent,
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        确认删除
                      </button>
                    </div>
                  </div>
                )}
                <div className="book-info" style={{ width: '100%' }}>
                  {quote.treeSnapshot && (
                    <div
                      style={{
                        marginBottom: '7px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: 700,
                        lineHeight: 1.35,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {quote.treeTitle || '未命名主题'}
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '13px', 
                    lineHeight: '1.5',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    whiteSpace: 'normal',
                    color: quote.status === 'extracted' ? 'var(--text-muted)' : 'var(--text-primary)'
                  }}>
                    "{quote.text}"
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {quote.tags.map(tag => (
                        <span key={tag} style={{ fontSize: '10px', background: 'var(--bg-dark)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>{tag}</span>
                      ))}
                      {quote.treeSnapshot && (
                        <span style={{ fontSize: '10px', background: 'rgba(45, 212, 191, 0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent-color)' }}>
                          树 {quote.nodeCount ?? 0}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: quote.status === 'extracted' ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                      {quote.status === 'extracted' ? '已提炼' : '待处理'}
                    </span>
                  </div>
                </div>
                {currentQuote && quote.id === currentQuote.id && <div className="active-dot" style={{ top: '50%', transform: 'translateY(-50%)' }} />}
              </div>
                )
              })()
            ))}
          </div>
        )}
      </div>

      {/* Bottom Action Area */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-panel)' }}>
        {viewMode === 'books' ? (
          <>
            <button className="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleCreateBook()}>
              <Plus size={14} /> 新建书籍
            </button>
            <button className="text-btn" style={{ width: '100%', justifyContent: 'center', color: 'var(--text-muted)' }} onClick={handleCreateGroup}>
              <Folder size={14} /> 新建分组
            </button>
          </>
        ) : (
          <>
            <button className="primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Plus size={14} /> 导入金句
            </button>
            <button className="text-btn" style={{ width: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <LayoutTemplate size={14} /> 批量操作
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
