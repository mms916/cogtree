import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, SyntheticEvent } from 'react'
import { Extension } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  Bold,
  Bookmark,
  BriefcaseBusiness,
  Calendar,
  Check,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Filter,
  Grid2X2,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  MessageSquareText,
  MoreHorizontal,
  Palette,
  Plus,
  Quote,
  Redo2,
  Share2,
  Target,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from 'lucide-react'

import type {
  BaseNode,
  NodeKnowledgeItem,
  NodeKnowledgeTag,
  NodeNote,
} from '../../stores/useDocumentStore'
import { getImageFilesFromClipboard, readImageFile } from './imageAttachments'

type LinkedQuoteItem = {
  id: string
  text: string
  title?: string
  page?: string
}

interface NodeKnowledgePanelProps {
  selectedNode: BaseNode
  linkedQuotes: LinkedQuoteItem[]
  onClose: () => void
  onUpdateLabel: (label: string) => void
  onUpdateNotes?: (notes: NodeNote[]) => void
  onUpdateMeta?: (meta: Record<string, unknown>) => void
  style?: CSSProperties
}

type KnowledgeDraft = {
  title: string
  content: string
  contentHtml: string
}

type InspirationCategory = {
  name: string
  color: string
}

type TagMenuState = {
  x: number
  y: number
  tagId: string
} | null

type TagDialogState =
  | { type: 'create-generic'; value: string }
  | { type: 'delete'; tagId: string }
  | null

type KnowledgeRichEditorProps = {
  initialHtml: string
  placeholder: string
  compact?: boolean
  onChange: (payload: { html: string; text: string }) => void
}

const PANEL_MIN_WIDTH = 380
const PANEL_MAX_WIDTH = 820
const PANEL_DEFAULT_WIDTH = 460
const DEFAULT_TEXT_COLOR = '#e2e8f0'
const DEFAULT_RECENT_TEXT_COLORS = ['#f8fafc', '#2dd4bf', '#60a5fa', '#f87171']
const KNOWLEDGE_FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32]
const INSPIRATION_CATEGORY_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#f59e0b', '#f472b6', '#60a5fa']
const DEFAULT_INSPIRATION_CATEGORIES: InspirationCategory[] = [
  { name: '\u601d\u8003\u65b9\u5411', color: INSPIRATION_CATEGORY_COLORS[0] },
  { name: '\u884c\u52a8\u7075\u611f', color: INSPIRATION_CATEGORY_COLORS[1] },
  { name: '\u65b9\u6cd5\u63a2\u7d22', color: INSPIRATION_CATEGORY_COLORS[2] },
]
const TAG_TEMPLATES: NodeKnowledgeTag[] = [
  {
    id: 'quote',
    name: '金句',
    kind: 'quote',
    type: 'system',
    systemKey: 'quote',
    isFixed: true,
    color: '#2dd4bf',
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'reflection',
    name: '\u7406\u89e3\u548c\u611f\u609f',
    kind: 'reflection',
    type: 'custom',
    isFixed: false,
    color: '#8b5cf6',
    sortOrder: 1,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'inspiration',
    name: '灵感',
    kind: 'inspiration',
    type: 'custom',
    isFixed: false,
    color: '#38bdf8',
    sortOrder: 2,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'case',
    name: '案例',
    kind: 'case',
    type: 'custom',
    isFixed: false,
    color: '#f59e0b',
    sortOrder: 3,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'question',
    name: '追问',
    kind: 'question',
    type: 'custom',
    isFixed: false,
    color: '#22d3ee',
    sortOrder: 4,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'action',
    name: '行动',
    kind: 'action',
    type: 'custom',
    isFixed: false,
    color: '#10b981',
    sortOrder: 5,
    createdAt: 0,
    updatedAt: 0,
  },
]

const DEFAULT_TAG_IDS = new Set(['quote', 'reflection'])
const PROTECTED_TAG_IDS = new Set(['quote'])
const DEFAULT_TAGS = TAG_TEMPLATES.filter((tag) => DEFAULT_TAG_IDS.has(tag.id))
const CASE_PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=420&q=80',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=420&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=420&q=80',
]
const KNOWLEDGE_TEXT_COLORS = [
  '#f8fafc',
  '#e2e8f0',
  '#cbd5e1',
  '#94a3b8',
  '#64748b',
  '#2dd4bf',
  '#14b8a6',
  '#38bdf8',
  '#0ea5e9',
  '#60a5fa',
  '#3b82f6',
  '#818cf8',
  '#6366f1',
  '#a78bfa',
  '#8b5cf6',
  '#f472b6',
  '#ec4899',
  '#fb7185',
  '#f87171',
  '#ef4444',
  '#fb923c',
  '#f59e0b',
  '#facc15',
  '#a3e635',
  '#84cc16',
  '#4ade80',
  '#34d399',
]

const KNOWLEDGE_QUOTE_BACKGROUNDS = [
  'rgba(15, 23, 42, 0.58)',
  'rgba(30, 41, 59, 0.6)',
  'rgba(45, 212, 191, 0.08)',
  'rgba(59, 130, 246, 0.1)',
  'rgba(99, 102, 241, 0.1)',
  'rgba(139, 92, 246, 0.1)',
  'rgba(245, 158, 11, 0.1)',
  'rgba(239, 68, 68, 0.1)',
  'rgba(20, 184, 166, 0.14)',
  'rgba(51, 65, 85, 0.72)',
]

const LEGACY_TEXT_REPAIRS: Record<string, string> = {
  '閲戝彞': '金句',
  '鐏垫劅': '灵感',
  '妗堜緥': '案例',
  '杩介棶': '追问',
  '琛屽姩': '行动',
  '鏂扮殑鐏垫劅': '新的灵感',
  '鏂扮殑杩介棶': '新的追问',
  '鏂扮殑琛屽姩': '新的行动',
  '鏈懡鍚嶇悊瑙�': '未命名理解',
  '鏈懡鍚嶆渚�': '未命名案例',
  '閫氱敤': '通用',
}

function repairLegacyText(value?: string) {
  if (!value) return value ?? ''
  return LEGACY_TEXT_REPAIRS[value] ?? value
}

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
})

const QuoteBlockStyle = Extension.create({
  name: 'quoteBlockStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['blockquote'],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || element.getAttribute('data-quote-bg') || null,
            renderHTML: (attributes) => {
              if (!attributes.backgroundColor) return {}
              return {
                'data-quote-bg': attributes.backgroundColor,
                style: `background-color: ${attributes.backgroundColor}`,
              }
            },
          },
        },
      },
    ]
  },
})

function clampPanelWidth(width: number) {
  return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, Math.round(width)))
}

function getPanelWidthFromStyle(style?: CSSProperties) {
  const width = style?.width
  if (typeof width === 'number') return clampPanelWidth(width)
  if (typeof width === 'string') {
    const parsed = Number.parseFloat(width)
    if (Number.isFinite(parsed)) return clampPanelWidth(parsed)
  }
  return PANEL_DEFAULT_WIDTH
}

function createKnowledgeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function plainTextToHtml(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
  if (paragraphs.length === 0) return '<p></p>'
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('')
}

function normalizeEditorHtml(html: string) {
  return html.trim() || '<p></p>'
}

function getPlainTextFromHtml(html: string) {
  if (!html || html === '<p></p>') return ''
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const element = document.createElement('div')
  element.innerHTML = html
  return element.textContent?.trim() ?? ''
}

function getNoteHtml(note: NodeNote) {
  return note.contentHtml || plainTextToHtml(note.content)
}

function getDefaultTitle(tag: NodeKnowledgeTag) {
  if (tag.kind === 'quote') return ''
  if (tag.kind === 'reflection') return '\u672a\u547d\u540d\u7406\u89e3'
  if (tag.kind === 'inspiration') return '灵感'
  if (tag.kind === 'case') return '\u672a\u547d\u540d\u6848\u4f8b'
  if (tag.kind === 'question') return '新的追问'
  if (tag.kind === 'action') return '新的行动'
  return `未命名${tag.name}`
}

function isDefaultQuoteTitle(title?: string) {
  const normalized = title?.trim()
  return !normalized || normalized === '补充金句'
}

function getDefaultHtml(tag: NodeKnowledgeTag) {
  if (tag.kind === 'inspiration') return '<p></p>'
  if (tag.kind === 'case') return '<p>记录案例背景、发生链条和结论。</p>'
  if (tag.kind === 'question') return '<p>这个节点背后还需要继续追问什么？</p>'
  if (tag.kind === 'action') return '<p>把这个节点转化成一个可以执行的小行动。</p>'
  if (tag.kind === 'quote') return '<p></p>'
  return '<p></p>'
}

function getKnowledgeTags(meta: BaseNode['meta']): NodeKnowledgeTag[] {
  const storedTags = Array.isArray(meta?.knowledgeTags) ? meta?.knowledgeTags as Partial<NodeKnowledgeTag>[] : []
  const merged = new Map<string, NodeKnowledgeTag>()

  DEFAULT_TAGS.forEach((tag) => merged.set(tag.id, tag))
  storedTags.forEach((tag) => {
    if (!tag.id || !tag.name) return
    const fallback = merged.get(tag.id)
    merged.set(tag.id, {
      id: tag.id,
      name: repairLegacyText(tag.name),
      kind: tag.kind ?? fallback?.kind ?? 'custom',
      type: tag.type ?? fallback?.type ?? 'custom',
      systemKey: tag.systemKey ?? fallback?.systemKey,
      isFixed: tag.isFixed ?? fallback?.isFixed ?? false,
      color: tag.color ?? fallback?.color ?? '#2dd4bf',
      sortOrder: typeof tag.sortOrder === 'number' ? tag.sortOrder : fallback?.sortOrder ?? merged.size,
      createdAt: typeof tag.createdAt === 'number' ? tag.createdAt : Date.now(),
      updatedAt: typeof tag.updatedAt === 'number' ? tag.updatedAt : Date.now(),
    })
  })

  return Array.from(merged.values()).sort((a, b) => a.sortOrder - b.sortOrder)
}

function getKnowledgeItems(selectedNode: BaseNode): NodeKnowledgeItem[] {
  const storedItems = Array.isArray(selectedNode.meta?.knowledgeItems)
    ? selectedNode.meta?.knowledgeItems as Partial<NodeKnowledgeItem>[]
    : []

  if (storedItems.length > 0) {
    return storedItems
      .filter((item): item is Partial<NodeKnowledgeItem> & { id: string; tagId: string } => Boolean(item.id && item.tagId))
      .map((item) => ({
        id: item.id,
        tagId: item.tagId,
        contentType: item.contentType ?? 'custom',
        title: repairLegacyText(item.title) || '\u672a\u547d\u540d\u5185\u5bb9',
        content: item.content ?? item.plainText ?? '',
        contentHtml: item.contentHtml,
        plainText: item.plainText ?? item.content ?? getPlainTextFromHtml(item.contentHtml ?? ''),
        summary: item.summary,
        sourceBookName: item.sourceBookName,
        sourcePage: item.sourcePage,
        tags: item.tags,
        status: item.status,
        priority: item.priority,
        progress: item.progress,
        dueDate: item.dueDate,
        imageSrc: item.imageSrc,
        imageAlt: item.imageAlt,
        chain: item.chain,
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
      }))
  }

  const notes = selectedNode.meta?.notes ?? []
  return notes.map((note) => ({
    id: note.id,
    tagId: 'reflection',
    contentType: 'reflection',
    title: repairLegacyText(note.title) || '节点知识',
    content: note.content,
    contentHtml: getNoteHtml(note),
    plainText: note.content,
    createdAt: note.createdAt,
    updatedAt: note.createdAt,
  }))
}

function getInspirationCategories(meta: BaseNode['meta']): InspirationCategory[] {
  if (!Array.isArray(meta?.inspirationCategories)) return DEFAULT_INSPIRATION_CATEGORIES
  const stored = meta.inspirationCategories
  const normalized = stored
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const name = repairLegacyText(entry.trim())
        if (!name) return null
        return { name, color: INSPIRATION_CATEGORY_COLORS[index % INSPIRATION_CATEGORY_COLORS.length] }
      }
      if (entry && typeof entry === 'object') {
        const record = entry as Partial<InspirationCategory>
        const name = typeof record.name === 'string' ? repairLegacyText(record.name.trim()) : ''
        if (!name) return null
        return {
          name,
          color: typeof record.color === 'string' && record.color.trim()
            ? record.color
            : INSPIRATION_CATEGORY_COLORS[index % INSPIRATION_CATEGORY_COLORS.length],
        }
      }
      return null
    })
    .filter((category): category is InspirationCategory => Boolean(category))

  return normalized
}

function getInspirationCategoryColor(categories: InspirationCategory[], name?: string) {
  const categoryName = name?.trim()
  if (!categoryName) return INSPIRATION_CATEGORY_COLORS[0]
  return categories.find((category) => category.name === categoryName)?.color ?? INSPIRATION_CATEGORY_COLORS[0]
}

function toLegacyNotes(items: NodeKnowledgeItem[]): NodeNote[] {
  return items
    .filter((item) => item.tagId === 'reflection' || item.contentType === 'reflection')
    .map((item) => ({
      id: item.id,
      title: item.title,
      content: item.plainText ?? item.content,
      contentHtml: item.contentHtml ?? plainTextToHtml(item.content),
      createdAt: item.createdAt,
    }))
}

function KnowledgeRichEditor({ initialHtml, placeholder, compact = false, onChange }: KnowledgeRichEditorProps) {
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null)
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false)
  const [isQuoteBgPaletteOpen, setIsQuoteBgPaletteOpen] = useState(false)
  const [recentTextColors, setRecentTextColors] = useState(DEFAULT_RECENT_TEXT_COLORS)
  const [recentQuoteBackgrounds, setRecentQuoteBackgrounds] = useState(KNOWLEDGE_QUOTE_BACKGROUNDS.slice(0, 4))
  const [activeTextColor, setActiveTextColor] = useState(DEFAULT_TEXT_COLOR)
  const [activeQuoteBackground, setActiveQuoteBackground] = useState(KNOWLEDGE_QUOTE_BACKGROUNDS[0])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      QuoteBlockStyle,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
    ],
    content: initialHtml || '<p></p>',
    editorProps: {
      attributes: {
        class: 'knowledge-rich-editor-content knowledge-card-editor-content',
        'data-placeholder': placeholder,
      },
      handlePaste: (_view, event) => {
        const files = getImageFilesFromClipboard(event.clipboardData)
        if (files.length === 0) return false
        event.preventDefault()
        void insertImages(files)
        return true
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          event.stopPropagation()
          return false
        },
        mousedown: (_view, event) => {
          event.stopPropagation()
          return false
        },
        pointerdown: (_view, event) => {
          event.stopPropagation()
          return false
        },
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange({
        html: normalizeEditorHtml(activeEditor.getHTML()),
        text: activeEditor.getText().trim(),
      })
    },
  })

  const runCommand = (event: ReactMouseEvent, command: () => void) => {
    event.preventDefault()
    event.stopPropagation()
    command()
  }

  const applyTextColor = (color: string) => {
    if (!editor) return
    setActiveTextColor(color)
    setRecentTextColors((current) => [color, ...current.filter((item) => item !== color)].slice(0, 8))
    editor.chain().focus().setColor(color).run()
  }

  const clearTextColor = () => {
    if (!editor) return
    setActiveTextColor(DEFAULT_TEXT_COLOR)
    editor.chain().focus().unsetColor().run()
    setIsColorPaletteOpen(false)
  }

  const applyFontSize = (fontSize: string) => {
    if (!editor) return
    editor.chain().focus().setMark('textStyle', { fontSize: fontSize ? `${fontSize}px` : null }).run()
  }

  const applyQuoteBackground = (color: string) => {
    if (!editor) return
    setActiveQuoteBackground(color)
    setRecentQuoteBackgrounds((current) => [color, ...current.filter((item) => item !== color)].slice(0, 6))
    const chain = editor.chain().focus()
    if (!editor.isActive('blockquote')) {
      chain.toggleBlockquote()
    }
    chain.updateAttributes('blockquote', { backgroundColor: color }).run()
  }

  const clearQuoteBackground = () => {
    if (!editor) return
    editor.chain().focus().updateAttributes('blockquote', { backgroundColor: null }).run()
    setActiveQuoteBackground(KNOWLEDGE_QUOTE_BACKGROUNDS[0])
    setIsQuoteBgPaletteOpen(false)
  }

  const addLink = () => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('输入链接地址', previousUrl ?? 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const insertImages = async (files: File[]) => {
    if (!editor || files.length === 0) return
    const images = await Promise.all(files.map(readImageFile))
    images.forEach((image) => {
      editor.chain().focus().setImage({ src: image.src, alt: image.name ?? 'image' }).run()
    })
  }

  if (!editor) return null

  return (
    <div className={`knowledge-rich-editor knowledge-card-editor${compact ? ' is-compact' : ''}`}>
      <input
        ref={inlineImageInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          void insertImages(files)
        }}
      />
      <div className="knowledge-rich-toolbar" aria-label="富文本工具栏">
        <div className="knowledge-toolbar-group" aria-label="段落">
          <button type="button" title="正文" className={editor.isActive('paragraph') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().setParagraph().run())}><Type size={14} /></button>
          {!compact && <button type="button" title="一级标题" className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}><Heading1 size={14} /></button>}
          {!compact && <button type="button" title="二级标题" className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}><Heading2 size={14} /></button>}
        </div>
        <div className="knowledge-toolbar-group" aria-label="文字格式">
          <button type="button" title="加粗" className={editor.isActive('bold') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleBold().run())}><Bold size={14} /></button>
          <button type="button" title="斜体" className={editor.isActive('italic') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleItalic().run())}><Italic size={14} /></button>
          <button type="button" title="下划线" className={editor.isActive('underline') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleUnderline().run())}><UnderlineIcon size={14} /></button>
          {!compact && <button type="button" className="knowledge-toolbar-text-btn" title="大号字体" onMouseDown={(event) => runCommand(event, () => editor.chain().focus().setMark('textStyle', { fontSize: '18px' }).run())}>大</button>}
          {!compact && <button type="button" className="knowledge-toolbar-text-btn" title="正常字体" onMouseDown={(event) => runCommand(event, () => editor.chain().focus().setMark('textStyle', { fontSize: null }).run())}>正</button>}
          {!compact && (
            <select
              className="knowledge-rich-font-size"
              title="字号"
              defaultValue=""
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => applyFontSize(event.currentTarget.value)}
            >
              <option value="">字号</option>
              <option value="">默认</option>
              {KNOWLEDGE_FONT_SIZES.map((size) => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          )}
          <div className="knowledge-rich-color-wrap" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={`knowledge-rich-color-trigger ${isColorPaletteOpen ? 'is-active' : ''}`}
              title="文字颜色"
              onMouseDown={(event) => runCommand(event, () => {
                setIsQuoteBgPaletteOpen(false)
                setIsColorPaletteOpen((current) => !current)
              })}
            >
              <Palette size={14} />
              <span style={{ background: activeTextColor }} />
            </button>
            {isColorPaletteOpen && (
              <div className="knowledge-rich-color-popover" onMouseDown={(event) => event.stopPropagation()}>
                <div className="knowledge-rich-color-section">
                  <div className="knowledge-rich-color-label">最近使用</div>
                  <div className="knowledge-rich-color-grid is-recent">
                    {recentTextColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={color === activeTextColor ? 'is-active' : ''}
                        title={color}
                        style={{ '--swatch-color': color } as CSSProperties}
                        onMouseDown={(event) => runCommand(event, () => applyTextColor(color))}
                      />
                    ))}
                  </div>
                </div>
                <div className="knowledge-rich-color-section">
                  <div className="knowledge-rich-color-label">推荐颜色</div>
                  <div className="knowledge-rich-color-grid">
                    {KNOWLEDGE_TEXT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={color === activeTextColor ? 'is-active' : ''}
                        title={color}
                        style={{ '--swatch-color': color } as CSSProperties}
                        onMouseDown={(event) => runCommand(event, () => applyTextColor(color))}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="knowledge-rich-color-clear"
                  onMouseDown={(event) => runCommand(event, clearTextColor)}
                >
                  恢复默认
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="knowledge-toolbar-group" aria-label="结构">
          <button type="button" title="无序列表" className={editor.isActive('bulletList') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleBulletList().run())}><List size={14} /></button>
          {!compact && <button type="button" title="有序列表" className={editor.isActive('orderedList') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleOrderedList().run())}><ListOrdered size={14} /></button>}
          <button type="button" title="引用" className={editor.isActive('blockquote') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleBlockquote().run())}><Quote size={14} /></button>
          {!compact && (
            <div className="knowledge-rich-color-wrap" onMouseDown={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={`knowledge-rich-color-trigger knowledge-rich-quote-bg-trigger ${isQuoteBgPaletteOpen ? 'is-active' : ''}`}
                title="引用底色"
                onMouseDown={(event) => runCommand(event, () => {
                  setIsColorPaletteOpen(false)
                  setIsQuoteBgPaletteOpen((current) => !current)
                })}
              >
                <Quote size={14} />
                <span style={{ background: activeQuoteBackground }} />
              </button>
              {isQuoteBgPaletteOpen && (
                <div className="knowledge-rich-color-popover knowledge-rich-quote-bg-popover" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="knowledge-rich-color-section">
                    <div className="knowledge-rich-color-label">最近使用</div>
                    <div className="knowledge-rich-color-grid is-recent">
                      {recentQuoteBackgrounds.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={color === activeQuoteBackground ? 'is-active' : ''}
                          title={color}
                          style={{ '--swatch-color': color } as CSSProperties}
                          onMouseDown={(event) => runCommand(event, () => applyQuoteBackground(color))}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="knowledge-rich-color-section">
                    <div className="knowledge-rich-color-label">引用底色</div>
                    <div className="knowledge-rich-color-grid">
                      {KNOWLEDGE_QUOTE_BACKGROUNDS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={color === activeQuoteBackground ? 'is-active' : ''}
                          title={color}
                          style={{ '--swatch-color': color } as CSSProperties}
                          onMouseDown={(event) => runCommand(event, () => applyQuoteBackground(color))}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="knowledge-rich-color-clear"
                    onMouseDown={(event) => runCommand(event, clearQuoteBackground)}
                  >
                    恢复默认
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="knowledge-toolbar-group" aria-label="插入">
          <button type="button" title="链接" className={editor.isActive('link') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, addLink)}><Link2 size={14} /></button>
          {!compact && <button type="button" title="插入图片" onMouseDown={(event) => runCommand(event, () => inlineImageInputRef.current?.click())}><ImagePlus size={14} /></button>}
        </div>
        {!compact && (
          <div className="knowledge-toolbar-group knowledge-toolbar-history" aria-label="历史记录">
            <button type="button" title="撤销" disabled={!editor.can().undo()} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().undo().run())}><Undo2 size={14} /></button>
            <button type="button" title="重做" disabled={!editor.can().redo()} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().redo().run())}><Redo2 size={14} /></button>
          </div>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

export function NodeKnowledgePanel({
  selectedNode,
  linkedQuotes,
  onClose,
  onUpdateLabel,
  onUpdateMeta,
  style,
}: NodeKnowledgePanelProps) {
  const [panelWidth, setPanelWidth] = useState(() => getPanelWidthFromStyle(style))
  const [activeTagId, setActiveTagId] = useState('quote')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draft, setDraft] = useState<KnowledgeDraft>({ title: '', content: '', contentHtml: '<p></p>' })
  const [inspirationDraft, setInspirationDraft] = useState('')
  const [newInspirationCategory, setNewInspirationCategory] = useState('')
  const [tagMenu, setTagMenu] = useState<TagMenuState>(null)
  const [quoteActionMenuId, setQuoteActionMenuId] = useState<string | null>(null)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagDraft, setEditingTagDraft] = useState('')
  const [tagDialog, setTagDialog] = useState<TagDialogState>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const latestPanelWidthRef = useRef(panelWidth)
  const hasUserResizedRef = useRef(false)

  const tags = useMemo(() => getKnowledgeTags(selectedNode.meta), [selectedNode.id, selectedNode.meta?.knowledgeTags])
  const items = useMemo(() => getKnowledgeItems(selectedNode), [selectedNode.id, selectedNode.meta?.knowledgeItems, selectedNode.meta?.notes])
  const inspirationCategories = useMemo(() => getInspirationCategories(selectedNode.meta), [selectedNode.id, selectedNode.meta?.inspirationCategories])
  const activeTag = tags.find((tag) => tag.id === activeTagId) ?? tags[0]
  const activeItems = activeTag ? items.filter((item) => item.tagId === activeTag.id) : []

  useEffect(() => {
    setActiveTagId('quote')
    setEditingItemId(null)
    setQuoteActionMenuId(null)
    setDraft({ title: '', content: '', contentHtml: '<p></p>' })
    setInspirationDraft('')
    setNewInspirationCategory('')
  }, [selectedNode.id])

  useEffect(() => {
    if (!tags.some((tag) => tag.id === activeTagId)) {
      setActiveTagId(tags[0]?.id ?? 'quote')
    }
  }, [activeTagId, tags])

  useEffect(() => {
    if (!hasUserResizedRef.current) {
      const nextWidth = getPanelWidthFromStyle(style)
      latestPanelWidthRef.current = nextWidth
      setPanelWidth(nextWidth)
    }
  }, [style?.width])

  useEffect(() => {
    latestPanelWidthRef.current = panelWidth
  }, [panelWidth])

  const persistKnowledgeState = (nextTags: NodeKnowledgeTag[], nextItems: NodeKnowledgeItem[]) => {
    const legacyNotes = toLegacyNotes(nextItems)
    onUpdateMeta?.({
      knowledgeTags: nextTags,
      knowledgeItems: nextItems,
      notes: legacyNotes,
    })
  }

  const persistInspirationCategories = (nextCategories: InspirationCategory[]) => {
    onUpdateMeta?.({ inspirationCategories: nextCategories })
  }

  const addInspirationCategory = () => {
    const name = newInspirationCategory.trim()
    if (!name || inspirationCategories.some((category) => category.name === name)) return
    const nextCategories = [
      ...inspirationCategories,
      {
        name,
        color: INSPIRATION_CATEGORY_COLORS[inspirationCategories.length % INSPIRATION_CATEGORY_COLORS.length],
      },
    ]
    persistInspirationCategories(nextCategories)
    setNewInspirationCategory('')
  }

  const deleteInspirationCategory = (name: string) => {
    const nextCategories = inspirationCategories.filter((category) => category.name !== name)
    persistInspirationCategories(nextCategories)
  }

  const createInspirationFromDraft = (category: string) => {
    if (!activeTag || activeTag.kind !== 'inspiration') return
    const content = inspirationDraft.trim()
    if (!content) return
    const now = Date.now()
    const newItem: NodeKnowledgeItem = {
      id: createKnowledgeId('inspiration'),
      tagId: activeTag.id,
      contentType: 'inspiration',
      title: category,
      content,
      contentHtml: plainTextToHtml(content),
      plainText: content,
      tags: [category],
      createdAt: now,
      updatedAt: now,
    }
    persistKnowledgeState(tags, [newItem, ...items])
    setInspirationDraft('')
    setEditingItemId(null)
    setQuoteActionMenuId(null)
  }

  const startCreateItem = () => {
    const now = Date.now()
    const newItem: NodeKnowledgeItem = {
      id: createKnowledgeId(activeTag.kind),
      tagId: activeTag.id,
      contentType: activeTag.kind,
      title: getDefaultTitle(activeTag),
      content: '',
      contentHtml: getDefaultHtml(activeTag),
      plainText: '',
      tags: activeTag.kind === 'inspiration'
        ? ['\u601d\u8003\u65b9\u5411']
        : activeTag.kind === 'question'
          ? ['\u6a21\u5f0f\u89c9\u5bdf']
          : activeTag.kind === 'case'
            ? ['\u56e0\u679c\u94fe']
            : [],
      status: activeTag.kind === 'action' || activeTag.kind === 'question' ? 'todo' : undefined,
      priority: activeTag.kind === 'action' ? 'medium' : undefined,
      progress: activeTag.kind === 'action' ? 0 : undefined,
      dueDate: activeTag.kind === 'action' ? new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : undefined,
      imageSrc: activeTag.kind === 'case' ? CASE_PLACEHOLDER_IMAGES[items.filter((item) => item.contentType === 'case').length % CASE_PLACEHOLDER_IMAGES.length] : undefined,
      imageAlt: activeTag.kind === 'case' ? '案例图片' : undefined,
      chain: activeTag.kind === 'case' ? ['触发因素', '过程变化', '结果'] : undefined,
      createdAt: now,
      updatedAt: now,
    }
    persistKnowledgeState(tags, [newItem, ...items])
    setEditingItemId(newItem.id)
    setQuoteActionMenuId(null)
    setDraft({
      title: newItem.title,
      content: '',
      contentHtml: newItem.contentHtml ?? '<p></p>',
    })
  }

  const startEditItem = (item: NodeKnowledgeItem) => {
    setEditingItemId(item.id)
    setQuoteActionMenuId(null)
    setDraft({
      title: item.title,
      content: item.plainText ?? item.content,
      contentHtml: item.contentHtml ?? plainTextToHtml(item.content),
    })
  }

  const cancelEditItem = () => {
    const editingItem = items.find((item) => item.id === editingItemId)
    const isEmptyNewItem = editingItem && !editingItem.plainText && !editingItem.content && !editingItem.contentHtml?.replace(/<[^>]+>/g, '').trim()
    if (isEmptyNewItem) {
      persistKnowledgeState(tags, items.filter((item) => item.id !== editingItem.id))
    }
    setEditingItemId(null)
    setQuoteActionMenuId(null)
    setDraft({ title: '', content: '', contentHtml: '<p></p>' })
  }

  const saveEditItem = () => {
    if (!editingItemId) return
    const now = Date.now()
    const nextItems = items.map((item) => {
      if (item.id !== editingItemId) return item
      const plainText = draft.content || getPlainTextFromHtml(draft.contentHtml)
      const nextTitle = item.contentType === 'quote' ? draft.title.trim() : draft.title.trim() || getDefaultTitle(activeTag)
      return {
        ...item,
        title: nextTitle,
        content: plainText,
        contentHtml: normalizeEditorHtml(draft.contentHtml || plainTextToHtml(plainText)),
        plainText,
        tags: item.contentType === 'inspiration' ? [nextTitle] : item.tags,
        updatedAt: now,
      }
    })
    persistKnowledgeState(tags, nextItems)
    setEditingItemId(null)
    setQuoteActionMenuId(null)
  }

  const deleteItem = (itemId: string) => {
    persistKnowledgeState(tags, items.filter((item) => item.id !== itemId))
    if (editingItemId === itemId) {
      setEditingItemId(null)
    }
    if (quoteActionMenuId === itemId) {
      setQuoteActionMenuId(null)
    }
  }

  const startRenameTag = (tag: NodeKnowledgeTag) => {
    setEditingTagId(tag.id)
    setEditingTagDraft(tag.name)
    setTagMenu(null)
  }

  const saveRenameTag = () => {
    if (!editingTagId) return
    const name = editingTagDraft.trim()
    if (!name) {
      setEditingTagId(null)
      return
    }
    const nextTags = tags.map((current) => current.id === editingTagId
      ? { ...current, name, updatedAt: Date.now() }
      : current
    )
    persistKnowledgeState(nextTags, items)
    setEditingTagId(null)
    setEditingTagDraft('')
  }

  const cancelRenameTag = () => {
    setEditingTagId(null)
    setEditingTagDraft('')
  }

  const deleteTag = (tag: NodeKnowledgeTag) => {
    if (PROTECTED_TAG_IDS.has(tag.id) || tag.isFixed) {
      return
    }
    setTagMenu(null)
    setTagDialog({ type: 'delete', tagId: tag.id })
  }

  const confirmDeleteTag = () => {
    if (tagDialog?.type !== 'delete') return
    const tag = tags.find((current) => current.id === tagDialog.tagId)
    if (!tag || PROTECTED_TAG_IDS.has(tag.id) || tag.isFixed) {
      setTagDialog(null)
      return
    }
    const nextTags = tags.filter((current) => current.id !== tag.id)
    const nextItems = items.filter((item) => item.tagId !== tag.id)
    persistKnowledgeState(nextTags, nextItems)
    setActiveTagId(nextTags[0]?.id ?? 'quote')
    setTagDialog(null)
  }

  const addTagFromTemplate = (template: NodeKnowledgeTag) => {
    if (tags.some((tag) => tag.id === template.id)) {
      setActiveTagId(template.id)
      return
    }
    const now = Date.now()
    const nextTag = {
      ...template,
      sortOrder: tags.length,
      createdAt: now,
      updatedAt: now,
    }
    persistKnowledgeState([...tags, nextTag], items)
    setActiveTagId(nextTag.id)
  }

  const addGenericTag = () => {
    setTagMenu(null)
    setTagDialog({ type: 'create-generic', value: '通用' })
  }

  const confirmAddGenericTag = () => {
    if (tagDialog?.type !== 'create-generic') return
    const name = tagDialog.value.trim()
    if (!name) return
    const now = Date.now()
    const nextTag: NodeKnowledgeTag = {
      id: createKnowledgeId('tag'),
      name,
      kind: 'custom',
      type: 'custom',
      isFixed: false,
      color: '#34d399',
      sortOrder: tags.length,
      createdAt: now,
      updatedAt: now,
    }
    persistKnowledgeState([...tags, nextTag], items)
    setActiveTagId(nextTag.id)
    setTagDialog(null)
  }

  const stopPanelEvent = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  const openTagMenu = (event: ReactMouseEvent<HTMLElement>, tagId: string) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = panelRef.current?.getBoundingClientRect()
    setTagMenu({
      x: rect ? event.clientX - rect.left : event.clientX,
      y: rect ? event.clientY - rect.top : event.clientY,
      tagId,
    })
  }

  const startPanelResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    hasUserResizedRef.current = true
    const startX = event.clientX
    const startWidth = latestPanelWidthRef.current
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    let isResizing = true
    let latestWidth = startWidth

    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    const applyWidth = (width: number) => {
      latestWidth = clampPanelWidth(width)
      latestPanelWidthRef.current = latestWidth
      if (panelRef.current) {
        panelRef.current.style.width = `${latestWidth}px`
      }
    }

    const stopResize = () => {
      if (!isResizing) return
      isResizing = false
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', stopResize)
      window.removeEventListener('blur', stopResize)
      setPanelWidth(latestWidth)
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      applyWidth(startWidth + startX - moveEvent.clientX)
      if (moveEvent.buttons === 0) {
        stopResize()
      }
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: false })
    document.addEventListener('mouseup', stopResize)
    window.addEventListener('blur', stopResize, { once: true })
  }

  const renderItemEditor = (item: NodeKnowledgeItem) => {
    const compact = item.contentType === 'inspiration'
    const isQuoteItem = item.contentType === 'quote'
    return (
      <div className="knowledge-item-editor">
        <input
          className={`knowledge-item-title-input${isQuoteItem ? ' is-source' : ''}`}
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder={isQuoteItem ? '\u2014\u2014\u300a\u4e66\u540d\u300b\uff0c\u7b2c x \u9875' : '\u6807\u9898'}
        />
        {compact ? (
          <textarea
            className="knowledge-quick-textarea"
            value={draft.content}
            onChange={(event) => {
              const text = event.target.value
              setDraft((current) => ({ ...current, content: text, contentHtml: plainTextToHtml(text) }))
            }}
            placeholder="快速记录一个想法、问题或启发..."
          />
        ) : (
          <KnowledgeRichEditor
            key={item.id}
            initialHtml={draft.contentHtml}
            placeholder={
              item.contentType === 'case'
                ? '记录案例描述、因果链和结论...'
                : item.contentType === 'custom'
                  ? '输入内容...'
                  : '输入你的理解和感悟...'
            }
            onChange={(payload) => setDraft((current) => ({ ...current, content: payload.text, contentHtml: payload.html }))}
          />
        )}
        <div className="knowledge-item-editor-actions">
          <button type="button" onClick={cancelEditItem}>取消</button>
          <button type="button" className="is-primary" onClick={saveEditItem}><Check size={14} /> 保存</button>
        </div>
      </div>
    )
  }

  const updateItemPatch = (itemId: string, patch: Partial<NodeKnowledgeItem>) => {
    const nextItems = items.map((item) => item.id === itemId ? { ...item, ...patch, updatedAt: Date.now() } : item)
    persistKnowledgeState(tags, nextItems)
  }

  const formatItemTime = (time: number) => new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const getTagCount = (tag: NodeKnowledgeTag) => {
    const itemCount = items.filter((item) => item.tagId === tag.id).length
    return tag.kind === 'quote' ? linkedQuotes.length + itemCount : itemCount
  }

  const renderPanelToolbar = () => (
    <header className="knowledge-workbench-header">
      <div className="knowledge-workbench-titlebar">
        <label className="knowledge-workbench-title">
          <span className="knowledge-node-index">{typeof selectedNode.orderIndex === 'number' ? String(selectedNode.orderIndex).padStart(2, '0') : '00'}</span>
          <input
            value={selectedNode.label}
            onChange={(event) => onUpdateLabel(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.nativeEvent.isComposing) return
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
            placeholder="节点标题"
          />
        </label>
        <div className="knowledge-workbench-title-actions">
          <button
            type="button"
            className="knowledge-workbench-close"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
            title="关闭面板"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        className="knowledge-workbench-tabs"
        onContextMenu={(event) => openTagMenu(event, activeTag?.id ?? 'quote')}
      >
        {tags.map((tag) => {
          const active = activeTag?.id === tag.id
          const isEditingTag = editingTagId === tag.id
          return (
            <div
              key={tag.id}
              className={`knowledge-workbench-tab${active ? ' is-active' : ''}`}
              style={{ '--tag-color': tag.color } as CSSProperties}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isEditingTag) return
                setActiveTagId(tag.id)
                setEditingItemId(null)
                setTagMenu(null)
              }}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                startRenameTag(tag)
              }}
              onContextMenu={(event) => {
                setActiveTagId(tag.id)
                openTagMenu(event, tag.id)
              }}
            >
              {isEditingTag ? (
                <input
                  className="knowledge-workbench-tab-input"
                  value={editingTagDraft}
                  autoFocus
                  onChange={(event) => setEditingTagDraft(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.stopPropagation()}
                  onBlur={saveRenameTag}
                  onKeyDown={(event) => {
                    event.stopPropagation()
                    if (event.nativeEvent.isComposing) return
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      saveRenameTag()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelRenameTag()
                    }
                  }}
                />
              ) : (
                <>
                  <span>{tag.name}</span>
                  <strong>{getTagCount(tag)}</strong>
                </>
              )}
            </div>
          )
        })}
      </div>
    </header>
  )

  const renderQuotePage = () => {
    const sourceQuote = linkedQuotes[0]
    const relatedQuotes = linkedQuotes.slice(1)
    const customQuotes = activeItems

    return (
      <section className="knowledge-page knowledge-page-quotes has-sticky-action">
        <div className="knowledge-page-scroll">
          {sourceQuote && (
            <div className="knowledge-section-block">
              <div className="knowledge-section-heading">源句（来自书籍原文）</div>
              <article className="knowledge-quote-feature">
                <Quote size={26} className="knowledge-quote-mark is-left" />
                <p>{sourceQuote.text}</p>
                <small>{[sourceQuote.title, sourceQuote.page].filter(Boolean).join('\uff0c')}</small>
                <Quote size={26} className="knowledge-quote-mark is-right" />
              </article>
            </div>
          )}

          <div className="knowledge-section-block">
            <div className="knowledge-section-heading">相关金句</div>
            <div className="knowledge-quote-list">
              {relatedQuotes.map((quote, index) => (
                <article key={quote.id} className="knowledge-quote-row">
                  <Quote size={22} />
                  <div>
                    <p>{quote.text}</p>
                    <small>{[quote.title, quote.page].filter(Boolean).join('\uff0c') || `\u76f8\u5173\u91d1\u53e5 ${index + 1}`}</small>
                  </div>
                </article>
              ))}

              {customQuotes.map((item) => {
                const isEditing = editingItemId === item.id
                const sourceTitle = isDefaultQuoteTitle(item.title) ? '' : item.title
                return (
                  <article key={item.id} className={`knowledge-quote-row is-editable${isEditing ? ' is-editing' : ''}`}>
                    {isEditing ? (
                      renderItemEditor(item)
                    ) : (
                      <>
                        <Quote size={22} />
                        <div>
                          <div className="knowledge-rich-display" dangerouslySetInnerHTML={{ __html: item.contentHtml ?? plainTextToHtml(item.content) }} />
                          <small>{[sourceTitle, formatItemTime(item.updatedAt)].filter(Boolean).join('\uff0c')}</small>
                        </div>
                        <div className="knowledge-quote-row-actions">
                          <button
                            type="button"
                            className="knowledge-quote-more"
                            title="更多操作"
                            onClick={(event) => {
                              event.stopPropagation()
                              setQuoteActionMenuId((current) => current === item.id ? null : item.id)
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {quoteActionMenuId === item.id && (
                            <div className="knowledge-quote-action-menu">
                              <button type="button" onClick={() => startEditItem(item)}>编辑</button>
                              <button type="button" className="is-danger" onClick={() => deleteItem(item.id)}><Trash2 size={13} /> 删除</button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        </div>

        <div className="knowledge-sticky-add">
          <button type="button" className="knowledge-workbench-add" onClick={startCreateItem}><Plus size={16} /> 新增金句</button>
          <div className="knowledge-workbench-count">共 {linkedQuotes.length + customQuotes.length} 条金句</div>
        </div>
      </section>
    )
  }

  const renderReflectionPage = () => (
    <section className="knowledge-page knowledge-page-reflection has-sticky-action">
      <div className="knowledge-page-scroll">
      <div className="knowledge-card-list">
        {activeItems.map((item) => {
          const isEditing = editingItemId === item.id
          return (
            <article key={item.id} className="knowledge-reflection-card">
              {isEditing ? (
                renderItemEditor(item)
              ) : (
                <>
                  <div className="knowledge-card-head">
                    <strong><MessageSquareText size={17} /> {item.title}</strong>
                    <div className="knowledge-quote-row-actions">
                      <button
                        type="button"
                        className="knowledge-quote-more"
                        title="更多操作"
                        onClick={(event) => {
                          event.stopPropagation()
                          setQuoteActionMenuId((current) => current === item.id ? null : item.id)
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {quoteActionMenuId === item.id && (
                        <div className="knowledge-quote-action-menu">
                          <button type="button" onClick={() => startEditItem(item)}>编辑</button>
                          <button type="button" className="is-danger" onClick={() => deleteItem(item.id)}><Trash2 size={13} /> 删除</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="knowledge-rich-display" dangerouslySetInnerHTML={{ __html: item.contentHtml ?? plainTextToHtml(item.content) }} />
                  <small>创建于 {formatItemTime(item.createdAt)}</small>
                </>
              )}
            </article>
          )
        })}
      </div>
      </div>
      <div className="knowledge-sticky-add">
      <button type="button" className="knowledge-workbench-add" onClick={startCreateItem}>
        <Plus size={16} /> {activeTag?.kind === 'custom' ? `\u65b0\u5efa${activeTag.name}` : '\u65b0\u5efa\u7406\u89e3\u548c\u611f\u609f'}
      </button>
      <div className="knowledge-workbench-count">&#20849; {activeItems.length} &#26465;&#29702;&#35299;</div>
      </div>
    </section>
  )

  const renderInspirationPageV2 = () => (
    <section className="knowledge-page knowledge-page-inspiration">
      <div className="knowledge-inspiration-capture">
        <Lightbulb size={18} />
        <textarea
          className="knowledge-inspiration-input"
          value={inspirationDraft}
          onChange={(event) => setInspirationDraft(event.target.value)}
          placeholder="快速记录你的灵感..."
          rows={2}
          onDoubleClick={(event) => event.currentTarget.focus()}
        />
        <div className="knowledge-inspiration-tags" aria-label="灵感分类">
          {inspirationCategories.map((category) => (
            <span
              key={category.name}
              className="knowledge-inspiration-tag-wrap"
              style={{ '--inspiration-color': category.color } as CSSProperties}
            >
              <button
                type="button"
                className="knowledge-inspiration-tag"
                disabled={!inspirationDraft.trim()}
                onClick={() => createInspirationFromDraft(category.name)}
              >
                {category.name}
              </button>
              <button
                type="button"
                className="knowledge-inspiration-tag-remove"
                title="删除标签"
                onClick={() => deleteInspirationCategory(category.name)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <span className="knowledge-inspiration-tag-add">
            <input
              value={newInspirationCategory}
              onChange={(event) => setNewInspirationCategory(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.nativeEvent.isComposing) return
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addInspirationCategory()
                }
              }}
              placeholder="新增标签"
            />
            <button type="button" onClick={addInspirationCategory}><Plus size={12} /></button>
          </span>
        </div>
      </div>
      <div className="knowledge-page-toolbar">
        <strong>灵感记录 · {activeItems.length}</strong>
        <div>
          <button type="button"><Filter size={14} /> 筛选</button>
          <button type="button"><Grid2X2 size={14} /></button>
        </div>
      </div>
      <div className="knowledge-inspiration-grid">
        {activeItems.map((item) => {
          const isEditing = editingItemId === item.id
          const categoryName = item.title || item.tags?.[0] || '\u601d\u8003\u65b9\u5411'
          const categoryColor = getInspirationCategoryColor(inspirationCategories, categoryName)
          return (
            <article
              key={item.id}
              className="knowledge-inspiration-card"
              style={{ '--inspiration-color': categoryColor } as CSSProperties}
            >
              {isEditing ? renderItemEditor(item) : (
                <>
                  <div className="knowledge-inspiration-meta">
                    <span>{categoryName}</span>
                    <div className="knowledge-quote-row-actions">
                      <button
                        type="button"
                        className="knowledge-quote-more"
                        title="更多操作"
                        onClick={(event) => {
                          event.stopPropagation()
                          setQuoteActionMenuId((current) => current === item.id ? null : item.id)
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {quoteActionMenuId === item.id && (
                        <div className="knowledge-quote-action-menu">
                          <button type="button" onClick={() => startEditItem(item)}>编辑</button>
                          <button type="button" className="is-danger" onClick={() => deleteItem(item.id)}><Trash2 size={13} /> 删除</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p>{item.plainText || item.content || '新的灵感'}</p>
                  <div className="knowledge-chip-row">
                    {(item.tags ?? ['\u601d\u8003\u65b9\u5411']).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                </>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )

  const renderCasePage = () => (
    <section className="knowledge-page knowledge-page-case">
      <div className="knowledge-case-list">
        {activeItems.map((item, index) => {
          const isEditing = editingItemId === item.id
          return (
            <article key={item.id} className="knowledge-case-card">
              {isEditing ? renderItemEditor(item) : (
                <>
                  <div className="knowledge-case-media">
                    {item.imageSrc ? <img src={item.imageSrc} alt={item.imageAlt ?? item.title} /> : <BriefcaseBusiness size={28} />}
                  </div>
                  <div className="knowledge-case-body">
                    <div className="knowledge-card-head">
                      <strong><span>案例 {String(index + 1).padStart(2, '0')}</span>{item.title}</strong>
                      <div>
                        <button type="button"><Bookmark size={15} /></button>
                        <button type="button"><Share2 size={15} /></button>
                        <button type="button" onClick={() => startEditItem(item)}><MoreHorizontal size={16} /></button>
                      </div>
                    </div>
                    <p>{item.plainText || item.content || '\u8bb0\u5f55\u6848\u4f8b\u80cc\u666f\u3001\u53d1\u751f\u94fe\u8def\u548c\u7ed3\u8bba\u3002'}</p>
                    <div className="knowledge-chain-row">
                      {(item.chain && item.chain.length > 0 ? item.chain : ['会议准备不足', '会议延期', '信息同步滞后', '决策延迟']).map((step, stepIndex, array) => (
                        <span key={`${step}-${stepIndex}`}>{step}{stepIndex < array.length - 1 && <em>→</em>}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </article>
          )
        })}
      </div>
      <button type="button" className="knowledge-workbench-add" onClick={startCreateItem}><Plus size={16} /> 新建案例</button>
      <div className="knowledge-workbench-count">共 {activeItems.length} 个案例</div>
    </section>
  )

  const renderQuestionPage = () => (
    <section className="knowledge-page knowledge-page-question">
      <div className="knowledge-page-toolbar">
        <strong><CircleHelp size={18} /> 追问</strong>
        <div>
          <button type="button">按创建时间</button>
          <button type="button"><List size={14} /></button>
        </div>
      </div>
      <div className="knowledge-question-list">
        {activeItems.map((item, index) => {
          const isEditing = editingItemId === item.id
          return (
            <article key={item.id} className="knowledge-question-row">
              {isEditing ? renderItemEditor(item) : (
                <>
                  <span className="knowledge-node-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.plainText || item.content || '\u7ee7\u7eed\u62c6\u89e3\u8fd9\u4e2a\u8282\u70b9\u80cc\u540e\u7684\u539f\u56e0\u3001\u6761\u4ef6\u6216\u53cd\u4f8b\u3002'}</p>
                    <div className="knowledge-chip-row">
                      <span className={`is-status-${item.status ?? 'todo'}`}>{item.status === 'done' ? '\u5df2\u601d\u8003' : item.status === 'active' ? '\u8fdb\u884c\u4e2d' : '\u5f85\u601d\u8003'}</span>
                      {(item.tags ?? ['模式觉察']).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  </div>
                  <div className="knowledge-row-actions">
                    <button type="button" onClick={() => updateItemPatch(item.id, { status: item.status === 'done' ? 'todo' : 'done' })}><CheckCircle2 size={14} /> {item.status === 'done' ? '\u53d6\u6d88\u6807\u8bb0' : '\u6807\u8bb0\u5df2\u601d\u8003'}</button>
                    <button type="button" onClick={() => {
                      const actionTag = tags.find((tag) => tag.id === 'action')
                      if (!actionTag) return
                      updateItemPatch(item.id, { tagId: actionTag.id, contentType: 'action', status: 'todo', priority: 'medium', progress: 0 })
                      setActiveTagId(actionTag.id)
                    }}><ClipboardCheck size={14} /> 转为行动</button>
                    <button type="button" onClick={() => startEditItem(item)}>继续拆解</button>
                    <button type="button" onClick={() => deleteItem(item.id)}><MoreHorizontal size={15} /></button>
                  </div>
                </>
              )}
            </article>
          )
        })}
      </div>
      <button type="button" className="knowledge-workbench-add" onClick={startCreateItem}><Plus size={16} /> 新建追问</button>
    </section>
  )

  const renderActionPage = () => {
    const doneCount = activeItems.filter((item) => item.status === 'done').length
    const progress = activeItems.length === 0 ? 0 : Math.round(doneCount / activeItems.length * 100)
    return (
      <section className="knowledge-page knowledge-page-action">
        <div className="knowledge-action-goal">
          <div>
            <strong><Target size={18} /> 行动目标</strong>
            <p>将因果洞察转化为具体行动，打破模式，建立新的回应方式。</p>
          </div>
          <div className="knowledge-progress-ring" style={{ '--progress': `${progress}%` } as CSSProperties}>
            <span>{progress}%</span>
          </div>
          <small>{doneCount} / {activeItems.length} 已完成</small>
        </div>
        <div className="knowledge-action-list">
          {activeItems.map((item) => {
            const isEditing = editingItemId === item.id
            return (
              <article key={item.id} className="knowledge-action-row">
                {isEditing ? renderItemEditor(item) : (
                  <>
                    <button
                      type="button"
                      className={`knowledge-check${item.status === 'done' ? ' is-checked' : ''}`}
                      onClick={() => updateItemPatch(item.id, { status: item.status === 'done' ? 'todo' : 'done', progress: item.status === 'done' ? 0 : 100 })}
                    >
                      {item.status === 'done' && <Check size={13} />}
                    </button>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.plainText || item.content || '\u63cf\u8ff0\u8fd9\u4e00\u6b65\u884c\u52a8\u3002'}</p>
                      <div className="knowledge-progress-bar"><span style={{ width: `${Math.max(0, Math.min(100, item.progress ?? 0))}%` }} /></div>
                    </div>
                    <div className="knowledge-action-meta">
                      <span><Calendar size={14} /> {item.dueDate ?? '\u672a\u8bbe\u7f6e'}</span>
                      <em className={`is-priority-${item.priority ?? 'medium'}`}>{item.priority === 'high' ? '\u9ad8' : item.priority === 'low' ? '\u4f4e' : '\u4e2d'}</em>
                      <button type="button" onClick={() => startEditItem(item)}>编辑</button>
                    </div>
                  </>
                )}
              </article>
            )
          })}
        </div>
        <button type="button" className="knowledge-workbench-add is-dashed" onClick={startCreateItem}><Plus size={16} /> 添加子行动</button>
        <button type="button" className="knowledge-workbench-add" onClick={startCreateItem}><Plus size={16} /> 新建行动</button>
      </section>
    )
  }

  const renderTagContextMenu = () => {
    if (!tagMenu) return null
    const menuTag = tags.find((tag) => tag.id === tagMenu.tagId) ?? activeTag
    if (!menuTag) return null
    const existingIds = new Set(tags.map((tag) => tag.id))
    const templateOptions = TAG_TEMPLATES.filter((tag) => tag.id !== 'quote')

    return (
      <div
        className="knowledge-tag-menu"
        style={{ left: tagMenu.x, top: tagMenu.y } as CSSProperties}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <div className="knowledge-tag-menu-title">{menuTag.name}</div>
        <button type="button" onClick={() => {
          startRenameTag(menuTag)
          setTagMenu(null)
        }}>
          重命名标签
        </button>
        <button
          type="button"
          disabled={PROTECTED_TAG_IDS.has(menuTag.id) || menuTag.isFixed}
          onClick={() => {
            deleteTag(menuTag)
            setTagMenu(null)
          }}
        >
          删除标签
        </button>
        <div className="knowledge-tag-menu-separator" />
        <div className="knowledge-tag-menu-add">
          <span>新增标签</span>
          <div className="knowledge-tag-menu-submenu">
            {templateOptions.map((template) => {
              const exists = existingIds.has(template.id)
              return (
                <button
                  key={template.id}
                  type="button"
                  disabled={exists}
                  style={{ '--tag-color': template.color } as CSSProperties}
                  onClick={() => {
                    addTagFromTemplate(template)
                    setTagMenu(null)
                  }}
                >
                  {template.name}
                </button>
              )
            })}
            <button
              type="button"
              style={{ '--tag-color': '#34d399' } as CSSProperties}
              onClick={() => {
                addGenericTag()
                setTagMenu(null)
              }}
            >
              通用
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderTagDialog = () => {
    if (!tagDialog) return null
    const deletingTag = tagDialog.type === 'delete'
      ? tags.find((tag) => tag.id === tagDialog.tagId)
      : null

    return (
      <div
        className="knowledge-dialog-overlay"
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="knowledge-dialog"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {tagDialog.type === 'create-generic' ? (
            <>
              <div className="knowledge-dialog-head">
                <strong>新增通用标签</strong>
                <button type="button" onClick={() => setTagDialog(null)}><X size={16} /></button>
              </div>
              <p>通用标签用于纯富文本记录，不绑定特殊结构。</p>
              <input
                className="knowledge-dialog-input"
                value={tagDialog.value}
                autoFocus
                onChange={(event) => setTagDialog({ type: 'create-generic', value: event.target.value })}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.nativeEvent.isComposing) return
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    confirmAddGenericTag()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setTagDialog(null)
                  }
                }}
              />
              <div className="knowledge-dialog-actions">
                <button type="button" onClick={() => setTagDialog(null)}>取消</button>
                <button type="button" className="is-primary" onClick={confirmAddGenericTag}>确定</button>
              </div>
            </>
          ) : (
            <>
              <div className="knowledge-dialog-head">
                <strong>删除标签</strong>
                <button type="button" onClick={() => setTagDialog(null)}><X size={16} /></button>
              </div>
              <p>删除标签“{deletingTag?.name ?? '当前标签'}”？该标签下的内容会一起删除。</p>
              <div className="knowledge-dialog-actions">
                <button type="button" onClick={() => setTagDialog(null)}>取消</button>
                <button type="button" className="is-danger" onClick={confirmDeleteTag}>删除</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  const renderActivePage = () => {
    if (!activeTag) return null
    if (activeTag.kind === 'quote') return renderQuotePage()
    if (activeTag.kind === 'reflection') return renderReflectionPage()
    if (activeTag.kind === 'inspiration') return renderInspirationPageV2()
    if (activeTag.kind === 'case') return renderCasePage()
    if (activeTag.kind === 'question') return renderQuestionPage()
    if (activeTag.kind === 'action') return renderActionPage()
    return renderReflectionPage()
  }

  return (
    <div
      ref={panelRef}
      className="node-knowledge-panel knowledge-workbench"
      style={{
        ...style,
        width: panelWidth,
      }}
      onMouseDown={stopPanelEvent}
      onMouseUp={stopPanelEvent}
      onPointerDown={stopPanelEvent}
      onPointerUp={stopPanelEvent}
      onClick={stopPanelEvent}
      onDoubleClick={stopPanelEvent}
      onKeyDown={stopPanelEvent}
      onPaste={(event) => {
        const files = getImageFilesFromClipboard(event.clipboardData)
        if (files.length === 0) return
        event.stopPropagation()
      }}
    >
      <div
        className="knowledge-panel-resize-handle"
        title="拖动调整面板宽度"
        onMouseDown={startPanelResize}
      />

      {renderPanelToolbar()}
      <main className="knowledge-workbench-content" onClick={() => setQuoteActionMenuId(null)}>
        {renderActivePage()}
      </main>
      {renderTagContextMenu()}
      {renderTagDialog()}
    </div>
  )
}
