import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Clock3, FileText, GitBranch, MapPin, Quote, Search, Trash2 } from 'lucide-react'

import type { BaseNode, NodeKnowledgeItem } from '../stores/useDocumentStore'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useUIStore } from '../stores/useUIStore'

type SearchResultType = 'book' | 'quote' | 'node' | 'knowledge'

type SearchResult = {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  content: string
  bookId?: string
  quoteId?: string
  nodeId?: string
  knowledgeItemId?: string
}

type RecentSearchResult = SearchResult & {
  visitedAt: number
}

const RECENT_SEARCH_RESULTS_KEY = 'cogtree.recentSearchResults'
const RECENT_SEARCH_RESULTS_LIMIT = 20

const RESULT_TYPE_META: Record<SearchResultType, { label: string; icon: typeof Search }> = {
  book: { label: '书籍', icon: BookOpen },
  quote: { label: '金句', icon: Quote },
  node: { label: '节点', icon: GitBranch },
  knowledge: { label: '节点知识', icon: FileText },
}

const RESULT_TYPE_ORDER: SearchResultType[] = ['book', 'quote', 'node', 'knowledge']

function readRecentSearchResults(): RecentSearchResult[] {
  try {
    const rawValue = window.localStorage.getItem(RECENT_SEARCH_RESULTS_KEY)
    if (!rawValue) return []
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is RecentSearchResult => Boolean(item?.id && item?.type && item?.title && typeof item.visitedAt === 'number'))
      .slice(0, RECENT_SEARCH_RESULTS_LIMIT)
  } catch {
    return []
  }
}

function writeRecentSearchResults(items: RecentSearchResult[]) {
  window.localStorage.setItem(RECENT_SEARCH_RESULTS_KEY, JSON.stringify(items.slice(0, RECENT_SEARCH_RESULTS_LIMIT)))
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase()
}

function getKnowledgeText(item: NodeKnowledgeItem) {
  return [
    item.title,
    item.sourceBookName,
    item.content,
    item.plainText,
    item.summary,
    item.tags?.join(' '),
  ].filter(Boolean).join(' ')
}

function getNodeText(node: BaseNode) {
  const knowledgeItems = Array.isArray(node.meta?.knowledgeItems)
    ? node.meta.knowledgeItems as NodeKnowledgeItem[]
    : []
  return [
    node.label,
    node.shortDefinition,
    node.meta?.notes?.map((note) => `${note.title} ${note.content}`).join(' '),
    knowledgeItems.map(getKnowledgeText).join(' '),
  ].filter(Boolean).join(' ')
}

function getSnippet(content: string, query: string) {
  const source = content.replace(/\s+/g, ' ').trim()
  if (!source) return ''
  const keyword = normalizeText(query)
  const index = normalizeText(source).indexOf(keyword)
  if (index < 0) return source.slice(0, 120)
  const start = Math.max(0, index - 34)
  const end = Math.min(source.length, index + keyword.length + 86)
  return `${start > 0 ? '...' : ''}${source.slice(start, end)}${end < source.length ? '...' : ''}`
}

function renderHighlightedText(value: string, query: string) {
  const keyword = query.trim()
  if (!keyword) return value

  const lowerValue = value.toLocaleLowerCase()
  const lowerKeyword = keyword.toLocaleLowerCase()
  const parts: Array<{ text: string; isMatch: boolean }> = []
  let cursor = 0
  let matchIndex = lowerValue.indexOf(lowerKeyword)

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push({ text: value.slice(cursor, matchIndex), isMatch: false })
    }
    parts.push({ text: value.slice(matchIndex, matchIndex + keyword.length), isMatch: true })
    cursor = matchIndex + keyword.length
    matchIndex = lowerValue.indexOf(lowerKeyword, cursor)
  }

  if (cursor < value.length) {
    parts.push({ text: value.slice(cursor), isMatch: false })
  }

  return parts.map((part, index) => (
    part.isMatch ? <mark key={`${part.text}-${index}`}>{part.text}</mark> : <span key={`${part.text}-${index}`}>{part.text}</span>
  ))
}

export function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  const [recentResults, setRecentResults] = useState<RecentSearchResult[]>([])
  const { books, quotes, loadLibraryFromApi, selectBook, selectQuote } = useLibraryStore()
  const { openResourceDrawer, requestSearchNavigation, setResourceDrawerView } = useUIStore()

  useEffect(() => {
    loadLibraryFromApi().catch((error) => {
      console.warn('Failed to load search data.', error)
    })
  }, [loadLibraryFromApi])

  useEffect(() => {
    setRecentResults(readRecentSearchResults())
  }, [])

  const bookById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books])

  const indexedResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = []

    books.forEach((book) => {
      results.push({
        id: `book-${book.id}`,
        type: 'book',
        title: book.title,
        subtitle: book.author || '未知作者',
        content: `${book.title} ${book.author}`,
        bookId: book.id,
      })
    })

    quotes.forEach((quote) => {
      const book = bookById.get(quote.bookId)
      results.push({
        id: `quote-${quote.id}`,
        type: 'quote',
        title: quote.treeTitle || quote.text.slice(0, 32) || '未命名金句',
        subtitle: book ? `${book.title} · ${book.author}` : '金句',
        content: `${quote.text} ${quote.tags.join(' ')} ${quote.treeTitle ?? ''}`,
        bookId: quote.bookId,
        quoteId: quote.id,
      })

      const treeNodes = quote.treeSnapshot?.nodes ?? {}
      Object.values(treeNodes).forEach((node) => {
        results.push({
          id: `node-${quote.id}-${node.id}`,
          type: 'node',
          title: node.label,
          subtitle: `${book?.title ?? '来源书籍'} · ${quote.treeTitle ?? '金句画布'}`,
          content: getNodeText(node),
          bookId: quote.bookId,
          quoteId: quote.id,
          nodeId: node.id,
        })

        const knowledgeItems = Array.isArray(node.meta?.knowledgeItems)
          ? node.meta.knowledgeItems as NodeKnowledgeItem[]
          : []
        knowledgeItems.forEach((item) => {
          results.push({
            id: `knowledge-${quote.id}-${node.id}-${item.id}`,
            type: 'knowledge',
            title: item.title || item.sourceBookName || node.label,
            subtitle: `${node.label} · ${book?.title ?? '来源书籍'}`,
            content: getKnowledgeText(item),
            bookId: quote.bookId,
            quoteId: quote.id,
            nodeId: node.id,
            knowledgeItemId: item.id,
          })
        })
      })
    })

    return results
  }, [bookById, books, quotes])

  const results = useMemo(() => {
    const keyword = normalizeText(query)
    if (!keyword) {
      return RESULT_TYPE_ORDER.flatMap((type) => (
        indexedResults.filter((result) => result.type === type).slice(0, type === 'book' ? 8 : 12)
      ))
    }

    return indexedResults
      .map((result) => {
        const haystack = normalizeText(`${result.title} ${result.subtitle} ${result.content}`)
        const titleMatch = normalizeText(result.title).includes(keyword)
        const score = titleMatch ? 2 : haystack.includes(keyword) ? 1 : 0
        return { result, score }
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.result)
      .slice(0, 80)
  }, [indexedResults, query])

  const groupedResults = useMemo(() => (
    RESULT_TYPE_ORDER.map((type) => ({
      type,
      items: results.filter((result) => result.type === type),
    })).filter((section) => section.items.length > 0)
  ), [results])

  const selectedResult = useMemo(() => (
    results.find((result) => result.id === selectedResultId) ?? results[0] ?? null
  ), [results, selectedResultId])

  const selectedBook = selectedResult?.bookId ? bookById.get(selectedResult.bookId) : null
  const selectedQuote = selectedResult?.quoteId ? quotes.find((quote) => quote.id === selectedResult.quoteId) ?? null : null
  const selectedNode = selectedResult?.nodeId && selectedQuote?.treeSnapshot?.nodes
    ? selectedQuote.treeSnapshot.nodes[selectedResult.nodeId] ?? null
    : null

  useEffect(() => {
    if (!results.length) {
      setSelectedResultId(null)
      return
    }
    if (!selectedResultId || !results.some((result) => result.id === selectedResultId)) {
      setSelectedResultId(results[0].id)
    }
  }, [results, selectedResultId])

  const rememberResult = (result: SearchResult) => {
    const nextResults = [
      { ...result, visitedAt: Date.now() },
      ...recentResults.filter((item) => item.id !== result.id),
    ].slice(0, RECENT_SEARCH_RESULTS_LIMIT)
    setRecentResults(nextResults)
    writeRecentSearchResults(nextResults)
  }

  const clearRecentResults = () => {
    setRecentResults([])
    window.localStorage.removeItem(RECENT_SEARCH_RESULTS_KEY)
  }

  const openResult = (result: SearchResult) => {
    rememberResult(result)

    if (result.type === 'book' && result.bookId) {
      selectBook(result.bookId)
      navigate('/app/books')
      return
    }

    if (result.quoteId) {
      if (result.bookId) selectBook(result.bookId)
      selectQuote(result.quoteId)
      requestSearchNavigation({
        type: result.type === 'knowledge' ? 'knowledge' : result.type === 'node' ? 'node' : 'quote',
        quoteId: result.quoteId,
        nodeId: result.nodeId,
        knowledgeItemId: result.knowledgeItemId,
      })
      setResourceDrawerView('quotes')
      openResourceDrawer()
      navigate('/app/quotes')
    }
  }

  return (
    <div className="search-page">
      <header className="search-page-head">
        <div className="search-page-title-row">
          <h1>全局搜索</h1>
          <p>搜索书籍、金句、画布节点和节点知识。</p>
        </div>
        <div className="search-page-head-search">
          <div className="search-page-box">
            <Search size={18} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入书名、金句、节点或知识内容..."
            />
          </div>
          <div className="search-page-meta">
            {query.trim() ? `找到 ${results.length} 条结果` : `最近索引 ${indexedResults.length} 条内容`}
          </div>
        </div>
      </header>

      {recentResults.length > 0 && (
        <section className="search-recent-panel">
          <div className="search-recent-head">
            <div>
              <Clock3 size={16} />
              <strong>最近访问</strong>
            </div>
            <button type="button" onClick={clearRecentResults}>
              <Trash2 size={13} />
              清空
            </button>
          </div>
          <div className="search-recent-list">
            {recentResults.slice(0, 8).map((result) => {
              const meta = RESULT_TYPE_META[result.type]
              const Icon = meta.icon
              return (
                <button key={`${result.id}-${result.visitedAt}`} type="button" onClick={() => openResult(result)}>
                  <span className={`search-result-type is-${result.type}`}>
                    <Icon size={13} />
                    {meta.label}
                  </span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="search-content-layout">
        <div className="search-grouped-results">
          {groupedResults.length > 0 ? (
            groupedResults.map((section) => {
              const sectionMeta = RESULT_TYPE_META[section.type]
              const SectionIcon = sectionMeta.icon
              return (
                <section key={section.type} className="search-result-section">
                  <div className="search-result-section-head">
                    <div>
                      <SectionIcon size={16} />
                      <strong>{sectionMeta.label}</strong>
                    </div>
                    <span>{section.items.length} 条</span>
                  </div>
                  <div className="search-results">
                    {section.items.map((result) => {
                      const meta = RESULT_TYPE_META[result.type]
                      const Icon = meta.icon
                      const isSelected = selectedResult?.id === result.id
                      return (
                        <article
                          key={result.id}
                          className={`search-result-card${isSelected ? ' is-selected' : ''}`}
                          onMouseEnter={() => setSelectedResultId(result.id)}
                          onClick={() => openResult(result)}
                        >
                          <span className={`search-result-type is-${result.type}`}>
                            <Icon size={15} />
                            {meta.label}
                          </span>
                          <strong>{renderHighlightedText(result.title, query)}</strong>
                          <small>{renderHighlightedText(result.subtitle, query)}</small>
                          <p>{renderHighlightedText(getSnippet(result.content, query), query)}</p>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })
          ) : (
            <div className="search-empty">
              <Search size={24} />
              <strong>没有找到匹配内容</strong>
              <p>换一个关键词试试看。</p>
            </div>
          )}
        </div>

        <aside className="search-preview-panel">
          {selectedResult ? (() => {
            const meta = RESULT_TYPE_META[selectedResult.type]
            const Icon = meta.icon
            return (
              <>
                <span className={`search-result-type is-${selectedResult.type}`}>
                  <Icon size={15} />
                  {meta.label}
                </span>
                <h2>{renderHighlightedText(selectedResult.title, query)}</h2>
                <p className="search-preview-subtitle">{renderHighlightedText(selectedResult.subtitle, query)}</p>

                <div className="search-preview-context">
                  {selectedBook && <div><span>书籍</span><strong>{selectedBook.title}</strong></div>}
                  {selectedBook?.author && <div><span>作者</span><strong>{selectedBook.author}</strong></div>}
                  {selectedQuote && <div><span>金句画布</span><strong>{selectedQuote.treeTitle || selectedQuote.text.slice(0, 24) || '未命名金句'}</strong></div>}
                  {selectedNode && <div><span>节点</span><strong>{selectedNode.label}</strong></div>}
                </div>

                <div className="search-preview-content">
                  <div>
                    <MapPin size={16} />
                    <strong>内容预览</strong>
                  </div>
                  <p>{renderHighlightedText(getSnippet(selectedResult.content, query || selectedResult.title), query)}</p>
                </div>

                {selectedQuote?.text && selectedResult.type !== 'book' && (
                  <div className="search-preview-quote">
                    <Quote size={16} />
                    <p>{renderHighlightedText(selectedQuote.text.slice(0, 220), query)}</p>
                  </div>
                )}

                <button type="button" className="search-preview-open" onClick={() => openResult(selectedResult)}>
                  打开并定位 <ArrowRight size={15} />
                </button>
              </>
            )
          })() : (
            <div className="search-preview-empty">
              <Search size={22} />
              <strong>选择一条结果查看预览</strong>
              <p>预览会显示它所属的书籍、金句画布、节点和内容上下文。</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
