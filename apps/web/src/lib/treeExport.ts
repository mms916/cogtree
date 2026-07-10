import type { BaseNode, NodeKnowledgeItem, NodeKnowledgeTag, NodeNote } from '../stores/useDocumentStore'

const ROOT_WIDTH = 174
const ROOT_HEIGHT = 58
const BRANCH_WIDTH = 208
const BRANCH_HEIGHT = 50
const LEAF_HEIGHT = 28
const LEAF_MIN_WIDTH = 40
const LEAF_MAX_WIDTH = 220
const ROOT_TEXT_MAX_WIDTH = ROOT_WIDTH - 36
const BRANCH_TEXT_MAX_WIDTH = BRANCH_WIDTH - 58
const LEAF_LINE_HEIGHT = 24
const ROOT_LINE_HEIGHT = 23
const BRANCH_LINE_HEIGHT = 22
const NODE_MARGIN = 96
const BRANCH_COLORS = ['#8b5cf6', '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#6366f1']

type ExportBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type MarkdownExportOptions = {
  title?: string
  includeKnowledge?: boolean
  linkedQuoteText?: string
}

export type ImageExportResolution = '2k' | '4k'

const IMAGE_EXPORT_MAX_SIDE: Record<ImageExportResolution, number> = {
  '2k': 2048,
  '4k': 4096
}

const NODE_TYPE_LABELS: Record<BaseNode['nodeType'], string> = {
  concept: '概念',
  cause: '原因',
  effect: '结果',
  abstract: '抽象',
  pending: '待定'
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 60) || 'cogtree'
}

function getDepth(nodes: Record<string, BaseNode>, nodeId: string) {
  let depth = 0
  let currentNode = nodes[nodeId]

  while (currentNode?.parentId) {
    depth += 1
    currentNode = nodes[currentNode.parentId]
  }

  return depth
}

function getBranchIndex(nodes: Record<string, BaseNode>, nodeId: string) {
  let currentNode = nodes[nodeId]
  let branchNode = currentNode

  while (currentNode?.parentId) {
    branchNode = currentNode
    currentNode = nodes[currentNode.parentId]
  }

  return Math.max(0, branchNode?.orderIndex ?? 0)
}

function estimateTextWidth(value: string, fontSize: number) {
  return Array.from(value).reduce((width, char) => {
    if (/\s/.test(char)) return width + fontSize * 0.35
    if (/[\u0000-\u007f]/.test(char)) return width + fontSize * 0.58
    return width + fontSize
  }, 0)
}

function wrapText(value: string, maxWidth: number, fontSize: number) {
  const normalizedLines = value.trim().split(/\r?\n/)
  const lines = normalizedLines.flatMap((rawLine) => {
    const sourceLine = rawLine.trim()
    if (!sourceLine) return ['']

    const wrappedLines: string[] = []
    let currentLine = ''

    Array.from(sourceLine).forEach((char) => {
      const candidate = currentLine ? `${currentLine}${char}` : char
      if (currentLine && estimateTextWidth(candidate, fontSize) > maxWidth) {
        wrappedLines.push(currentLine)
        currentLine = char
      } else {
        currentLine = candidate
      }
    })

    if (currentLine) wrappedLines.push(currentLine)
    return wrappedLines.length > 0 ? wrappedLines : ['']
  })

  return lines.length > 0 ? lines : ['']
}

function getNodeTextLayout(nodes: Record<string, BaseNode>, nodeId: string) {
  const node = nodes[nodeId]
  const depth = getDepth(nodes, nodeId)
  const label = node ? getNodeTitle(node) : ''

  if (depth === 0) {
    return {
      lines: wrapText(label, ROOT_TEXT_MAX_WIDTH, 17),
      fontSize: 17,
      lineHeight: ROOT_LINE_HEIGHT,
      maxWidth: ROOT_TEXT_MAX_WIDTH,
    }
  }

  if (depth === 1) {
    return {
      lines: wrapText(label, BRANCH_TEXT_MAX_WIDTH, 15),
      fontSize: 15,
      lineHeight: BRANCH_LINE_HEIGHT,
      maxWidth: BRANCH_TEXT_MAX_WIDTH,
    }
  }

  return {
    lines: wrapText(label, LEAF_MAX_WIDTH, 16),
    fontSize: 16,
    lineHeight: LEAF_LINE_HEIGHT,
    maxWidth: LEAF_MAX_WIDTH,
  }
}

function getNodeSize(nodes: Record<string, BaseNode>, nodeId: string) {
  const node = nodes[nodeId]
  if (!node) return { width: LEAF_MIN_WIDTH, height: LEAF_HEIGHT }

  const imageSize = node?.meta?.canvasImage === true ? node.meta.imageSize : null
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

  const noteSize = node?.meta?.canvasNote === true ? node.meta.noteSize : null
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

  const depth = getDepth(nodes, nodeId)
  const textLayout = getNodeTextLayout(nodes, nodeId)
  if (depth === 0) {
    return {
      width: ROOT_WIDTH,
      height: Math.max(ROOT_HEIGHT, textLayout.lines.length * textLayout.lineHeight + 24)
    }
  }
  if (depth === 1) {
    return {
      width: BRANCH_WIDTH,
      height: Math.max(BRANCH_HEIGHT, textLayout.lines.length * textLayout.lineHeight + 18)
    }
  }

  return {
    width: Math.max(
      LEAF_MIN_WIDTH,
      Math.min(LEAF_MAX_WIDTH, Math.ceil(Math.max(...textLayout.lines.map((line) => estimateTextWidth(line, 16)))) + 4)
    ),
    height: Math.max(LEAF_HEIGHT, textLayout.lines.length * LEAF_LINE_HEIGHT)
  }
}

function getNodeColor(nodes: Record<string, BaseNode>, nodeId: string) {
  const node = nodes[nodeId]
  const metaColor = typeof node?.meta?.edgeColor === 'string' ? node.meta.edgeColor : null
  return metaColor ?? BRANCH_COLORS[getBranchIndex(nodes, nodeId) % BRANCH_COLORS.length]
}

function collectBounds(nodes: Record<string, BaseNode>, rootNodeIds: string[]): ExportBounds {
  const ids = rootNodeIds.length > 0 ? Object.keys(nodes) : []
  if (ids.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 480 }
  }

  return ids.reduce<ExportBounds>((bounds, nodeId) => {
    const node = nodes[nodeId]
    if (!node) return bounds
    const size = getNodeSize(nodes, nodeId)

    return {
      minX: Math.min(bounds.minX, node.position.x),
      minY: Math.min(bounds.minY, node.position.y),
      maxX: Math.max(bounds.maxX, node.position.x + size.width),
      maxY: Math.max(bounds.maxY, node.position.y + size.height)
    }
  }, {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY
  })
}

function renderTextLines(options: {
  lines: string[]
  x: number
  y: number
  fill: string
  fontSize: number
  fontWeight: number
  lineHeight: number
}) {
  const firstLineY = options.y - ((options.lines.length - 1) * options.lineHeight) / 2
  const tspans = options.lines
    .map((line, index) => (
      `<tspan x="${options.x}" y="${firstLineY + index * options.lineHeight}">${escapeXml(line)}</tspan>`
    ))
    .join('')

  return `<text text-anchor="middle" dominant-baseline="middle" fill="${options.fill}" font-size="${options.fontSize}" font-weight="${options.fontWeight}" font-family="Inter, Arial, sans-serif">${tspans}</text>`
}

function getNodeTitle(node: BaseNode) {
  return node.label.trim() || '未命名节点'
}

function normalizeNote(note: NodeNote) {
  const title = note.title.trim()
  const content = note.content.trim()
  if (title && content) return `- ${title}\n  ${content.split('\n').join('\n  ')}`
  if (title) return `- ${title}`
  if (content) return `- ${content.split('\n').join('\n  ')}`
  return ''
}

function htmlToMarkdownText(html: string | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?(p|div|section|article|span)[^>]*>/gi, '')
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gis, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gis, '*$1*')
    .replace(/<u[^>]*>(.*?)<\/u>/gis, '$1')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_match: string, content: string): string => {
      const text: string = htmlToMarkdownText(content)
      return text.split('\n').map((line: string) => `> ${line}`).join('\n')
    })
    .replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '')
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '![]($1)')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getKnowledgeItemText(item: NodeKnowledgeItem): string {
  return (item.plainText?.trim() || item.content?.trim() || htmlToMarkdownText(item.contentHtml)).trim()
}

function normalizeKnowledgeItem(item: NodeKnowledgeItem): string {
  const title = item.title.trim()
  const content = getKnowledgeItemText(item)
  if (title && content) return `- ${title}\n  ${content.split('\n').join('\n  ')}`
  if (title) return `- ${title}`
  if (content) return `- ${content.split('\n').join('\n  ')}`
  return ''
}

function getKnowledgeSections(node: BaseNode): Array<{ title: string; items: string[] }> {
  const tags = Array.isArray(node.meta?.knowledgeTags) ? node.meta.knowledgeTags : []
  const items = Array.isArray(node.meta?.knowledgeItems) ? node.meta.knowledgeItems : []
  if (items.length === 0) return []

  const knownTags = new Map<string, NodeKnowledgeTag>()
  tags.forEach((tag) => knownTags.set(tag.id, tag))

  const grouped = new Map<string, NodeKnowledgeItem[]>()
  items.forEach((item) => {
    const list = grouped.get(item.tagId) ?? []
    list.push(item)
    grouped.set(item.tagId, list)
  })

  const orderedTagIds = [
    ...tags
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((tag) => tag.id),
    ...Array.from(grouped.keys()).filter((tagId) => !knownTags.has(tagId)),
  ]

  return orderedTagIds
    .map((tagId) => {
      const tag = knownTags.get(tagId)
      const tagItems = grouped.get(tagId) ?? []
      const itemTexts = tagItems.map(normalizeKnowledgeItem).filter(Boolean)
      return {
        title: tag?.name ?? '未分类',
        items: itemTexts,
      }
    })
    .filter((section) => section.items.length > 0)
}

function encodeKnowledgeMetadata(node: BaseNode) {
  const knowledgeTags = Array.isArray(node.meta?.knowledgeTags) ? node.meta.knowledgeTags : []
  const knowledgeItems = Array.isArray(node.meta?.knowledgeItems) ? node.meta.knowledgeItems : []
  const notes = Array.isArray(node.meta?.notes) ? node.meta.notes : []
  const inspirationCategories = Array.isArray(node.meta?.inspirationCategories) ? node.meta.inspirationCategories : []
  if (knowledgeTags.length === 0 && knowledgeItems.length === 0 && notes.length === 0 && inspirationCategories.length === 0) {
    return ''
  }
  return encodeURIComponent(JSON.stringify({
    knowledgeTags,
    knowledgeItems,
    notes,
    inspirationCategories,
  }))
}

function walkOutlineMarkdown(nodes: Record<string, BaseNode>, nodeId: string, depth = 0): string[] {
  const node = nodes[nodeId]
  if (!node) return []

  const indent = '  '.repeat(depth)
  return [
    `${indent}- ${getNodeTitle(node)}`,
    ...node.childrenIds.flatMap((childId) => walkOutlineMarkdown(nodes, childId, depth + 1))
  ]
}

function walkKnowledgeMarkdown(
  nodes: Record<string, BaseNode>,
  nodeId: string,
  depth = 0,
  linkedQuoteText?: string
): string[] {
  const node = nodes[nodeId]
  if (!node) return []

  const headingLevel = Math.min(depth + 2, 6)
  const notes = node.meta?.notes ?? []
  const knowledgeSections = getKnowledgeSections(node)
  const encodedKnowledgeMetadata = encodeKnowledgeMetadata(node)
  const lines = [
    `<!-- cogtree-node-depth: ${depth} -->`,
    `${'#'.repeat(headingLevel)} ${getNodeTitle(node)}`,
    ...(encodedKnowledgeMetadata ? [`<!-- cogtree-knowledge: ${encodedKnowledgeMetadata} -->`] : []),
    '',
    `- 节点类型：${NODE_TYPE_LABELS[node.nodeType] ?? node.nodeType}`,
    `- 重要节点：${node.meta?.isImportant === true ? '是' : '否'}`
  ]

  if (node.shortDefinition?.trim()) {
    lines.push(`- 简短定义：${node.shortDefinition.trim()}`)
  }

  if (linkedQuoteText?.trim() && depth === 0) {
    lines.push('', '关联金句：', '', `> ${linkedQuoteText.trim().replace(/\n/g, '\n> ')}`)
  }

  if (knowledgeSections.length > 0) {
    lines.push('', '节点知识：', '')
    knowledgeSections.forEach((section) => {
      lines.push(`### ${section.title}`, '')
      section.items.forEach((itemText) => lines.push(itemText))
      lines.push('')
    })
  } else if (notes.length > 0) {
    lines.push('', '思考与感悟：', '')
    notes.map(normalizeNote).filter(Boolean).forEach((noteText) => {
      lines.push(noteText)
    })
  }

  lines.push('')

  node.childrenIds.forEach((childId) => {
    lines.push(...walkKnowledgeMarkdown(nodes, childId, depth + 1))
  })

  return lines
}

export function buildTreeMarkdown(
  nodes: Record<string, BaseNode>,
  rootNodeIds: string[],
  options: MarkdownExportOptions = {}
) {
  const title = options.title?.trim() || 'CogTree 导图'
  const lines = [`# ${title}`, '']
  const contentLines = options.includeKnowledge
    ? rootNodeIds.flatMap((rootNodeId) => walkKnowledgeMarkdown(nodes, rootNodeId, 0, options.linkedQuoteText))
    : rootNodeIds.flatMap((rootNodeId) => walkOutlineMarkdown(nodes, rootNodeId))

  if (contentLines.length === 0) {
    lines.push('- 暂无节点')
  } else {
    lines.push(...contentLines)
  }

  lines.push('')
  return lines.join('\n')
}

export function downloadMarkdownFile(
  nodes: Record<string, BaseNode>,
  rootNodeIds: string[],
  options: MarkdownExportOptions = {}
) {
  const markdown = buildTreeMarkdown(nodes, rootNodeIds, options)
  const title = options.title ?? 'cogtree'
  const suffix = options.includeKnowledge ? '-knowledge' : '-outline'
  downloadBlob(`${sanitizeFilename(title)}${suffix}.md`, new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
}

function buildTreeSvg(nodes: Record<string, BaseNode>, rootNodeIds: string[], title = 'CogTree 导图') {
  const bounds = collectBounds(nodes, rootNodeIds)
  const offsetX = NODE_MARGIN - bounds.minX
  const offsetY = NODE_MARGIN - bounds.minY
  const width = Math.max(800, bounds.maxX - bounds.minX + NODE_MARGIN * 2)
  const height = Math.max(480, bounds.maxY - bounds.minY + NODE_MARGIN * 2)
  const visibleNodes = rootNodeIds.length > 0 ? Object.values(nodes) : []

  const grid = `
    <defs>
      <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="#1e334a" opacity="0.72" />
      </pattern>
      <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#22d3ee" flood-opacity="0.2" />
      </filter>
    </defs>
  `

  const edges = visibleNodes.flatMap((node) => node.childrenIds.map((childId) => {
    const child = nodes[childId]
    if (!child) return ''

    const parentSize = getNodeSize(nodes, node.id)
    const childSize = getNodeSize(nodes, childId)
    const color = getNodeColor(nodes, childId)
    const sourceX = node.position.x + parentSize.width + offsetX
    const sourceY = node.position.y + parentSize.height / 2 + offsetY
    const targetX = child.position.x + offsetX
    const targetY = child.position.y + childSize.height / 2 + offsetY
    const midX = sourceX + Math.max(36, (targetX - sourceX) * 0.42)

    return `<path d="M ${sourceX} ${sourceY} H ${midX} Q ${midX + 14} ${sourceY} ${midX + 14} ${sourceY + (targetY - sourceY) / 2} Q ${midX + 14} ${targetY} ${midX + 28} ${targetY} H ${targetX}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.82" />`
  })).join('\n')

  const nodeMarkup = visibleNodes.map((node) => {
    const depth = getDepth(nodes, node.id)
    const size = getNodeSize(nodes, node.id)
    const textLayout = getNodeTextLayout(nodes, node.id)
    const color = getNodeColor(nodes, node.id)
    const x = node.position.x + offsetX
    const y = node.position.y + offsetY
    const isImportant = node.meta?.isImportant === true
    const textColor = isImportant ? '#ff6b6b' : '#e8f0ff'
    const strokeColor = isImportant ? '#ff6b6b' : color
    const nodeImages = node.meta?.nodeImages ?? []

    if (node.meta?.canvasImage === true && nodeImages.length > 0) {
      const padding = 8
      const contentX = x + padding
      const contentY = y + padding
      const contentWidth = Math.max(1, size.width - padding * 2)
      const contentHeight = Math.max(1, size.height - padding * 2)

      return `
        <rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" rx="8" fill="#090b10" stroke="${strokeColor}" stroke-width="1.5" filter="url(#softGlow)" />
        <image href="${escapeXml(nodeImages[0].src)}" x="${contentX}" y="${contentY}" width="${contentWidth}" height="${contentHeight}" preserveAspectRatio="xMidYMid meet" />
      `
    }

    if (depth >= 2) {
      return renderTextLines({
        lines: textLayout.lines,
        x: x + size.width / 2,
        y: y + size.height / 2,
        fill: textColor,
        fontSize: 16,
        fontWeight: 600,
        lineHeight: LEAF_LINE_HEIGHT,
      })
    }

    const iconSpace = depth === 1 ? 34 : 0
    const textCenterX = x + size.width / 2 + iconSpace / 2
    return `
      <rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" rx="8" fill="#111722" stroke="${strokeColor}" stroke-width="${depth === 0 ? 1.8 : 1.5}" filter="url(#softGlow)" />
      ${depth === 1 ? `<circle cx="${x + 26}" cy="${y + size.height / 2}" r="8" fill="none" stroke="#e8f0ff" stroke-width="1.8" opacity="0.95" />` : ''}
      ${renderTextLines({
        lines: textLayout.lines,
        x: textCenterX,
        y: y + size.height / 2,
        fill: textColor,
        fontSize: depth === 0 ? 17 : 15,
        fontWeight: 700,
        lineHeight: depth === 0 ? ROOT_LINE_HEIGHT : BRANCH_LINE_HEIGHT,
      })}
    `
  }).join('\n')

  return {
    width,
    height,
    svg: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${grid}
        <rect width="100%" height="100%" fill="#0b1119" />
        <rect width="100%" height="100%" fill="url(#dots)" />
        <text x="28" y="38" fill="#94a3b8" font-size="14" font-family="Inter, Arial, sans-serif">${escapeXml(title)}</text>
        ${edges}
        ${nodeMarkup}
      </svg>
    `
  }
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadTreeSvg(
  nodes: Record<string, BaseNode>,
  rootNodeIds: string[],
  title?: string
) {
  const { svg } = buildTreeSvg(nodes, rootNodeIds, title)
  downloadBlob(`${sanitizeFilename(title ?? 'cogtree')}.svg`, new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
}

export async function downloadTreeImage(
  nodes: Record<string, BaseNode>,
  rootNodeIds: string[],
  title?: string,
  resolution: ImageExportResolution = '2k'
) {
  const { svg, width, height } = buildTreeSvg(nodes, rootNodeIds, title)
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const imageUrl = URL.createObjectURL(svgBlob)

  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to render export image.'))
      image.src = imageUrl
    })

    const targetMaxSide = IMAGE_EXPORT_MAX_SIDE[resolution]
    const scale = targetMaxSide / Math.max(width, height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available.')

    context.scale(scale, scale)
    context.drawImage(image, 0, 0)

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create PNG blob.'))
      }, 'image/png')
    })

    downloadBlob(`${sanitizeFilename(title ?? 'cogtree')}-${resolution}.png`, pngBlob)
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}
