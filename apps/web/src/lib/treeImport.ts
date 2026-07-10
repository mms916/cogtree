import type { BaseNode, NodeKnowledgeItem, NodeKnowledgeTag } from '../stores/useDocumentStore'

type ParsedHeadingNode = {
  id: string
  level: number
  title: string
  parentId: string | null
  childrenIds: string[]
  quotes: string[]
  shortDefinition?: string
  meta?: BaseNode['meta']
}

type ImportedTree = {
  title: string
  nodes: Record<string, BaseNode>
  rootNodeIds: string[]
  linkedQuoteText: string
  summary: {
    nodeCount: number
    rootNodeCount: number
    quoteCount: number
    maxDepth: number
    warnings: string[]
  }
}

const HORIZONTAL_GAP = 300
const ROOT_X = 120
const ROOT_Y = 120
const ROOT_VERTICAL_GAP = 120
const CHILD_VERTICAL_GAP = 62
const ROOT_NODE_HEIGHT = 58
const BRANCH_NODE_HEIGHT = 50
const LEAF_NODE_HEIGHT = 28
const LEAF_TEXT_LINE_HEIGHT = 24
const LEAF_TEXT_CHARS_PER_LINE = 13
const MAX_INITIAL_CENTER_OFFSET = 260
const LARGE_IMPORT_NODE_THRESHOLD = 500
const LARGE_IMPORT_COLLAPSE_DEPTH = 2
const LARGE_IMPORT_FANOUT_COLLAPSE_LIMIT = 80
const KEYWORD_QUOTE = '\u91d1\u53e5'
const KEYWORD_RELATED_QUOTE = '\u5173\u8054\u91d1\u53e5'
const KEYWORD_KNOWLEDGE = '\u8282\u70b9\u77e5\u8bc6'
const KEYWORD_REFLECTION = '\u601d\u8003\u4e0e\u611f\u609f'
const KEYWORD_NODE_TYPE = '\u8282\u70b9\u7c7b\u578b'
const KEYWORD_IMPORT_TITLE = '\u5bfc\u5165\u7684\u91d1\u53e5\u63d0\u70bc'
const KEYWORD_NODE = '\u8282\u70b9'
const KEYWORD_SHORT_DEFINITION = '\u7b80\u77ed\u5b9a\u4e49'
const KEYWORD_IMPORT_BOOK_SUFFIX = '\u91d1\u53e5\u63d0\u70bc'
const KEYWORD_IMPORT_GROUP = '\u8282\u70b9\u77e5\u8bc6'
const KEYWORD_IMPORT_QUOTE = '\u91d1\u53e5'
const HEADING_PATTERN = /^[\uFEFF\u200B\u00A0\s]*(#{1,6})[ \t]+(.+?)\s*$/
const LIST_ITEM_PATTERN = /^(\s*)([-*+]|\d+[.)、．])\s+(.+?)\s*$/
const NODE_DEPTH_COMMENT_PATTERN = /^\s*<!--\s*cogtree-node-depth:\s*(\d+)\s*-->\s*$/
const KNOWLEDGE_METADATA_COMMENT_PATTERN = /^\s*<!--\s*cogtree-knowledge:\s*(.+?)\s*-->\s*$/

function generateImportId(index: number) {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `import-node-${Date.now()}-${index}`
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)、．]\s*/, '')
    .trim()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function plainTextToHtml(value: string) {
  const paragraphs = value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
  return paragraphs.length > 0 ? paragraphs.join('') : '<p></p>'
}

function createQuoteTag(timestamp: number): NodeKnowledgeTag {
  return {
    id: 'quote',
    name: '金句',
    kind: 'quote',
    type: 'system',
    systemKey: 'quote',
    isFixed: true,
    color: '#22d3ee',
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function createQuoteItems(quotes: string[], sourceBookName: string, timestamp: number): NodeKnowledgeItem[] {
  return quotes.map((quote, index) => ({
    id: `import-quote-${timestamp}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    tagId: 'quote',
    contentType: 'quote',
    title: sourceBookName,
    sourceBookName,
    content: quote,
    contentHtml: plainTextToHtml(quote),
    plainText: quote,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp
  }))
}

function normalizeQuoteBlock(lines: string[]) {
  return lines
    .map((line) => line.replace(/^>\s?/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitQuoteText(value: string) {
  return value
    .replace(/\s+>\s*(?=\d+[、.．])/g, '\n')
    .split(/\n(?=\s*\d+[、.．]\s*)/)
    .map((item) => stripInlineMarkdown(item.replace(/^\s*\d+[、.．]\s*/, '')))
    .filter(Boolean)
}

function getHeadingSectionTitle(value: string) {
  return stripInlineMarkdown(value)
    .replace(/[：:]\s*$/, '')
    .trim()
}

function isKnowledgeSectionTitle(value: string) {
  const normalized = getHeadingSectionTitle(value)
  return [
    KEYWORD_QUOTE,
    KEYWORD_RELATED_QUOTE,
    KEYWORD_KNOWLEDGE,
    KEYWORD_REFLECTION,
    KEYWORD_IMPORT_GROUP,
    KEYWORD_IMPORT_QUOTE,
  ].includes(normalized)
}

function shouldSkipMetadataLine(line: string) {
  const trimmed = line.trim()
  return trimmed.startsWith(`- ${KEYWORD_NODE_TYPE}`)
    || trimmed.startsWith('- \u91cd\u8981\u8282\u70b9')
    || /^-\s*(Node type|Important node)/i.test(trimmed)
}

function parseShortDefinition(line: string) {
  const match = line.trim().match(new RegExp(`^-\\s*(?:${KEYWORD_SHORT_DEFINITION}|Short definition)[:\uff1a]\\s*(.+)$`, 'i'))
  return match?.[1]?.trim() ?? null
}

function resetParsedTree(parsedNodes: Record<string, ParsedHeadingNode>, rootNodeIds: string[], stack: ParsedHeadingNode[]) {
  Object.keys(parsedNodes).forEach((nodeId) => delete parsedNodes[nodeId])
  rootNodeIds.splice(0, rootNodeIds.length)
  stack.splice(0, stack.length)
}

function isMetadataListItem(value: string) {
  const title = stripInlineMarkdown(value)
  return title.startsWith(`${KEYWORD_NODE_TYPE}:`)
    || title.startsWith(`${KEYWORD_NODE_TYPE}\uff1a`)
    || title.startsWith('\u91cd\u8981\u8282\u70b9:')
    || title.startsWith('\u91cd\u8981\u8282\u70b9\uff1a')
    || title.startsWith(`${KEYWORD_SHORT_DEFINITION}:`)
    || title.startsWith(`${KEYWORD_SHORT_DEFINITION}\uff1a`)
    || /^(Node type|Important node|Short definition)[:\uff1a]/i.test(title)
}

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

function getNodeDepth(parsedNodes: Record<string, ParsedHeadingNode>, nodeId: string) {
  let depth = 0
  let currentNode = parsedNodes[nodeId]
  while (currentNode?.parentId) {
    depth += 1
    currentNode = parsedNodes[currentNode.parentId]
  }
  return depth
}

function getNodeVisualHeight(parsedNodes: Record<string, ParsedHeadingNode>, nodeId: string) {
  const depth = getNodeDepth(parsedNodes, nodeId)
  if (depth === 0) return ROOT_NODE_HEIGHT
  if (depth === 1) return BRANCH_NODE_HEIGHT
  return Math.max(LEAF_NODE_HEIGHT, getLeafTextLineCount(parsedNodes[nodeId]?.title ?? '') * LEAF_TEXT_LINE_HEIGHT)
}

function getSubtreeSpan(
  parsedNodes: Record<string, ParsedHeadingNode>,
  nodeId: string,
  collapsedNodeIds: Set<string> = new Set()
): number {
  const node = parsedNodes[nodeId]
  if (!node || node.childrenIds.length === 0 || collapsedNodeIds.has(nodeId)) {
    return getNodeVisualHeight(parsedNodes, nodeId)
  }
  return Math.max(
    getNodeVisualHeight(parsedNodes, nodeId),
    node.childrenIds.reduce((total, childId, index) => (
      total + getSubtreeSpan(parsedNodes, childId, collapsedNodeIds) + (index > 0 ? CHILD_VERTICAL_GAP : 0)
    ), 0)
  )
}

function layoutSubtree(
  parsedNodes: Record<string, ParsedHeadingNode>,
  outputNodes: Record<string, BaseNode>,
  nodeId: string,
  depth: number,
  centerY: number,
  centerOffsetLimit = Number.POSITIVE_INFINITY,
  collapsedNodeIds: Set<string> = new Set()
) {
  const parsedNode = parsedNodes[nodeId]
  const outputNode = outputNodes[nodeId]
  if (!parsedNode || !outputNode) return

  outputNodes[nodeId] = {
    ...outputNode,
    position: {
      x: ROOT_X + depth * HORIZONTAL_GAP,
      y: centerY - getNodeVisualHeight(parsedNodes, nodeId) / 2
    }
  }

  if (parsedNode.childrenIds.length === 0 || collapsedNodeIds.has(nodeId)) return

  if (parsedNode.childrenIds.length === 1) {
    layoutSubtree(parsedNodes, outputNodes, parsedNode.childrenIds[0], depth + 1, centerY, centerOffsetLimit, collapsedNodeIds)
    return
  }

  const childSpans = parsedNode.childrenIds.map((childId) => getSubtreeSpan(parsedNodes, childId, collapsedNodeIds))
  const immediateChildrenSpan = parsedNode.childrenIds.reduce((total, childId, index) => (
    total + getNodeVisualHeight(parsedNodes, childId) + (index > 0 ? CHILD_VERTICAL_GAP : 0)
  ), 0)
  const centerOffset = Math.min(immediateChildrenSpan / 2, centerOffsetLimit)
  let childTop = centerY - centerOffset

  parsedNode.childrenIds.forEach((childId, index) => {
    const childCenterY = childTop + getNodeVisualHeight(parsedNodes, childId) / 2
    layoutSubtree(parsedNodes, outputNodes, childId, depth + 1, childCenterY, Number.POSITIVE_INFINITY, collapsedNodeIds)
    childTop += childSpans[index] + CHILD_VERTICAL_GAP
  })
}

export function importTreeFromMarkdown(markdown: string, fallbackTitle = KEYWORD_IMPORT_TITLE): ImportedTree {
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/)
  const parsedNodes: Record<string, ParsedHeadingNode> = {}
  const rootNodeIds: string[] = []
  const stack: ParsedHeadingNode[] = []
  let title = fallbackTitle
  let currentNode: ParsedHeadingNode | null = null
  let nodeCount = 0
  let readingKnowledgeSection: string | null = null
  let pendingQuoteBlock: string[] = []
  let pendingKnowledgeItem: string[] = []
  let pendingNodeDepth: number | null = null
  const warnings: string[] = []

  const flushQuoteBlock = () => {
    if (!currentNode || pendingQuoteBlock.length === 0) {
      pendingQuoteBlock = []
      return
    }
    splitQuoteText(normalizeQuoteBlock(pendingQuoteBlock)).forEach((quote) => currentNode?.quotes.push(quote))
    pendingQuoteBlock = []
  }

  const flushKnowledgeItem = () => {
    if (!currentNode || pendingKnowledgeItem.length === 0) {
      pendingKnowledgeItem = []
      return
    }

    const quote = pendingKnowledgeItem
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (quote) currentNode.quotes.push(quote)
    pendingKnowledgeItem = []
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd()
    const depthCommentMatch = line.match(NODE_DEPTH_COMMENT_PATTERN)
    if (depthCommentMatch) {
      pendingNodeDepth = Number(depthCommentMatch[1])
      return
    }

    const knowledgeMetadataMatch = line.match(KNOWLEDGE_METADATA_COMMENT_PATTERN)
    if (knowledgeMetadataMatch && currentNode) {
      try {
        const parsed = JSON.parse(decodeURIComponent(knowledgeMetadataMatch[1])) as BaseNode['meta']
        currentNode.meta = {
          ...(currentNode.meta ?? {}),
          ...(Array.isArray(parsed?.knowledgeTags) ? { knowledgeTags: parsed.knowledgeTags } : {}),
          ...(Array.isArray(parsed?.knowledgeItems) ? { knowledgeItems: parsed.knowledgeItems } : {}),
          ...(Array.isArray(parsed?.notes) ? { notes: parsed.notes } : {}),
          ...(Array.isArray(parsed?.inspirationCategories) ? { inspirationCategories: parsed.inspirationCategories } : {}),
        }
      } catch {
        warnings.push(`节点“${currentNode.title}”的结构化知识元数据无法解析，已尝试从 Markdown 正文恢复。`)
      }
      return
    }

    const headingMatch = line.match(HEADING_PATTERN)

    if (line.startsWith('>')) {
      flushKnowledgeItem()
      pendingQuoteBlock.push(line)
      return
    }

    flushQuoteBlock()

    if (headingMatch) {
      flushKnowledgeItem()
      const headingLevel = headingMatch[1].length
      const level = pendingNodeDepth === null ? headingLevel : pendingNodeDepth + 2
      pendingNodeDepth = null
      const headingTitle = stripInlineMarkdown(headingMatch[2])

      if (headingLevel === 1 && nodeCount === 0) {
        title = headingTitle || fallbackTitle
        readingKnowledgeSection = null
        return
      }

      if (isKnowledgeSectionTitle(headingTitle)) {
        readingKnowledgeSection = getHeadingSectionTitle(headingTitle) === KEYWORD_QUOTE || getHeadingSectionTitle(headingTitle) === KEYWORD_RELATED_QUOTE
          ? KEYWORD_IMPORT_QUOTE
          : getHeadingSectionTitle(headingTitle)
        return
      }

      const id = generateImportId(nodeCount)
      nodeCount += 1
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      const parent = stack[stack.length - 1] ?? null
      const parsedNode: ParsedHeadingNode = {
        id,
        level,
        title: headingTitle || `${KEYWORD_NODE} ${nodeCount}`,
        parentId: parent?.id ?? null,
        childrenIds: [],
        quotes: []
      }
      parsedNodes[id] = parsedNode
      if (parent) {
        parent.childrenIds.push(id)
      } else {
        rootNodeIds.push(id)
      }
      stack.push(parsedNode)
      currentNode = parsedNode
      readingKnowledgeSection = null
      return
    }

    if (!currentNode) return
    const trimmed = line.trim()
    if (!trimmed) {
      if (pendingKnowledgeItem.length > 0) pendingKnowledgeItem.push('')
      return
    }
    if (shouldSkipMetadataLine(trimmed)) {
      flushKnowledgeItem()
      return
    }

    const shortDefinition = parseShortDefinition(trimmed)
    if (shortDefinition) {
      currentNode.shortDefinition = stripInlineMarkdown(shortDefinition)
      return
    }

    if (trimmed === KEYWORD_RELATED_QUOTE || trimmed === KEYWORD_QUOTE || trimmed === `${KEYWORD_RELATED_QUOTE}:` || trimmed === `${KEYWORD_RELATED_QUOTE}\uff1a` || trimmed === `${KEYWORD_QUOTE}:` || trimmed === `${KEYWORD_QUOTE}\uff1a`) {
      flushKnowledgeItem()
      readingKnowledgeSection = KEYWORD_IMPORT_QUOTE
      return
    }

    if (trimmed === KEYWORD_KNOWLEDGE || trimmed === `${KEYWORD_KNOWLEDGE}:` || trimmed === `${KEYWORD_KNOWLEDGE}\uff1a`) {
      flushKnowledgeItem()
      readingKnowledgeSection = KEYWORD_IMPORT_GROUP
      return
    }

    if (readingKnowledgeSection === KEYWORD_IMPORT_QUOTE) {
      const listMatch = line.match(LIST_ITEM_PATTERN)
      if (listMatch) {
        flushKnowledgeItem()
        const quote = stripInlineMarkdown(listMatch[3])
        if (quote) pendingKnowledgeItem = [quote]
        return
      }

      if (pendingKnowledgeItem.length > 0) {
        pendingKnowledgeItem.push(stripInlineMarkdown(trimmed))
      }
    }
  })

  flushQuoteBlock()
  flushKnowledgeItem()

  if (Object.keys(parsedNodes).length <= 1) {
    const hasKnowledgeSections = lines.some((line) => {
      const normalized = getHeadingSectionTitle(line.trim())
      return isKnowledgeSectionTitle(normalized)
        || normalized === `${KEYWORD_KNOWLEDGE}:`
        || normalized === `${KEYWORD_KNOWLEDGE}\uff1a`
        || normalized === `${KEYWORD_RELATED_QUOTE}:`
        || normalized === `${KEYWORD_RELATED_QUOTE}\uff1a`
    })
    const outlineItems = lines
      .map((line) => {
        const match = line.match(LIST_ITEM_PATTERN)
        if (!match) return null
        const titleText = stripInlineMarkdown(match[3])
        if (!titleText || isMetadataListItem(match[3])) return null

        const indentWidth = match[1].replace(/\t/g, '  ').length
        return {
          level: Math.floor(indentWidth / 2) + 2,
          title: titleText
        }
      })
      .filter((item): item is { level: number; title: string } => Boolean(item))

    if (!hasKnowledgeSections && outlineItems.length > rootNodeIds.length) {
      resetParsedTree(parsedNodes, rootNodeIds, stack)
      nodeCount = 0
      outlineItems.forEach((item) => {
        const id = generateImportId(nodeCount)
        nodeCount += 1
        while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
          stack.pop()
        }
        const parent = stack[stack.length - 1] ?? null
        const parsedNode: ParsedHeadingNode = {
          id,
          level: item.level,
          title: item.title,
          parentId: parent?.id ?? null,
          childrenIds: [],
          quotes: []
        }
        parsedNodes[id] = parsedNode
        if (parent) {
          parent.childrenIds.push(id)
        } else {
          rootNodeIds.push(id)
        }
        stack.push(parsedNode)
      })
    }
  }

  if (Object.keys(parsedNodes).length <= 1) {
    const fallbackHeadings = lines
      .map((line) => {
        const match = line.match(/^[\s\S]*?(#{1,6})[ \t]+(.+?)\s*$/)
        if (!match) return null
        const level = match[1].length
        const headingTitle = stripInlineMarkdown(match[2])
        if (!headingTitle || [KEYWORD_QUOTE, KEYWORD_RELATED_QUOTE, KEYWORD_KNOWLEDGE, KEYWORD_REFLECTION].includes(headingTitle)) return null
        return { level, title: headingTitle }
      })
      .filter((heading): heading is { level: number; title: string } => Boolean(heading))

    if (fallbackHeadings.length > rootNodeIds.length + 1) {
      resetParsedTree(parsedNodes, rootNodeIds, stack)
      nodeCount = 0
      fallbackHeadings.forEach((heading, index) => {
        if (index === 0 && heading.level === 1) {
          title = heading.title || fallbackTitle
          return
        }
        const id = generateImportId(nodeCount)
        nodeCount += 1
        while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
          stack.pop()
        }
        const parent = stack[stack.length - 1] ?? null
        const parsedNode: ParsedHeadingNode = {
          id,
          level: heading.level,
          title: heading.title,
          parentId: parent?.id ?? null,
          childrenIds: [],
          quotes: []
        }
        parsedNodes[id] = parsedNode
        if (parent) {
          parent.childrenIds.push(id)
        } else {
          rootNodeIds.push(id)
        }
        stack.push(parsedNode)
      })
    }
  }

  if (rootNodeIds.length === 0) {
    warnings.push('没有识别到 Markdown 标题或列表层级，已使用文档标题创建一个根节点。')
    const id = generateImportId(0)
    parsedNodes[id] = {
      id,
      level: 2,
      title,
      parentId: null,
      childrenIds: [],
      quotes: []
    }
    rootNodeIds.push(id)
  }

  const timestamp = Date.now()
  const sourceBookName = title.replace(new RegExp(`-?${KEYWORD_IMPORT_BOOK_SUFFIX}$`, 'u'), '').trim() || fallbackTitle
  const nodes: Record<string, BaseNode> = {}
  const shouldCollapseLargeImport = Object.keys(parsedNodes).length > LARGE_IMPORT_NODE_THRESHOLD

  Object.values(parsedNodes).forEach((node) => {
    const parsedKnowledgeItems = Array.isArray(node.meta?.knowledgeItems) ? node.meta.knowledgeItems : []
    const hasStructuredQuotes = parsedKnowledgeItems.some((item) => item.contentType === 'quote' || item.tagId === 'quote')
    const quoteItems = hasStructuredQuotes
      ? []
      : createQuoteItems(Array.from(new Set(node.quotes)), sourceBookName, timestamp)
    const nodeDepth = getNodeDepth(parsedNodes, node.id)
    nodes[node.id] = {
      id: node.id,
      label: node.title,
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
      orderIndex: node.parentId ? parsedNodes[node.parentId]?.childrenIds.indexOf(node.id) ?? 0 : rootNodeIds.indexOf(node.id),
      nodeType: 'concept',
      status: shouldCollapseLargeImport
        && node.childrenIds.length > 0
        && (nodeDepth >= LARGE_IMPORT_COLLAPSE_DEPTH || node.childrenIds.length > LARGE_IMPORT_FANOUT_COLLAPSE_LIMIT)
        ? 'collapsed'
        : 'normal',
      position: { x: ROOT_X, y: ROOT_Y },
      shortDefinition: node.shortDefinition,
      meta: node.meta || quoteItems.length > 0
        ? {
            ...(node.meta ?? {}),
            ...(quoteItems.length > 0
              ? {
                  knowledgeTags: [createQuoteTag(timestamp)],
                  knowledgeItems: quoteItems
                }
              : {})
          }
        : undefined
    }
  })

  const collapsedNodeIds = new Set(
    Object.values(nodes)
      .filter((node) => node.status === 'collapsed')
      .map((node) => node.id)
  )
  let rootTop = ROOT_Y
  rootNodeIds.forEach((rootNodeId) => {
    const span = getSubtreeSpan(parsedNodes, rootNodeId, collapsedNodeIds)
    const rootCenterY = rootTop + Math.min(span / 2, MAX_INITIAL_CENTER_OFFSET)
    layoutSubtree(parsedNodes, nodes, rootNodeId, 0, rootCenterY, MAX_INITIAL_CENTER_OFFSET, collapsedNodeIds)
    rootTop += span + ROOT_VERTICAL_GAP
  })

  const linkedQuoteText = Object.values(parsedNodes)
    .flatMap((node) => node.quotes)
    .filter(Boolean)
    .join('\n\n')

  const maxDepth = Object.keys(parsedNodes).reduce((depth, nodeId) => Math.max(depth, getNodeDepth(parsedNodes, nodeId) + 1), 0)
  const quoteCount = Object.values(parsedNodes).reduce((total, node) => {
    const structuredQuoteCount = Array.isArray(node.meta?.knowledgeItems)
      ? node.meta.knowledgeItems.filter((item) => item.contentType === 'quote' || item.tagId === 'quote').length
      : 0
    return total + (structuredQuoteCount || Array.from(new Set(node.quotes)).length)
  }, 0)

  if (Object.keys(parsedNodes).length <= 1) {
    warnings.push('只解析到 1 个节点，请检查 MD 是否使用 # 标题或列表层级表达结构。')
  }

  return {
    title,
    nodes,
    rootNodeIds,
    linkedQuoteText,
    summary: {
      nodeCount: Object.keys(nodes).length,
      rootNodeCount: rootNodeIds.length,
      quoteCount,
      maxDepth,
      warnings
    }
  }
}
