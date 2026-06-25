import { create } from 'zustand'
import type { BaseNode } from './useDocumentStore'
import { fetchJson } from '../lib/api'

export interface Group {
  id: string
  name: string
  bookCount: number
}

export interface Book {
  id: string
  groupId: string
  title: string
  author: string
  quotesCount: number
  extractedCount: number
  lastUpdated: string
  color: string
  coverUrl?: string | null
}

export interface QuoteCardSummary {
  causeList: string[]
  effectList: string[]
  middleStepList: string[]
  pendingList: string[]
  pendingQuestions: Array<{
    nodeId: string
    nodeLabel: string
    question: string
  }>
  candidateNodes: Array<{
    id: string
    label: string
    nodeType: string
    parentId: string | null
    orderIndex: number
  }>
  candidateEdges: Array<{
    sourceId: string
    targetId: string
    relationType: string
  }>
  notes: Array<{
    nodeId: string
    nodeLabel: string
    title: string
    content: string
  }>
}

export interface QuoteItem {
  id: string
  bookId: string
  text: string
  status: 'pending' | 'extracted'
  tags: string[]
  page?: string
  savedAt?: number
  treeTitle?: string
  nodeCount?: number
  workspaceVersion?: number
  workspaceKeywords?: string[]
  quoteCardSummary?: QuoteCardSummary
  treeSnapshot?: {
    nodes: Record<string, BaseNode>
    rootNodeIds: string[]
  }
}

interface LibraryState {
  groups: Group[]
  books: Book[]
  quotes: QuoteItem[]
  selectedBookId: string | null
  selectedQuoteId: string | null
  selectBook: (bookId: string) => void
  selectQuote: (quoteId: string | null) => void
  loadLibraryFromApi: () => Promise<void>
  loadQuoteWorkspace: (quoteId: string) => Promise<void>
  upsertQuoteFromApi: (quote: QuoteItem) => void
  addGroup: (name: string) => Promise<Group>
  updateGroup: (id: string, name: string) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
  addBook: (groupId: string, title: string) => Promise<Book>
  updateBook: (id: string, title: string) => Promise<void>
  updateBookAuthor: (id: string, author: string) => Promise<void>
  updateBookCover: (id: string, coverUrl: string | null) => Promise<void>
  deleteBook: (id: string) => Promise<void>
  deleteQuote: (id: string) => Promise<void>
  saveQuoteWorkspace: (payload: {
    quoteId?: string | null
    bookId: string
    text: string
    nodes: Record<string, BaseNode>
    rootNodeIds: string[]
    treeTitle?: string
    workspaceKeywords?: string[]
  }) => Promise<string>
}

type ApiSuccess<T> = {
  success: true
  data: T
}

function pickInitialBookId(books: Book[], quotes: QuoteItem[]) {
  const validBookIds = new Set(books.map((book) => book.id))
  const latestSavedQuote = [...quotes]
    .filter((quote) => validBookIds.has(quote.bookId) && (quote.treeSnapshot || quote.savedAt || quote.status === 'extracted'))
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0]

  return latestSavedQuote?.bookId ?? books[0]?.id ?? null
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  groups: [],
  books: [],
  quotes: [],
  selectedBookId: null,
  selectedQuoteId: null,

  selectBook: (bookId) => set({ selectedBookId: bookId, selectedQuoteId: null }),
  selectQuote: (quoteId) => set({ selectedQuoteId: quoteId }),

  loadLibraryFromApi: async () => {
    const response = await fetchJson<ApiSuccess<{ groups: Group[]; books: Book[]; quotes: QuoteItem[] }>>('/library')

    set((state) => ({
      groups: response.data.groups,
      books: response.data.books,
      quotes: response.data.quotes,
      selectedBookId: state.selectedBookId && response.data.books.some((book) => book.id === state.selectedBookId)
        ? state.selectedBookId
        : pickInitialBookId(response.data.books, response.data.quotes),
      selectedQuoteId: state.selectedQuoteId && response.data.quotes.some((quote) => quote.id === state.selectedQuoteId)
        ? state.selectedQuoteId
        : null,
    }))
  },

  loadQuoteWorkspace: async (quoteId) => {
    const response = await fetchJson<{ success: true; data: QuoteItem }>(`/quote-workspaces/${quoteId}`)
    const quote = response.data

    set((state) => ({
      selectedQuoteId: quote.id,
      selectedBookId: quote.bookId,
      quotes: state.quotes.map((item) => (item.id === quote.id ? quote : item)),
    }))
  },

  upsertQuoteFromApi: (quote) => {
    set((state) => {
      const exists = state.quotes.some((item) => item.id === quote.id)
      return {
        quotes: exists
          ? state.quotes.map((item) => (item.id === quote.id ? quote : item))
          : [quote, ...state.quotes],
      }
    })
  },

  addGroup: async (name) => {
    const response = await fetchJson<ApiSuccess<Group>>('/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })

    set((state) => ({
      groups: [...state.groups, response.data],
    }))

    return response.data
  },

  updateGroup: async (id, name) => {
    const response = await fetchJson<ApiSuccess<Group>>(`/groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })

    set((state) => ({
      groups: state.groups.map((group) => (group.id === id ? response.data : group)),
    }))
  },

  deleteGroup: async (id) => {
    await fetchJson<ApiSuccess<{ id: string }>>(`/groups/${id}`, {
      method: 'DELETE',
    })

    set((state) => {
      const removedBookIds = new Set(state.books.filter((book) => book.groupId === id).map((book) => book.id))
      const nextGroups = state.groups.filter((group) => group.id !== id)
      const nextBooks = state.books.filter((book) => book.groupId !== id)
      const nextQuotes = state.quotes.filter((quote) => !removedBookIds.has(quote.bookId))

      return {
        groups: nextGroups,
        books: nextBooks,
        quotes: nextQuotes,
        selectedBookId: nextBooks.some((book) => book.id === state.selectedBookId) ? state.selectedBookId : nextBooks[0]?.id ?? null,
        selectedQuoteId: nextQuotes.some((quote) => quote.id === state.selectedQuoteId) ? state.selectedQuoteId : null,
      }
    })
  },

  addBook: async (groupId, title) => {
    const response = await fetchJson<ApiSuccess<Book>>('/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, title }),
    })

    set((state) => ({
      books: [...state.books, response.data],
      groups: state.groups.map((group) => (
        group.id === groupId
          ? { ...group, bookCount: group.bookCount + 1 }
          : group
      )),
      selectedBookId: response.data.id,
    }))

    return response.data
  },

  updateBook: async (id, title) => {
    const response = await fetchJson<ApiSuccess<Book>>(`/books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })

    set((state) => ({
      books: state.books.map((book) => (book.id === id ? response.data : book)),
    }))
  },

  updateBookAuthor: async (id, author) => {
    const response = await fetchJson<ApiSuccess<Book>>(`/books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author }),
    })

    set((state) => ({
      books: state.books.map((book) => (book.id === id ? response.data : book)),
    }))
  },

  updateBookCover: async (id, coverUrl) => {
    const response = await fetchJson<ApiSuccess<Book>>(`/books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverUrl }),
    })

    set((state) => ({
      books: state.books.map((book) => (book.id === id ? response.data : book)),
    }))
  },

  deleteBook: async (id) => {
    await fetchJson<ApiSuccess<{ id: string }>>(`/books/${id}`, {
      method: 'DELETE',
    })

    set((state) => {
      const bookToDelete = state.books.find((book) => book.id === id)
      if (!bookToDelete) return state

      const nextBooks = state.books.filter((book) => book.id !== id)
      const nextQuotes = state.quotes.filter((quote) => quote.bookId !== id)
      const nextGroups = state.groups.map((group) => (
        group.id === bookToDelete.groupId
          ? { ...group, bookCount: Math.max(0, group.bookCount - 1) }
          : group
      ))

      return {
        books: nextBooks,
        quotes: nextQuotes,
        groups: nextGroups,
        selectedBookId: state.selectedBookId === id ? nextBooks[0]?.id ?? null : state.selectedBookId,
        selectedQuoteId: nextQuotes.some((quote) => quote.id === state.selectedQuoteId) ? state.selectedQuoteId : null,
      }
    })
  },

  deleteQuote: async (id) => {
    await fetchJson<ApiSuccess<{ id: string }>>(`/quotes/${id}`, {
      method: 'DELETE',
    })

    set((state) => {
      const quoteToDelete = state.quotes.find((quote) => quote.id === id)
      if (!quoteToDelete) return state

      const nextQuotes = state.quotes.filter((quote) => quote.id !== id)

      return {
        quotes: nextQuotes,
        selectedQuoteId: state.selectedQuoteId === id ? null : state.selectedQuoteId,
        books: state.books.map((book) => (
          book.id === quoteToDelete.bookId
            ? {
                ...book,
                quotesCount: Math.max(0, book.quotesCount - 1),
                extractedCount: quoteToDelete.status === 'extracted'
                  ? Math.max(0, book.extractedCount - 1)
                  : book.extractedCount,
                lastUpdated: '刚刚',
              }
            : book
        )),
      }
    })
  },

  saveQuoteWorkspace: async (payload) => {
    const response = await fetchJson<ApiSuccess<QuoteItem>>('/quote-workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const savedQuoteFromApi = response.data

    set((state) => {
      const exists = state.quotes.some((quote) => quote.id === savedQuoteFromApi.id)
      const previousQuote = state.quotes.find((quote) => quote.id === savedQuoteFromApi.id)
      const shouldIncreaseExtractedCount = !previousQuote || previousQuote.status !== 'extracted'
      return {
        quotes: exists
          ? state.quotes.map((quote) => (quote.id === savedQuoteFromApi.id ? savedQuoteFromApi : quote))
          : [savedQuoteFromApi, ...state.quotes],
        books: state.books.map((book) =>
          book.id === savedQuoteFromApi.bookId
            ? {
                ...book,
                quotesCount: exists ? book.quotesCount : book.quotesCount + 1,
                extractedCount: shouldIncreaseExtractedCount ? book.extractedCount + 1 : book.extractedCount,
                lastUpdated: '刚刚',
              }
            : book
        )
      }
    })

    void get().loadLibraryFromApi().catch((error) => {
      console.warn('Failed to refresh library after saving workspace.', error)
    })

    return savedQuoteFromApi.id
  }
}))
