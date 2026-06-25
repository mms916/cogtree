const now = '2026-04-22T10:30:00Z'

export const demoUser = {
  id: 'b59d36fb-2bb5-4ef9-95d0-7c0fd7b5d001',
  email: 'demo@cogtree.local',
  displayName: 'CogTree Demo',
}

export const books = [
  {
    id: 'bc858d59-e1cc-4c07-95f7-6c4b7f395001',
    title: '纳瓦尔宝典',
    author: 'Eric Jorgenson',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'bc858d59-e1cc-4c07-95f7-6c4b7f395002',
    title: '穷查理宝典',
    author: 'Peter D. Kaufman',
    createdAt: now,
    updatedAt: now,
  },
]

export const quoteCards = [
  {
    id: 'quote-card-1',
    quoteId: 'quote-1',
    bookId: books[0]!.id,
    keywords: ['财富', '股权'],
    causeList: ['拥有股权'],
    effectList: ['获得长期财富'],
    middleStepList: ['分享企业增长'],
    pendingList: [],
    pendingQuestions: ['为什么股权比薪水更接近财富自由？'],
    candidateNodes: [
      { tempId: 'candidate-1', label: '股权', nodeType: 'concept' },
      { tempId: 'candidate-2', label: '财富自由', nodeType: 'effect' },
    ],
    candidateEdges: [
      {
        tempId: 'candidate-edge-1',
        sourceTempId: 'candidate-1',
        targetTempId: 'candidate-2',
        relationType: 'support',
      },
    ],
    candidateThemeIds: ['wealth'],
    status: 'queued_for_book_tree',
    updatedAt: now,
  },
]

export const bookTreeContext = {
  bookId: books[0]!.id,
  bookName: books[0]!.title,
  activeTreeId: 'book-tree-1',
  activeVersion: 3,
  currentThemeFilter: 'wealth',
  pruningQueueCount: 1,
  mergeSuggestionCount: 2,
}

export const bookTree = {
  treeId: 'book-tree-1',
  bookId: books[0]!.id,
  version: 3,
  rootNodeIds: ['book-root'],
  stats: {
    nodeCount: 3,
    mergeCandidateCount: 1,
  },
  nodes: {
    'book-root': {
      id: 'book-root',
      label: '财富',
      shortDefinition: '书内财富主题的根节点。',
      status: 'normal',
    },
    'book-1': {
      id: 'book-1',
      label: '股权',
      shortDefinition: '通过拥有企业的一部分获得长期收益。',
      status: 'has_source',
    },
    'book-2': {
      id: 'book-2',
      label: '长期主义',
      shortDefinition: '财富积累依赖长期复利与持续积累。',
      status: 'pending_review',
    },
  },
}

export const themeContext = {
  themeId: 'wealth',
  themeName: '财富',
  activeTreeId: 'theme-tree-1',
  activeVersion: 5,
  selectedSourceBookIds: books.map((book) => book.id),
  crossBookConnectionCount: 2,
  pendingVerifyCount: 1,
}

export const themeTree = {
  treeId: 'theme-tree-1',
  themeId: 'wealth',
  version: 5,
  rootNodeIds: ['theme-root'],
  stats: {
    nodeCount: 3,
    sourceBookCount: 2,
  },
  nodes: {
    'theme-root': {
      id: 'theme-root',
      label: '财富',
      shortDefinition: '跨书整合后的财富主题树。',
      status: 'normal',
    },
    'theme-1': {
      id: 'theme-1',
      label: '可复制资产',
      shortDefinition: '高杠杆、高复制性的财富增长路径。',
      status: 'user_created_abstract',
    },
    'theme-2': {
      id: 'theme-2',
      label: '认知复利',
      shortDefinition: '通过判断力与长期选择积累优势。',
      status: 'pending_verify',
    },
  },
}

export const themeSourceBooks = books.map((book, index) => ({
  bookId: book.id,
  title: book.title,
  author: book.author,
  contributionNodeCount: index + 1,
  isSelected: true,
  isPrimarySource: index === 0,
}))
