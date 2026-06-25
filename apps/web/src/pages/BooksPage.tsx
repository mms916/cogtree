import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Plus, BookOpen, MoreVertical, Settings2, Clock, ImagePlus } from 'lucide-react'
import { readImageFile } from '../modules/canvas/imageAttachments'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useUIStore } from '../stores/useUIStore'

const fallbackCoverColors = ['#090b10', '#1a1010', '#1f1308', '#170f1c', '#1a1808']

export function BooksPage() {
  const navigate = useNavigate()
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const [coverTargetBookId, setCoverTargetBookId] = useState<string | null>(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const { books, loadLibraryFromApi, selectBook, updateBookCover } = useLibraryStore()
  const { openResourceDrawer, setResourceDrawerView } = useUIStore()

  useEffect(() => {
    loadLibraryFromApi().catch((error) => {
      console.warn('Failed to load books page library.', error)
    })
  }, [loadLibraryFromApi])

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

  return (
    <div className="workspace-area" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={handleCoverChange}
      />

      <header className="top-bar">
        <div className="breadcrumbs">
          <span className="current">我的书籍库</span>
        </div>

        <div className="top-bar-actions">
          <div className="search-box" style={{ width: 280, marginRight: 16 }}>
            <Search size={16} />
            <input type="text" placeholder="搜索书名、作者..." />
          </div>
          <button className="icon-btn"><Filter size={16} /></button>
          <button className="icon-btn"><Settings2 size={16} /></button>
          <button className="primary"><Plus size={16} /> 导入书籍</button>
        </div>
      </header>

      <div style={{ padding: '32px 48px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              全部书籍
            </h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              共 {books.length} 本书籍正在阅读与整理中
            </p>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <button className="text-btn" style={{ color: 'var(--text-muted)' }}>
              <Clock size={14} /> 最近阅读
            </button>
          </div>
        </div>

        <div className="books-grid">
          {books.map((book, index) => (
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

                <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>
                  {book.extractedCount} 已提炼
                </div>
              </div>

              <div className="book-grid-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 className="book-grid-title">{book.title}</h3>
                  <button
                    className="icon-btn"
                    style={{ padding: 2, margin: '-4px -4px 0 0' }}
                    onClick={(event) => startCoverUpload(book.id, event)}
                    title="更换封面"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
                <p className="book-grid-author">{book.author}</p>

                <div className="book-grid-stats">
                  <span>{book.quotesCount} 条金句</span>
                  <span style={{ margin: '0 8px', color: 'var(--border-color)' }}>|</span>
                  <span>{book.extractedCount} 条已提炼</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
