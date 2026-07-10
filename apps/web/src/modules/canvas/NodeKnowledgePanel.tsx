import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, SyntheticEvent } from 'react'
import { Extension } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'
import { createPortal } from 'react-dom'
import {
  Bold,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
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
  Pencil,
  Plus,
  Quote,
  Redo2,
  Sparkles,
  Target,
  Trash2,
  Type,
  RemoveFormatting,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from 'lucide-react'

import type {
  BaseNode,
  KnowledgeTitleStyle,
  NodeActionStep,
  NodeKnowledgeItem,
  NodeKnowledgeTag,
  NodeNote,
  ActionStatus,
  QuestionStatus,
  QuestionTemplateType,
} from '../../stores/useDocumentStore'
import { useDocumentStore } from '../../stores/useDocumentStore'
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
  focusItemId?: string | null
  onClose: () => void
  onUpdateLabel: (label: string) => void
  onUpdateNotes?: (notes: NodeNote[]) => void
  onUpdateMeta?: (meta: Record<string, unknown>) => void
  style?: CSSProperties
}

type KnowledgeDraft = {
  title: string
  titleStyle?: KnowledgeTitleStyle
  content: string
  contentHtml: string
  chain: string[]
}

type InspirationCategory = {
  name: string
  color: string
}

type QuestionFilter = 'all' | QuestionTemplateType
type ActionFilter = 'all' | 'today' | 'in_progress' | 'todo' | 'done'
type ActionSort = 'dueDate' | 'createdAt' | 'priority'

type QuestionTemplate = {
  type: QuestionTemplateType
  title: string
  description: string
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

type ChainContextMenuState = {
  x: number
  y: number
  index: number
} | null

type ActionMenuState = {
  x: number
  y: number
  itemId: string
} | null

type KnowledgeRichEditorProps = {
  initialHtml: string
  placeholder: string
  compact?: boolean
  titleMode?: boolean
  titleStyle?: KnowledgeTitleStyle
  onTitleStyleChange?: (patch: Partial<KnowledgeTitleStyle>) => void
  onTitleStyleReset?: () => void
  onBodyFocus?: () => void
  onChange: (payload: { html: string; text: string }) => void
}

const PANEL_MIN_WIDTH = 380
const PANEL_MAX_WIDTH = 1120
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
const QUESTION_CATEGORIES: Array<{ id: QuestionFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'causal', label: '因果' },
  { id: 'system', label: '系统' },
  { id: 'completeness', label: '完整性' },
  { id: 'overlap', label: '重叠性' },
  { id: 'level', label: '层级' },
  { id: 'verification', label: '验证' },
]
const QUESTION_STATUS_OPTIONS: Array<{ id: QuestionStatus; label: string }> = [
  { id: 'not_started', label: '未开始' },
  { id: 'to_think', label: '待思考' },
  { id: 'in_progress', label: '进行中' },
  { id: 'to_verify', label: '待验证' },
  { id: 'resolved', label: '已解决' },
  { id: 'converted_to_action', label: '已转行动' },
]
const ACTION_STATUS_OPTIONS: Array<{ id: ActionStatus; label: string }> = [
  { id: 'todo', label: '待开始' },
  { id: 'in_progress', label: '进行中' },
  { id: 'done', label: '已完成' },
  { id: 'delayed', label: '已延期' },
  { id: 'cancelled', label: '已取消' },
]
const ACTION_FILTERS: Array<{ id: ActionFilter; label: string }> = [
  { id: 'all', label: '全部行动' },
  { id: 'today', label: '今日' },
  { id: 'in_progress', label: '进行中' },
  { id: 'todo', label: '待开始' },
  { id: 'done', label: '已完成' },
]
const DEFAULT_QUESTION_TEMPLATES: QuestionTemplate[] = [
  { type: 'causal', title: '这个结果的最近因是什么？', description: '当前出现的结果，最直接的原因是什么？还能继续往前追到更底层的因吗？' },
  { type: 'causal', title: '如果这个因持续存在，会带来什么结果？', description: '从短期、中期、长期推演结果，帮助判断风险与影响。' },
  { type: 'causal', title: '如果改变这个因，会带来哪些新的果？', description: '评估改变当前因之后，结果会如何变化，是否值得优先干预。' },
  { type: 'causal', title: '这个果背后是否有多个并列的因？', description: '检查当前结果是否由多个关键原因共同作用，而不只是单一因。' },
  { type: 'causal', title: '这个因的因是什么？', description: '继续向前追问，找到更深一层的上游原因。' },
  { type: 'causal', title: '这个因与其他因是并列关系，还是因果链关系？', description: '判断节点之间是同层并列，还是前后相继的因果关系。' },
  { type: 'system', title: '它和哪些节点形成反馈循环？', description: '检查节点之间是否存在相互强化或相互抑制的反馈关系。' },
  { type: 'system', title: '它处在什么更大的系统中？', description: '把当前节点放回更大的环境与关系网络中观察。' },
  { type: 'completeness', title: '当前拆分是否遗漏关键因素？', description: '检查是否还有未被纳入、但足以影响结论的重要维度。' },
  { type: 'overlap', title: '这些子节点之间是否有重叠？', description: '检查不同节点是否表达了同一件事，分类标准是否统一。' },
  { type: 'level', title: '这些节点是否处于同一层级？', description: '检查是否把原因、方法、案例或结果混在同一层。' },
  { type: 'verification', title: '我如何验证这个模型在现实中成立？', description: '明确需要观察的现象、案例或数据，让模型能够被检验。' },
  { type: 'verification', title: '有没有反例能推翻或修正这个模型？', description: '主动寻找反例，识别模型成立的边界与需要修正之处。' },
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

function getQuestionType(item: NodeKnowledgeItem): QuestionTemplateType {
  if (item.questionType) return item.questionType
  const matchedCategory = QUESTION_CATEGORIES.find((category) => category.id !== 'all' && item.tags?.includes(category.label))
  return matchedCategory && matchedCategory.id !== 'all' ? matchedCategory.id : 'causal'
}

function getQuestionStatus(status?: NodeKnowledgeItem['status']): QuestionStatus {
  if (status === 'done' || status === 'resolved') return 'resolved'
  if (status === 'active' || status === 'in_progress') return 'in_progress'
  if (status === 'paused' || status === 'to_verify') return 'to_verify'
  if (status === 'converted_to_action') return 'converted_to_action'
  if (status === 'not_started') return 'not_started'
  return 'to_think'
}

function getQuestionCategoryLabel(type: QuestionTemplateType) {
  return QUESTION_CATEGORIES.find((category) => category.id === type)?.label ?? '因果'
}

function getQuestionStatusLabel(status?: NodeKnowledgeItem['status']) {
  const normalized = getQuestionStatus(status)
  return QUESTION_STATUS_OPTIONS.find((option) => option.id === normalized)?.label ?? '待思考'
}

function getDueDateHint(dueDate?: string) {
  if (!dueDate) return '未设置'
  const due = new Date(`${dueDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (days === 0) return '今天'
  if (days > 0) return `${days}天后`
  return `逾期${Math.abs(days)}天`
}

function getActionStatus(status?: NodeKnowledgeItem['status']): ActionStatus {
  if (status === 'done') return 'done'
  if (status === 'active' || status === 'in_progress') return 'in_progress'
  if (status === 'delayed') return 'delayed'
  if (status === 'cancelled' || status === 'paused') return 'cancelled'
  return 'todo'
}

function getActionStatusLabel(status?: NodeKnowledgeItem['status']) {
  const normalized = getActionStatus(status)
  return ACTION_STATUS_OPTIONS.find((option) => option.id === normalized)?.label ?? '待开始'
}

function getActionProgress(item: NodeKnowledgeItem) {
  const steps = item.actionSteps ?? []
  if (steps.length > 0) {
    return Math.round(steps.filter((step) => step.isDone).length / steps.length * 100)
  }
  return Math.max(0, Math.min(100, item.progress ?? (getActionStatus(item.status) === 'done' ? 100 : 0)))
}

function isTodayDate(date?: string) {
  if (!date) return false
  const today = new Date()
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
  return date === localToday
}
const DEFAULT_TAGS = TAG_TEMPLATES.filter((tag) => DEFAULT_TAG_IDS.has(tag.id))
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

const ParagraphLayout = Extension.create({
  name: 'paragraphLayout',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote'],
        attributes: {
          textIndent: {
            default: null,
            parseHTML: (element) => element.style.textIndent || null,
            renderHTML: (attributes) => attributes.textIndent
              ? { style: `text-indent: ${attributes.textIndent}` }
              : {},
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => attributes.lineHeight
              ? { style: `line-height: ${attributes.lineHeight}` }
              : {},
          },
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || null,
            renderHTML: (attributes) => attributes.textAlign
              ? { style: `text-align: ${attributes.textAlign}` }
              : {},
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
  const hasStoredTags = Array.isArray(meta?.knowledgeTags)
  const storedTags = hasStoredTags ? meta?.knowledgeTags as Partial<NodeKnowledgeTag>[] : []
  const merged = new Map<string, NodeKnowledgeTag>()

  if (!hasStoredTags) {
    DEFAULT_TAGS.forEach((tag) => merged.set(tag.id, tag))
  } else {
    DEFAULT_TAGS
      .filter((tag) => PROTECTED_TAG_IDS.has(tag.id))
      .forEach((tag) => merged.set(tag.id, tag))
  }
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
        titleStyle: item.titleStyle,
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
        questionType: item.questionType,
        convertedActionId: item.convertedActionId,
        parentActionId: item.parentActionId,
        linkedQuestionId: item.linkedQuestionId,
        actionSteps: item.actionSteps,
        linkedNodeIds: item.linkedNodeIds,
        linkedQuoteIds: item.linkedQuoteIds,
        linkedCaseIds: item.linkedCaseIds,
        sortOrder: item.sortOrder,
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

function getKnowledgeTitleStyle(style?: KnowledgeTitleStyle): CSSProperties {
  return {
    fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
    color: style?.color,
    fontWeight: style?.bold ? 800 : undefined,
    fontStyle: style?.italic ? 'italic' : undefined,
    textDecoration: style?.underline ? 'underline' : undefined,
    textAlign: style?.textAlign,
    justifyContent: style?.textAlign === 'center'
      ? 'center'
      : style?.textAlign === 'right'
        ? 'flex-end'
        : 'flex-start',
  }
}

function KnowledgeRichEditor({
  initialHtml,
  placeholder,
  compact = false,
  titleMode = false,
  titleStyle,
  onTitleStyleChange,
  onTitleStyleReset,
  onBodyFocus,
  onChange,
}: KnowledgeRichEditorProps) {
  const editorRootRef = useRef<HTMLDivElement | null>(null)
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null)
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false)
  const [isQuoteBgPaletteOpen, setIsQuoteBgPaletteOpen] = useState(false)
  const [recentTextColors, setRecentTextColors] = useState(DEFAULT_RECENT_TEXT_COLORS)
  const [recentQuoteBackgrounds, setRecentQuoteBackgrounds] = useState(KNOWLEDGE_QUOTE_BACKGROUNDS.slice(0, 4))
  const [activeTextColor, setActiveTextColor] = useState(DEFAULT_TEXT_COLOR)
  const [activeQuoteBackground, setActiveQuoteBackground] = useState(KNOWLEDGE_QUOTE_BACKGROUNDS[0])

  useEffect(() => {
    const closePalettes = () => {
      setIsColorPaletteOpen(false)
      setIsQuoteBgPaletteOpen(false)
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!editorRootRef.current?.contains(event.target as Node)) {
        closePalettes()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('blur', closePalettes)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('blur', closePalettes)
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      ParagraphLayout,
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
    onFocus: () => onBodyFocus?.(),
  })

  const runCommand = (event: ReactMouseEvent, command: () => void) => {
    event.preventDefault()
    event.stopPropagation()
    command()
  }

  const applyTextColor = (color: string) => {
    if (!editor) return
    if (titleMode) {
      onTitleStyleChange?.({ color })
      setIsColorPaletteOpen(false)
      return
    }
    setActiveTextColor(color)
    setRecentTextColors((current) => [color, ...current.filter((item) => item !== color)].slice(0, 8))
    editor.chain().focus().setColor(color).run()
    setIsColorPaletteOpen(false)
  }

  const clearTextColor = () => {
    if (!editor) return
    if (titleMode) {
      onTitleStyleChange?.({ color: undefined })
      setIsColorPaletteOpen(false)
      return
    }
    setActiveTextColor(DEFAULT_TEXT_COLOR)
    editor.chain().focus().unsetColor().run()
    setIsColorPaletteOpen(false)
  }

  const applyFontSize = (fontSize: string) => {
    if (!editor) return
    if (titleMode) {
      onTitleStyleChange?.({ fontSize: fontSize ? Number(fontSize) : undefined })
      return
    }
    editor.chain().focus().setMark('textStyle', { fontSize: fontSize ? `${fontSize}px` : null }).run()
  }

  const applyBlockLayout = (
    attribute: 'textIndent' | 'lineHeight' | 'textAlign',
    value: string | null
  ) => {
    if (!editor) return
    if (titleMode) {
      if (attribute === 'textAlign') {
        onTitleStyleChange?.({ textAlign: value as KnowledgeTitleStyle['textAlign'] })
      }
      return
    }
    editor.chain()
      .focus()
      .updateAttributes('paragraph', { [attribute]: value })
      .updateAttributes('heading', { [attribute]: value })
      .updateAttributes('blockquote', { [attribute]: value })
      .run()
  }

  const applyEmphasisStyle = () => {
    if (!editor) return
    const emphasisColor = '#ef4444'
    if (titleMode) {
      onTitleStyleChange?.({ fontSize: 18, color: emphasisColor, bold: true, underline: true })
      return
    }
    setActiveTextColor(emphasisColor)
    setRecentTextColors((current) => [emphasisColor, ...current.filter((item) => item !== emphasisColor)].slice(0, 8))
    setIsColorPaletteOpen(false)

    let chain = editor.chain().focus().setMark('textStyle', { fontSize: '18px' }).setColor(emphasisColor)
    if (!editor.isActive('bold')) {
      chain = chain.toggleBold()
    }
    if (!editor.isActive('underline')) {
      chain = chain.toggleUnderline()
    }
    chain.run()
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
    setIsQuoteBgPaletteOpen(false)
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
    <div ref={editorRootRef} className={`knowledge-rich-editor knowledge-card-editor${compact ? ' is-compact' : ''}`}>
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
        <div className="knowledge-toolbar-group knowledge-toolbar-paragraph" aria-label="段落">
          <button type="button" title="正文" disabled={titleMode} className={editor.isActive('paragraph') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().setParagraph().run())}><Type size={14} /></button>
          {!compact && <button type="button" title="一级标题" disabled={titleMode} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}><Heading1 size={14} /></button>}
          {!compact && <button type="button" title="二级标题" disabled={titleMode} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}><Heading2 size={14} /></button>}
          <button type="button" title="无序列表" disabled={titleMode} className={editor.isActive('bulletList') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleBulletList().run())}><List size={14} /></button>
          {!compact && <button type="button" title="有序列表" disabled={titleMode} className={editor.isActive('orderedList') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleOrderedList().run())}><ListOrdered size={14} /></button>}
          <button type="button" title="引用" disabled={titleMode} className={editor.isActive('blockquote') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleBlockquote().run())}><Quote size={14} /></button>
          {!compact && (
            <div className="knowledge-rich-color-wrap" onMouseDown={(event) => event.stopPropagation()}>
              <button
                type="button"
                disabled={titleMode}
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
          <button type="button" title="链接" disabled={titleMode} className={editor.isActive('link') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, addLink)}><Link2 size={14} /></button>
          {!compact && <button type="button" title="插入图片" disabled={titleMode} onMouseDown={(event) => runCommand(event, () => inlineImageInputRef.current?.click())}><ImagePlus size={14} /></button>}
        </div>
        <div className="knowledge-toolbar-group knowledge-toolbar-text-format" aria-label="文字格式">
          <button type="button" title="加粗" className={(titleMode ? titleStyle?.bold : editor.isActive('bold')) ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => titleMode ? onTitleStyleChange?.({ bold: !titleStyle?.bold }) : editor.chain().focus().toggleBold().run())}><Bold size={14} /></button>
          <button type="button" title="斜体" className={(titleMode ? titleStyle?.italic : editor.isActive('italic')) ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => titleMode ? onTitleStyleChange?.({ italic: !titleStyle?.italic }) : editor.chain().focus().toggleItalic().run())}><Italic size={14} /></button>
          <button type="button" title="下划线" className={(titleMode ? titleStyle?.underline : editor.isActive('underline')) ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => titleMode ? onTitleStyleChange?.({ underline: !titleStyle?.underline }) : editor.chain().focus().toggleUnderline().run())}><UnderlineIcon size={14} /></button>
          <button
            type="button"
            className="knowledge-rich-emphasis-button"
            title="重点样式：红色大号加粗下划线"
            onMouseDown={(event) => runCommand(event, applyEmphasisStyle)}
          >
            <Sparkles size={14} />
          </button>
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
              <span style={{ background: titleMode ? titleStyle?.color ?? DEFAULT_TEXT_COLOR : activeTextColor }} />
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
          {!compact && <button type="button" title="撤销" disabled={titleMode || !editor.can().undo()} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().undo().run())}><Undo2 size={14} /></button>}
          {!compact && <button type="button" title="重做" disabled={titleMode || !editor.can().redo()} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().redo().run())}><Redo2 size={14} /></button>}
        </div>
        <div className="knowledge-toolbar-group knowledge-toolbar-layout" aria-label="段落排版">
          {!compact && (
            <select
              className="knowledge-rich-layout-select"
              title="首行缩进"
              disabled={titleMode}
              defaultValue=""
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => applyBlockLayout('textIndent', event.currentTarget.value || null)}
            >
              <option value="">首行缩进</option>
              <option value="0">无缩进</option>
              <option value="1em">缩进 1 字符</option>
              <option value="2em">缩进 2 字符</option>
              <option value="4em">缩进 4 字符</option>
            </select>
          )}
          {!compact && (
            <select
              className="knowledge-rich-layout-select is-line-height"
              title="行间距"
              disabled={titleMode}
              defaultValue=""
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => applyBlockLayout('lineHeight', event.currentTarget.value || null)}
            >
              <option value="">行间距</option>
              <option value="1">1.0</option>
              <option value="1.25">1.25</option>
              <option value="1.5">1.5</option>
              <option value="1.75">1.75</option>
              <option value="2">2.0</option>
              <option value="2.5">2.5</option>
            </select>
          )}
          <button type="button" title="左对齐" onMouseDown={(event) => runCommand(event, () => applyBlockLayout('textAlign', 'left'))}><AlignLeft size={14} /></button>
          <button type="button" title="居中对齐" onMouseDown={(event) => runCommand(event, () => applyBlockLayout('textAlign', 'center'))}><AlignCenter size={14} /></button>
          <button type="button" title="右对齐" onMouseDown={(event) => runCommand(event, () => applyBlockLayout('textAlign', 'right'))}><AlignRight size={14} /></button>
          {!compact && <button type="button" title="清除文字和段落格式" onMouseDown={(event) => runCommand(event, () => titleMode ? onTitleStyleReset?.() : editor.chain().focus().unsetAllMarks().clearNodes().run())}><RemoveFormatting size={14} /></button>}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

export function NodeKnowledgePanel({
  selectedNode,
  linkedQuotes,
  focusItemId,
  onClose,
  onUpdateLabel,
  onUpdateMeta,
  style,
}: NodeKnowledgePanelProps) {
  const documentNodes = useDocumentStore((state) => state.nodes)
  const [panelWidth, setPanelWidth] = useState(() => getPanelWidthFromStyle(style))
  const [activeTagId, setActiveTagId] = useState('quote')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draft, setDraft] = useState<KnowledgeDraft>({ title: '', content: '', contentHtml: '<p></p>', chain: [] })
  const [isTitleToolbarVisible, setIsTitleToolbarVisible] = useState(false)
  const [draggingChainIndex, setDraggingChainIndex] = useState<number | null>(null)
  const [editingChainIndex, setEditingChainIndex] = useState<number | null>(null)
  const [chainContextMenu, setChainContextMenu] = useState<ChainContextMenuState>(null)
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>('all')
  const [questionView, setQuestionView] = useState<'list' | 'grid'>('list')
  const [questionSort, setQuestionSort] = useState<'desc' | 'asc'>('desc')
  const [questionDraftType, setQuestionDraftType] = useState<QuestionTemplateType>('causal')
  const [questionDraftStatus, setQuestionDraftStatus] = useState<QuestionStatus>('to_think')
  const [actionDraftDueDate, setActionDraftDueDate] = useState('')
  const [actionDraftPriority, setActionDraftPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [actionDraftProgress, setActionDraftProgress] = useState(0)
  const [actionDraftStatus, setActionDraftStatus] = useState<ActionStatus>('todo')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [actionSort, setActionSort] = useState<ActionSort>('dueDate')
  const [actionView, setActionView] = useState<'list' | 'card'>('list')
  const [actionStepDraft, setActionStepDraft] = useState('')
  const [editingActionStepId, setEditingActionStepId] = useState<string | null>(null)
  const [editingActionStepDraft, setEditingActionStepDraft] = useState('')
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [actionContextMenu, setActionContextMenu] = useState<ActionMenuState>(null)
  const [actionPriorityMenu, setActionPriorityMenu] = useState<ActionMenuState>(null)
  const [inspirationDraft, setInspirationDraft] = useState('')
  const [newInspirationCategory, setNewInspirationCategory] = useState('')
  const [tagMenu, setTagMenu] = useState<TagMenuState>(null)
  const [quoteActionMenuId, setQuoteActionMenuId] = useState<string | null>(null)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagDraft, setEditingTagDraft] = useState('')
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null)
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null)
  const [isQuoteSourceMenuOpen, setIsQuoteSourceMenuOpen] = useState(false)
  const [quoteSourceSearchTerm, setQuoteSourceSearchTerm] = useState('')
  const [recentQuoteSource, setRecentQuoteSource] = useState('')
  const [tagDialog, setTagDialog] = useState<TagDialogState>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const quoteSourcePickerRef = useRef<HTMLDivElement | null>(null)
  const latestPanelWidthRef = useRef(panelWidth)
  const hasUserResizedRef = useRef(false)

  const tags = useMemo(() => getKnowledgeTags(selectedNode.meta), [selectedNode.id, selectedNode.meta?.knowledgeTags])
  const items = useMemo(() => getKnowledgeItems(selectedNode), [selectedNode.id, selectedNode.meta?.knowledgeItems, selectedNode.meta?.notes])
  const inspirationCategories = useMemo(() => getInspirationCategories(selectedNode.meta), [selectedNode.id, selectedNode.meta?.inspirationCategories])
  const activeTag = tags.find((tag) => tag.id === activeTagId) ?? tags[0]
  const activeItems = activeTag ? items.filter((item) => item.tagId === activeTag.id) : []
  const getFocusItemClass = (itemId: string) => focusItemId === itemId ? ' is-search-focused' : ''
  const quoteSourceOptions = useMemo(() => {
    const sourceMap = new Map<string, number>()
    Object.values(documentNodes).forEach((node) => {
      const knowledgeItems = Array.isArray(node.meta?.knowledgeItems)
        ? node.meta.knowledgeItems as NodeKnowledgeItem[]
        : []
      knowledgeItems.forEach((item) => {
        if (item.contentType !== 'quote') return
        const source = (item.sourceBookName || item.title || '').trim()
        if (!source || isDefaultQuoteTitle(source)) return
        sourceMap.set(source, Math.max(sourceMap.get(source) ?? 0, item.updatedAt || item.createdAt || 0))
      })
    })
    return Array.from(sourceMap.entries())
      .map(([source, lastUsedAt]) => ({ source, lastUsedAt }))
      .sort((left, right) => {
        if (recentQuoteSource) {
          if (left.source === recentQuoteSource) return -1
          if (right.source === recentQuoteSource) return 1
        }
        return right.lastUsedAt - left.lastUsedAt || left.source.localeCompare(right.source, 'zh-CN')
      })
  }, [documentNodes, recentQuoteSource])
  const filteredQuoteSourceOptions = useMemo(() => {
    const keyword = quoteSourceSearchTerm.trim().toLocaleLowerCase()
    if (!keyword) return quoteSourceOptions
    return quoteSourceOptions.filter((option) => option.source.toLocaleLowerCase().includes(keyword))
  }, [quoteSourceOptions, quoteSourceSearchTerm])
  const selectedAction = activeTag?.kind === 'action' && selectedActionId
    ? activeItems.find((item) => item.id === selectedActionId)
    : undefined
  const selectedActionLinkedQuestion = selectedAction?.linkedQuestionId
    ? items.find((item) => item.id === selectedAction.linkedQuestionId)
    : undefined

  useEffect(() => {
    setActiveTagId('quote')
    setEditingItemId(null)
    setQuoteActionMenuId(null)
    setEditingChainIndex(null)
    setChainContextMenu(null)
    setQuestionFilter('all')
    setQuestionView('list')
    setQuestionSort('desc')
    setQuestionDraftType('causal')
    setQuestionDraftStatus('to_think')
    setActionDraftDueDate('')
    setActionDraftPriority('medium')
    setActionDraftProgress(0)
    setActionDraftStatus('todo')
    setActionFilter('all')
    setActionSort('dueDate')
    setActionView('list')
    setActionStepDraft('')
    setEditingActionStepId(null)
    setEditingActionStepDraft('')
    setDraggingTagId(null)
    setDragOverTagId(null)
    setIsQuoteSourceMenuOpen(false)
    setQuoteSourceSearchTerm('')
    setSelectedActionId(null)
    setActionContextMenu(null)
    setActionPriorityMenu(null)
    setDraft({ title: '', content: '', contentHtml: '<p></p>', chain: [] })
    setInspirationDraft('')
    setNewInspirationCategory('')
  }, [selectedNode.id])

  useEffect(() => {
    if (!tags.some((tag) => tag.id === activeTagId)) {
      setActiveTagId(tags[0]?.id ?? 'quote')
    }
  }, [activeTagId, tags])

  useEffect(() => {
    if (!focusItemId) return
    const targetItem = items.find((item) => item.id === focusItemId)
    if (!targetItem) return

    setActiveTagId(targetItem.tagId)
    if (targetItem.contentType === 'action') {
      setSelectedActionId(targetItem.id)
    }
  }, [focusItemId, items])

  useEffect(() => {
    if (!focusItemId || activeTagId !== items.find((item) => item.id === focusItemId)?.tagId) return

    const timeoutId = window.setTimeout(() => {
      const targetElement = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-knowledge-item-id]') ?? [])
        .find((element) => element.dataset.knowledgeItemId === focusItemId)
      targetElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 80)

    return () => window.clearTimeout(timeoutId)
  }, [activeTagId, focusItemId, items])

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

  useEffect(() => {
    if (!chainContextMenu) return

    const closeMenu = () => setChainContextMenu(null)
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [chainContextMenu])

  useEffect(() => {
    if (!actionContextMenu && !actionPriorityMenu) return

    const closeMenus = () => {
      setActionContextMenu(null)
      setActionPriorityMenu(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenus()
    }

    document.addEventListener('mousedown', closeMenus)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenus)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [actionContextMenu, actionPriorityMenu])

  useEffect(() => {
    if (!isQuoteSourceMenuOpen) return
    const closeSourceMenu = (event: MouseEvent) => {
      if (quoteSourcePickerRef.current?.contains(event.target as Node)) return
      setIsQuoteSourceMenuOpen(false)
      setQuoteSourceSearchTerm('')
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsQuoteSourceMenuOpen(false)
      setQuoteSourceSearchTerm('')
    }
    document.addEventListener('mousedown', closeSourceMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeSourceMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isQuoteSourceMenuOpen])

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
      status: activeTag.kind === 'action' ? 'todo' : activeTag.kind === 'question' ? 'to_think' : undefined,
      priority: activeTag.kind === 'action' ? 'medium' : undefined,
      progress: activeTag.kind === 'action' ? 0 : undefined,
      actionSteps: activeTag.kind === 'action' ? [] : undefined,
      dueDate: activeTag.kind === 'action' ? new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : undefined,
      chain: activeTag.kind === 'case' ? ['触发因素', '过程变化', '结果'] : undefined,
      questionType: activeTag.kind === 'question' ? (questionFilter === 'all' ? 'causal' : questionFilter) : undefined,
      sortOrder: activeTag.kind === 'question' ? items.filter((item) => item.tagId === activeTag.id).length : undefined,
      createdAt: now,
      updatedAt: now,
    }
    persistKnowledgeState(tags, [newItem, ...items])
    setEditingItemId(newItem.id)
    setQuoteActionMenuId(null)
    setEditingChainIndex(null)
    setChainContextMenu(null)
    if (newItem.contentType === 'question') {
      setQuestionDraftType(newItem.questionType ?? 'causal')
      setQuestionDraftStatus('to_think')
    }
    if (newItem.contentType === 'action') {
      setActionDraftDueDate(newItem.dueDate ?? '')
      setActionDraftPriority(newItem.priority ?? 'medium')
      setActionDraftProgress(newItem.progress ?? 0)
      setActionDraftStatus(getActionStatus(newItem.status))
    }
    setDraft({
      title: newItem.title,
      content: '',
      contentHtml: newItem.contentHtml ?? '<p></p>',
      chain: newItem.chain ?? [],
    })
  }

  const startEditItem = (item: NodeKnowledgeItem) => {
    setIsTitleToolbarVisible(false)
    setEditingItemId(item.id)
    setQuoteActionMenuId(null)
    setEditingChainIndex(null)
    setChainContextMenu(null)
    setActionContextMenu(null)
    setActionPriorityMenu(null)
    if (item.contentType === 'question') {
      setQuestionDraftType(getQuestionType(item))
      setQuestionDraftStatus(getQuestionStatus(item.status))
    }
    if (item.contentType === 'action') {
      setSelectedActionId(item.id)
      setActionDraftDueDate(item.dueDate ?? '')
      setActionDraftPriority(item.priority ?? 'medium')
      setActionDraftProgress(item.progress ?? 0)
      setActionDraftStatus(getActionStatus(item.status))
    }
    setDraft({
      title: item.contentType === 'quote' ? item.sourceBookName || item.title : item.title,
      titleStyle: item.titleStyle,
      content: item.plainText ?? item.content,
      contentHtml: item.contentHtml ?? plainTextToHtml(item.content),
      chain: item.chain ?? (item.contentType === 'case' ? ['触发因素', '过程变化', '结果'] : []),
    })
  }

  const startCreateAction = (parentActionId?: string) => {
    if (!activeTag || activeTag.kind !== 'action') return
    const now = Date.now()
    const dueDate = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const newItem: NodeKnowledgeItem = {
      id: createKnowledgeId('action'),
      tagId: activeTag.id,
      contentType: 'action',
      title: parentActionId ? '新的子行动' : '新的行动',
      content: '',
      contentHtml: '<p>把这个节点转化成一个可以执行的小行动。</p>',
      plainText: '',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      actionSteps: [],
      dueDate,
      parentActionId,
      sortOrder: activeItems.length,
      createdAt: now,
      updatedAt: now,
    }
    persistKnowledgeState(tags, [newItem, ...items])
    setSelectedActionId(newItem.id)
    setEditingItemId(newItem.id)
    setQuoteActionMenuId(null)
    setActionContextMenu(null)
    setActionPriorityMenu(null)
    setActionDraftDueDate(dueDate)
    setActionDraftPriority('medium')
    setActionDraftProgress(0)
    setActionDraftStatus('todo')
    setDraft({
      title: newItem.title,
      content: '',
      contentHtml: newItem.contentHtml ?? '<p></p>',
      chain: [],
    })
  }

  const cancelEditItem = () => {
    const editingItem = items.find((item) => item.id === editingItemId)
    const isEmptyNewItem = editingItem && !editingItem.plainText && !editingItem.content && !editingItem.contentHtml?.replace(/<[^>]+>/g, '').trim()
    if (isEmptyNewItem) {
      persistKnowledgeState(tags, items.filter((item) => item.id !== editingItem.id))
    }
    setEditingItemId(null)
    setIsTitleToolbarVisible(false)
    setQuoteActionMenuId(null)
    setDraggingChainIndex(null)
    setEditingChainIndex(null)
    setChainContextMenu(null)
    setDraft({ title: '', content: '', contentHtml: '<p></p>', chain: [] })
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
        titleStyle: item.contentType === 'reflection' ? draft.titleStyle : item.titleStyle,
        sourceBookName: item.contentType === 'quote' ? nextTitle || undefined : item.sourceBookName,
        content: plainText,
        contentHtml: normalizeEditorHtml(draft.contentHtml || plainTextToHtml(plainText)),
        plainText,
        chain: item.contentType === 'case'
          ? draft.chain.map((step) => step.trim()).filter(Boolean)
          : item.chain,
        questionType: item.contentType === 'question' ? questionDraftType : item.questionType,
        status: item.contentType === 'action' ? actionDraftStatus : item.contentType === 'question' ? questionDraftStatus : item.status,
        tags: item.contentType === 'question' ? [getQuestionCategoryLabel(questionDraftType)] : item.contentType === 'inspiration' ? [nextTitle] : item.tags,
        dueDate: item.contentType === 'action' ? actionDraftDueDate : item.dueDate,
        priority: item.contentType === 'action' ? actionDraftPriority : item.priority,
        progress: item.contentType === 'action' ? actionDraftProgress : item.progress,
        updatedAt: now,
      }
    })
    persistKnowledgeState(tags, nextItems)
    const savedItem = nextItems.find((item) => item.id === editingItemId)
    if (savedItem?.contentType === 'quote' && savedItem.sourceBookName) {
      setRecentQuoteSource(savedItem.sourceBookName)
    }
    setEditingItemId(null)
    setIsTitleToolbarVisible(false)
    setIsQuoteSourceMenuOpen(false)
    setQuoteSourceSearchTerm('')
    setQuoteActionMenuId(null)
    setDraggingChainIndex(null)
    setEditingChainIndex(null)
    setChainContextMenu(null)
  }

  const deleteItem = (itemId: string) => {
    const deletingItem = items.find((item) => item.id === itemId)
    const deletingIds = new Set([itemId])
    if (deletingItem?.contentType === 'action') {
      let foundChild = true
      while (foundChild) {
        foundChild = false
        items.forEach((item) => {
          if (item.parentActionId && deletingIds.has(item.parentActionId) && !deletingIds.has(item.id)) {
            deletingIds.add(item.id)
            foundChild = true
          }
        })
      }
    }
    persistKnowledgeState(tags, items.filter((item) => !deletingIds.has(item.id)))
    if (editingItemId === itemId) {
      setEditingItemId(null)
    }
    if (quoteActionMenuId === itemId) {
      setQuoteActionMenuId(null)
    }
    if (selectedActionId && deletingIds.has(selectedActionId)) {
      setSelectedActionId(null)
    }
    if (actionContextMenu && deletingIds.has(actionContextMenu.itemId)) {
      setActionContextMenu(null)
    }
    if (actionPriorityMenu && deletingIds.has(actionPriorityMenu.itemId)) {
      setActionPriorityMenu(null)
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

  const reorderTag = (draggedTagId: string, targetTagId: string) => {
    if (draggedTagId === targetTagId || PROTECTED_TAG_IDS.has(draggedTagId) || PROTECTED_TAG_IDS.has(targetTagId)) {
      return
    }
    const draggedIndex = tags.findIndex((tag) => tag.id === draggedTagId)
    const targetIndex = tags.findIndex((tag) => tag.id === targetTagId)
    if (draggedIndex < 0 || targetIndex < 0) return

    const reordered = [...tags]
    const [draggedTag] = reordered.splice(draggedIndex, 1)
    reordered.splice(targetIndex, 0, draggedTag)
    const now = Date.now()
    const nextTags = reordered.map((tag, index) => ({
      ...tag,
      sortOrder: index,
      updatedAt: tag.id === draggedTagId ? now : tag.updatedAt,
    }))
    persistKnowledgeState(nextTags, items)
  }

  const startTagDrag = (event: ReactDragEvent<HTMLDivElement>, tag: NodeKnowledgeTag) => {
    if (PROTECTED_TAG_IDS.has(tag.id) || editingTagId === tag.id) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tag.id)
    setDraggingTagId(tag.id)
    setDragOverTagId(null)
    setTagMenu(null)
  }

  const dropTag = (event: ReactDragEvent<HTMLDivElement>, targetTag: NodeKnowledgeTag) => {
    event.preventDefault()
    const draggedTagId = draggingTagId || event.dataTransfer.getData('text/plain')
    if (draggedTagId) reorderTag(draggedTagId, targetTag.id)
    setDraggingTagId(null)
    setDragOverTagId(null)
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

  const focusChainStep = (index: number) => {
    requestAnimationFrame(() => {
      const input = panelRef.current?.querySelector<HTMLTextAreaElement>(`[data-chain-index="${index}"]`)
      input?.focus()
      input?.setSelectionRange(input.value.length, input.value.length)
    })
  }

  const updateChainStep = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      chain: current.chain.map((step, stepIndex) => stepIndex === index ? value : step),
    }))
  }

  const addChainStep = (afterIndex = draft.chain.length - 1) => {
    const insertIndex = Math.max(0, Math.min(draft.chain.length, afterIndex + 1))
    setDraft((current) => {
      const nextChain = [...current.chain]
      nextChain.splice(insertIndex, 0, '')
      return { ...current, chain: nextChain }
    })
    setEditingChainIndex(insertIndex)
    setChainContextMenu(null)
    focusChainStep(insertIndex)
  }

  const removeChainStep = (index: number) => {
    setDraft((current) => ({
      ...current,
      chain: current.chain.filter((_, stepIndex) => stepIndex !== index),
    }))
    setEditingChainIndex(null)
    setChainContextMenu(null)
  }

  const moveChainStep = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setDraft((current) => {
      const nextChain = [...current.chain]
      const [movedStep] = nextChain.splice(fromIndex, 1)
      nextChain.splice(toIndex, 0, movedStep)
      return { ...current, chain: nextChain }
    })
    setDraggingChainIndex(null)
    setEditingChainIndex(null)
    setChainContextMenu(null)
  }

  const openChainContextMenu = (event: ReactMouseEvent, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    const menuWidth = 132
    const menuHeight = 82
    setChainContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
      index,
    })
  }

  const startEditChainStep = (index: number) => {
    setEditingChainIndex(index)
    setChainContextMenu(null)
    focusChainStep(index)
  }

  const openActionContextMenu = (event: ReactMouseEvent, itemId: string) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedActionId(itemId)
    setActionPriorityMenu(null)
    setActionContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 158)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 126)),
      itemId,
    })
  }

  const openActionPriorityMenu = (event: ReactMouseEvent<HTMLButtonElement>, itemId: string) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    setActionContextMenu(null)
    setActionPriorityMenu({
      x: Math.max(8, Math.min(rect.right - 92, window.innerWidth - 100)),
      y: Math.max(8, Math.min(rect.bottom + 5, window.innerHeight - 126)),
      itemId,
    })
  }

  const renderItemEditor = (item: NodeKnowledgeItem) => {
    const compact = item.contentType === 'inspiration'
    const isQuoteItem = item.contentType === 'quote'
    const isQuestionItem = item.contentType === 'question'
    const isActionItem = item.contentType === 'action'
    const isReflectionItem = item.contentType === 'reflection'
    const updateTitleStyle = (patch: Partial<KnowledgeTitleStyle>) => {
      setDraft((current) => ({
        ...current,
        titleStyle: {
          ...current.titleStyle,
          ...patch,
        },
      }))
    }
    return (
      <div className="knowledge-item-editor">
        {isQuoteItem ? (
          <div ref={quoteSourcePickerRef} className="knowledge-source-picker">
            <input
              className="knowledge-item-title-input is-source"
              value={draft.title}
              onFocus={() => {
                setIsQuoteSourceMenuOpen(true)
                setQuoteSourceSearchTerm('')
              }}
              onChange={(event) => {
                const value = event.target.value
                setDraft((current) => ({ ...current, title: value }))
                setQuoteSourceSearchTerm(value)
                setIsQuoteSourceMenuOpen(true)
              }}
              placeholder="输入或选择书籍来源"
              role="combobox"
              aria-expanded={isQuoteSourceMenuOpen}
              aria-controls="knowledge-source-options"
            />
            <button
              type="button"
              className={`knowledge-source-picker-toggle${isQuoteSourceMenuOpen ? ' is-open' : ''}`}
              title="选择历史来源"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setIsQuoteSourceMenuOpen((current) => !current)
                setQuoteSourceSearchTerm('')
              }}
            >
              <ChevronDown size={14} />
            </button>
            {isQuoteSourceMenuOpen && (
              <div id="knowledge-source-options" className="knowledge-source-options" role="listbox">
                {filteredQuoteSourceOptions.length > 0 ? (
                  filteredQuoteSourceOptions.map((option, index) => (
                    <button
                      key={option.source}
                      type="button"
                      role="option"
                      aria-selected={draft.title === option.source}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setDraft((current) => ({ ...current, title: option.source }))
                        setRecentQuoteSource(option.source)
                        setIsQuoteSourceMenuOpen(false)
                        setQuoteSourceSearchTerm('')
                      }}
                    >
                      <span>{option.source}</span>
                      {index === 0 && <small>最近使用</small>}
                    </button>
                  ))
                ) : (
                  <div className="knowledge-source-options-empty">
                    {quoteSourceOptions.length === 0 ? '保存金句后，来源会出现在这里' : '没有匹配的来源，可直接输入新来源'}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="knowledge-title-editor">
            <input
              className="knowledge-item-title-input"
              type="text"
              name="knowledge-title-no-autofill"
              autoComplete="new-password"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              value={draft.title}
              style={isReflectionItem ? getKnowledgeTitleStyle(draft.titleStyle) : undefined}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              onSelect={(event) => {
                if (!isReflectionItem) return
                const input = event.currentTarget
                setIsTitleToolbarVisible(
                  input.selectionStart !== null
                  && input.selectionEnd !== null
                  && input.selectionEnd > input.selectionStart
                )
              }}
              placeholder="标题"
            />
          </div>
        )}
        {isQuestionItem && (
          <div className="knowledge-question-editor-meta">
            <label>
              <span>追问类型</span>
              <select value={questionDraftType} onChange={(event) => setQuestionDraftType(event.target.value as QuestionTemplateType)}>
                {QUESTION_CATEGORIES.filter((category) => category.id !== 'all').map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>当前状态</span>
              <select value={questionDraftStatus} onChange={(event) => setQuestionDraftStatus(event.target.value as QuestionStatus)}>
                {QUESTION_STATUS_OPTIONS.map((status) => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {isActionItem && (
          <div className="knowledge-action-editor-meta">
            <label>
              <span>预计完成</span>
              <input type="date" value={actionDraftDueDate} onChange={(event) => setActionDraftDueDate(event.target.value)} />
            </label>
            <label>
              <span>优先级</span>
              <select value={actionDraftPriority} onChange={(event) => setActionDraftPriority(event.target.value as 'high' | 'medium' | 'low')}>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label>
              <span>状态</span>
              <select value={actionDraftStatus} onChange={(event) => setActionDraftStatus(event.target.value as ActionStatus)}>
                {ACTION_STATUS_OPTIONS.map((status) => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
            </label>
            <label className="knowledge-action-progress-input">
              <span>完成进度</span>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={actionDraftProgress}
                onChange={(event) => setActionDraftProgress(Number(event.target.value))}
              />
              <strong>{actionDraftProgress}%</strong>
            </label>
          </div>
        )}
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
            titleMode={isReflectionItem && isTitleToolbarVisible}
            titleStyle={draft.titleStyle}
            onTitleStyleChange={updateTitleStyle}
            onTitleStyleReset={() => setDraft((current) => ({ ...current, titleStyle: undefined }))}
            onBodyFocus={() => setIsTitleToolbarVisible(false)}
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
        {item.contentType === 'case' && (
          <section className="knowledge-case-chain-editor">
            <div className="knowledge-case-chain-editor-head">
              <div>
                <strong>因果链条</strong>
                <span>回车新增步骤，也可粘贴“原因 → 过程 → 结果”</span>
              </div>
              <button type="button" title="添加步骤" onClick={() => addChainStep()}>
                <Plus size={14} />
              </button>
            </div>
            <div className="knowledge-case-chain-editor-list">
              {draft.chain.map((step, index) => (
                <div
                  key={`chain-step-${index}`}
                  className={`knowledge-case-chain-step${draggingChainIndex === index ? ' is-dragging' : ''}${editingChainIndex === index ? ' is-editing' : ''}`}
                  draggable={editingChainIndex !== index}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    setDraggingChainIndex(index)
                    setChainContextMenu(null)
                  }}
                  onDragEnd={() => setDraggingChainIndex(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (draggingChainIndex !== null) moveChainStep(draggingChainIndex, index)
                  }}
                  onContextMenu={(event) => openChainContextMenu(event, index)}
                >
                  {editingChainIndex === index ? (
                    <textarea
                      data-chain-index={index}
                      rows={1}
                      value={step}
                      style={{ width: `${Math.min(28, Math.max(8, step.length + 2))}ch` }}
                      onChange={(event) => updateChainStep(index, event.target.value)}
                      onBlur={() => setEditingChainIndex(null)}
                      onPaste={(event) => {
                        const pastedText = event.clipboardData.getData('text/plain')
                        const pastedSteps = pastedText
                          .split(/\s*(?:→|->|=>)\s*/)
                          .map((value) => value.trim())
                          .filter(Boolean)
                        if (pastedSteps.length < 2) return
                        event.preventDefault()
                        setDraft((current) => {
                          const nextChain = [...current.chain]
                          nextChain.splice(index, 1, ...pastedSteps)
                          return { ...current, chain: nextChain }
                        })
                        setEditingChainIndex(index + pastedSteps.length - 1)
                        focusChainStep(index + pastedSteps.length - 1)
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation()
                        if (event.nativeEvent.isComposing) return
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setEditingChainIndex(null)
                        }
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          addChainStep(index)
                          setEditingChainIndex(index + 1)
                        }
                        if (event.key === 'Backspace' && !step && draft.chain.length > 1) {
                          event.preventDefault()
                          removeChainStep(index)
                        }
                      }}
                      placeholder={`步骤 ${index + 1}`}
                    />
                  ) : (
                    <span className="knowledge-case-chain-label">{step || `步骤 ${index + 1}`}</span>
                  )}
                  {index < draft.chain.length - 1 && <span className="knowledge-case-chain-arrow">→</span>}
                </div>
              ))}
              {draft.chain.length === 0 && (
                <button type="button" className="knowledge-case-chain-empty" onClick={() => addChainStep()}>
                  <Plus size={14} /> 添加第一个步骤
                </button>
              )}
            </div>
            {chainContextMenu && createPortal(
              <div
                className="knowledge-case-chain-menu"
                style={{ left: chainContextMenu.x, top: chainContextMenu.y }}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <button type="button" onClick={() => startEditChainStep(chainContextMenu.index)}>
                  <Pencil size={13} /> 编辑
                </button>
                <button type="button" className="is-danger" onClick={() => removeChainStep(chainContextMenu.index)}>
                  <Trash2 size={13} /> 删除
                </button>
              </div>,
              document.body,
            )}
          </section>
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

  const updateActionSteps = (item: NodeKnowledgeItem, nextSteps: NodeActionStep[]) => {
    const progress = nextSteps.length > 0
      ? Math.round(nextSteps.filter((step) => step.isDone).length / nextSteps.length * 100)
      : item.progress ?? 0
    const status: ActionStatus = nextSteps.length > 0 && progress === 100
      ? 'done'
      : progress > 0
        ? 'in_progress'
        : getActionStatus(item.status) === 'done'
          ? 'todo'
          : getActionStatus(item.status)
    updateItemPatch(item.id, { actionSteps: nextSteps, progress, status })
  }

  const addActionStep = (item: NodeKnowledgeItem) => {
    const title = actionStepDraft.trim()
    if (!title) return
    const now = Date.now()
    const nextSteps = [
      ...(item.actionSteps ?? []),
      {
        id: createKnowledgeId('step'),
        title,
        isDone: false,
        sortOrder: item.actionSteps?.length ?? 0,
        createdAt: now,
        updatedAt: now,
      },
    ]
    updateActionSteps(item, nextSteps)
    setActionStepDraft('')
  }

  const toggleActionStep = (item: NodeKnowledgeItem, stepId: string) => {
    const now = Date.now()
    const nextSteps = (item.actionSteps ?? []).map((step) => step.id === stepId
      ? { ...step, isDone: !step.isDone, updatedAt: now }
      : step
    )
    updateActionSteps(item, nextSteps)
  }

  const deleteActionStep = (item: NodeKnowledgeItem, stepId: string) => {
    updateActionSteps(item, (item.actionSteps ?? []).filter((step) => step.id !== stepId))
  }

  const startEditActionStep = (step: NodeActionStep) => {
    setEditingActionStepId(step.id)
    setEditingActionStepDraft(step.title)
  }

  const saveActionStepTitle = (item: NodeKnowledgeItem, stepId: string) => {
    const title = editingActionStepDraft.trim()
    setEditingActionStepId(null)
    setEditingActionStepDraft('')
    if (!title) return
    const now = Date.now()
    updateActionSteps(item, (item.actionSteps ?? []).map((step) => step.id === stepId
      ? { ...step, title, updatedAt: now }
      : step
    ))
  }

  const toggleActionDetail = (itemId: string) => {
    setSelectedActionId((current) => current === itemId ? null : itemId)
  }

  const generateQuestionTemplates = (filter: QuestionFilter) => {
    if (!activeTag || activeTag.kind !== 'question') return
    const templates = DEFAULT_QUESTION_TEMPLATES.filter((template) => filter === 'all' || template.type === filter)
    const existingTitles = new Set(activeItems.map((item) => item.title.trim()))
    const now = Date.now()
    const generatedItems = templates
      .filter((template) => !existingTitles.has(template.title))
      .map((template, index): NodeKnowledgeItem => ({
        id: createKnowledgeId('question'),
        tagId: activeTag.id,
        contentType: 'question',
        title: template.title,
        content: template.description,
        contentHtml: plainTextToHtml(template.description),
        plainText: template.description,
        tags: [getQuestionCategoryLabel(template.type)],
        status: 'not_started',
        questionType: template.type,
        sortOrder: activeItems.length + index,
        createdAt: now + index,
        updatedAt: now + index,
      }))
    if (generatedItems.length === 0) return
    persistKnowledgeState(tags, [...generatedItems, ...items])
  }

  const convertQuestionToAction = (item: NodeKnowledgeItem) => {
    const now = Date.now()
    let actionTag = tags.find((tag) => tag.kind === 'action')
    let nextTags = tags
    if (!actionTag) {
      const actionTemplate = TAG_TEMPLATES.find((tag) => tag.id === 'action')
      if (!actionTemplate) return
      actionTag = { ...actionTemplate, createdAt: now, updatedAt: now }
      nextTags = [...tags, actionTag].sort((left, right) => left.sortOrder - right.sortOrder)
    }

    const actionId = createKnowledgeId('action')
    const actionItem: NodeKnowledgeItem = {
      id: actionId,
      tagId: actionTag.id,
      contentType: 'action',
      title: item.title,
      content: item.plainText || item.content,
      contentHtml: item.contentHtml ?? plainTextToHtml(item.plainText || item.content),
      plainText: item.plainText || item.content,
      status: 'todo',
      priority: 'medium',
      progress: 0,
      actionSteps: [],
      linkedQuestionId: item.id,
      dueDate: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      createdAt: now,
      updatedAt: now,
    }
    const nextItems = items.map((current) => current.id === item.id
      ? { ...current, status: 'converted_to_action' as QuestionStatus, convertedActionId: actionId, updatedAt: now }
      : current
    )
    persistKnowledgeState(nextTags, [actionItem, ...nextItems])
    setQuoteActionMenuId(null)
    setActiveTagId(actionTag.id)
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
          const isDraggableTag = !PROTECTED_TAG_IDS.has(tag.id)
          return (
            <div
              key={tag.id}
              className={`knowledge-workbench-tab${active ? ' is-active' : ''}${isDraggableTag ? ' is-draggable' : ' is-fixed'}${draggingTagId === tag.id ? ' is-dragging' : ''}${dragOverTagId === tag.id ? ' is-drag-over' : ''}`}
              style={{ '--tag-color': tag.color } as CSSProperties}
              role="button"
              tabIndex={0}
              draggable={isDraggableTag && !isEditingTag}
              onDragStart={(event) => startTagDrag(event, tag)}
              onDragOver={(event) => {
                if (!draggingTagId || !isDraggableTag || draggingTagId === tag.id) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setDragOverTagId(tag.id)
              }}
              onDragLeave={() => {
                if (dragOverTagId === tag.id) setDragOverTagId(null)
              }}
              onDrop={(event) => dropTag(event, tag)}
              onDragEnd={() => {
                setDraggingTagId(null)
                setDragOverTagId(null)
              }}
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
                  <article
                    key={item.id}
                    data-knowledge-item-id={item.id}
                    className={`knowledge-quote-row is-editable${isEditing ? ' is-editing' : ''}${getFocusItemClass(item.id)}`}
                  >
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
            <article
              key={item.id}
              data-knowledge-item-id={item.id}
              className={`knowledge-reflection-card${getFocusItemClass(item.id)}`}
            >
              {isEditing ? (
                renderItemEditor(item)
              ) : (
                <>
                  <div className="knowledge-card-head">
                    <strong style={getKnowledgeTitleStyle(item.titleStyle)}><MessageSquareText size={17} /> {item.title}</strong>
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
              data-knowledge-item-id={item.id}
              className={`knowledge-inspiration-card${getFocusItemClass(item.id)}`}
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
    <section className="knowledge-page knowledge-page-case has-sticky-action">
      <div className="knowledge-page-scroll">
        <div className="knowledge-case-list">
          {activeItems.map((item, index) => {
            const isEditing = editingItemId === item.id
            return (
              <article
                key={item.id}
                data-knowledge-item-id={item.id}
                className={`knowledge-case-card${getFocusItemClass(item.id)}`}
              >
                {isEditing ? renderItemEditor(item) : (
                  <div className="knowledge-case-body">
                    <div className="knowledge-card-head">
                      <strong><span>案例 {String(index + 1).padStart(2, '0')}</span>{item.title}</strong>
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
                    <p>{item.plainText || item.content || '\u8bb0\u5f55\u6848\u4f8b\u80cc\u666f\u3001\u53d1\u751f\u94fe\u8def\u548c\u7ed3\u8bba\u3002'}</p>
                    <div className="knowledge-chain-row">
                      {(item.chain && item.chain.length > 0 ? item.chain : ['触发因素', '过程变化', '结果']).map((step, stepIndex, array) => (
                        <span key={`${step}-${stepIndex}`}>{step}{stepIndex < array.length - 1 && <em>→</em>}</span>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
      <div className="knowledge-sticky-add">
        <button type="button" className="knowledge-workbench-add" onClick={startCreateItem}><Plus size={16} /> 新建案例</button>
        <div className="knowledge-workbench-count">共 {activeItems.length} 个案例</div>
      </div>
    </section>
  )

  const renderQuestionPage = () => {
    const filteredItems = activeItems
      .filter((item) => questionFilter === 'all' || getQuestionType(item) === questionFilter)
      .sort((left, right) => questionSort === 'desc'
        ? right.createdAt - left.createdAt
        : left.createdAt - right.createdAt
      )
    const filterLabel = QUESTION_CATEGORIES.find((category) => category.id === questionFilter)?.label ?? '全部'

    return (
      <section className="knowledge-page knowledge-page-question has-sticky-action">
        <div className="knowledge-page-scroll">
          <div className="knowledge-question-intro">
            <CircleHelp size={24} />
            <div>
              <strong>用追问检查模型质量：看清前因后果，补齐关键因素，消除重复交叉，校准层级关系。</strong>
              <p>通过系统思维、MECE 与金字塔原则，对当前节点进行结构化提问。</p>
            </div>
          </div>

          <div className="knowledge-question-controls">
            <div className="knowledge-question-categories" aria-label="追问模板分类">
              {QUESTION_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={questionFilter === category.id ? 'is-active' : ''}
                  onClick={() => setQuestionFilter(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div className="knowledge-question-view-controls">
              <button type="button" onClick={() => setQuestionSort((current) => current === 'desc' ? 'asc' : 'desc')}>
                按创建时间 {questionSort === 'desc' ? '↓' : '↑'}
              </button>
              <button type="button" className={questionView === 'list' ? 'is-active' : ''} title="列表视图" onClick={() => setQuestionView('list')}>
                <List size={15} />
              </button>
              <button type="button" className={questionView === 'grid' ? 'is-active' : ''} title="卡片视图" onClick={() => setQuestionView('grid')}>
                <Grid2X2 size={15} />
              </button>
            </div>
          </div>

          <div className="knowledge-question-list-head">
            <strong>{questionFilter === 'all' ? '全部追问' : `${filterLabel}类追问`} · {filteredItems.length}</strong>
            <button type="button" onClick={() => generateQuestionTemplates(questionFilter)}>
              <Plus size={13} /> 生成{questionFilter === 'all' ? '默认' : filterLabel}模板
            </button>
          </div>

          <div className={`knowledge-question-list is-${questionView}`}>
            {filteredItems.map((item, index) => {
              const isEditing = editingItemId === item.id
              const itemType = getQuestionType(item)
              const itemStatus = getQuestionStatus(item.status)
              return (
                <article
                  key={item.id}
                  data-knowledge-item-id={item.id}
                  className={`knowledge-question-row${getFocusItemClass(item.id)}`}
                >
                  {isEditing ? renderItemEditor(item) : (
                    <>
                      <div className="knowledge-question-main">
                        <div className="knowledge-question-title-row">
                          <span className="knowledge-node-index">{String(index + 1).padStart(2, '0')}</span>
                          <strong>{item.title}</strong>
                          <span className={`knowledge-question-type is-${itemType}`}>{getQuestionCategoryLabel(itemType)}</span>
                          <span className={`knowledge-question-status is-${itemStatus}`}>{getQuestionStatusLabel(item.status)}</span>
                        </div>
                        <p>{item.plainText || item.content || '继续拆解这个节点背后的原因、条件或反例。'}</p>
                      </div>
                      <div className="knowledge-question-actions">
                        <button type="button" onClick={() => startEditItem(item)}>继续拆解</button>
                        <button type="button" onClick={() => convertQuestionToAction(item)} disabled={itemStatus === 'converted_to_action'}>
                          <ClipboardCheck size={13} /> {itemStatus === 'converted_to_action' ? '已转行动' : '转为行动'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItemPatch(item.id, { status: itemStatus === 'resolved' ? 'to_think' : 'resolved' })}
                        >
                          <CheckCircle2 size={13} /> {itemStatus === 'resolved' ? '取消解决' : '标记已解决'}
                        </button>
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
                            <MoreHorizontal size={15} />
                          </button>
                          {quoteActionMenuId === item.id && (
                            <div className="knowledge-quote-action-menu">
                              <button type="button" onClick={() => startEditItem(item)}>编辑</button>
                              <button type="button" className="is-danger" onClick={() => deleteItem(item.id)}><Trash2 size={13} /> 删除</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </article>
              )
            })}
            {filteredItems.length === 0 && (
              <div className="knowledge-question-empty">
                <CircleHelp size={24} />
                <strong>还没有{questionFilter === 'all' ? '' : filterLabel}类追问</strong>
                <p>可以新建一个问题，或从模板快速生成。</p>
                <button type="button" onClick={() => generateQuestionTemplates(questionFilter)}>生成追问模板</button>
              </div>
            )}
          </div>
        </div>
        <div className="knowledge-sticky-add">
          <button type="button" className="knowledge-workbench-add" onClick={startCreateItem}><Plus size={16} /> 新建追问</button>
          <div className="knowledge-workbench-count">共 {activeItems.length} 个追问</div>
        </div>
      </section>
    )
  }

  const renderExternalActionDetail = () => {
    if (!selectedAction || editingItemId === selectedAction.id) return null

    return (
      <aside className="knowledge-action-external-detail">
        <div className="knowledge-action-detail-head">
          <div>
            <strong>{selectedAction.title}</strong>
            <span className={`knowledge-action-priority-badge is-priority-${selectedAction.priority ?? 'medium'}`}>
              {selectedAction.priority === 'high' ? '高优先级' : selectedAction.priority === 'low' ? '低优先级' : '中优先级'}
            </span>
          </div>
          <div className="knowledge-action-detail-head-actions">
            <span className={`knowledge-action-status is-${getActionStatus(selectedAction.status)}`}>{getActionStatusLabel(selectedAction.status)}</span>
            <button type="button" title="关闭行动详情" onClick={() => setSelectedActionId(null)}><X size={14} /></button>
          </div>
        </div>
        <p className="knowledge-action-detail-description">
          {selectedAction.plainText || selectedAction.content || '为这项行动补充具体说明、执行条件与期望结果。'}
        </p>
        <div className="knowledge-action-detail-meta">
          <span><Calendar size={13} /> 截止时间：{getDueDateHint(selectedAction.dueDate)}</span>
          <span>创建时间：{new Date(selectedAction.createdAt).toLocaleDateString('zh-CN')}</span>
          <span>进度：{getActionProgress(selectedAction)}%</span>
          <div className="knowledge-progress-bar"><span style={{ width: `${getActionProgress(selectedAction)}%` }} /></div>
        </div>

        <div className="knowledge-action-steps">
          <strong>行动步骤</strong>
          {(selectedAction.actionSteps ?? []).map((step, index) => (
            <div key={step.id} className={`knowledge-action-step${step.isDone ? ' is-done' : ''}`}>
              <button type="button" onClick={() => toggleActionStep(selectedAction, step.id)}>
                {step.isDone && <Check size={11} />}
              </button>
              {editingActionStepId === step.id ? (
                <input
                  className="knowledge-action-step-edit"
                  value={editingActionStepDraft}
                  autoFocus
                  onChange={(event) => setEditingActionStepDraft(event.target.value)}
                  onBlur={() => saveActionStepTitle(selectedAction, step.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    if (event.key === 'Escape') {
                      setEditingActionStepId(null)
                      setEditingActionStepDraft('')
                    }
                  }}
                />
              ) : (
                <span
                  title="双击编辑步骤"
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    startEditActionStep(step)
                  }}
                >
                  {index + 1}. {step.title}
                </span>
              )}
              <button type="button" className="is-delete" title="删除步骤" onClick={() => deleteActionStep(selectedAction, step.id)}>
                <X size={12} />
              </button>
            </div>
          ))}
          <div className="knowledge-action-step-add">
            <input
              value={actionStepDraft}
              placeholder="添加一个可执行步骤..."
              onChange={(event) => setActionStepDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addActionStep(selectedAction)
              }}
            />
            <button type="button" onClick={() => addActionStep(selectedAction)}><Plus size={13} /> 添加</button>
          </div>
        </div>

        {selectedActionLinkedQuestion && (
          <button
            type="button"
            className="knowledge-action-linked-question"
            onClick={() => setActiveTagId(selectedActionLinkedQuestion.tagId)}
          >
            <CircleHelp size={14} />
            <span><small>关联追问</small>{selectedActionLinkedQuestion.title}</span>
            <ChevronDown size={13} />
          </button>
        )}

      </aside>
    )
  }

  const renderActionPage = () => {
    const doneCount = activeItems.filter((item) => getActionStatus(item.status) === 'done').length
    const progress = activeItems.length === 0 ? 0 : Math.round(doneCount / activeItems.length * 100)
    const actionIds = new Set(activeItems.map((item) => item.id))
    const rootActions = activeItems.filter((item) => !item.parentActionId || !actionIds.has(item.parentActionId))
    const priorityWeight = { high: 0, medium: 1, low: 2 }
    const compareActions = (left: NodeKnowledgeItem, right: NodeKnowledgeItem) => {
      if (actionSort === 'createdAt') return right.createdAt - left.createdAt
      if (actionSort === 'priority') {
        return priorityWeight[left.priority ?? 'medium'] - priorityWeight[right.priority ?? 'medium']
      }
      return (left.dueDate || '9999-12-31').localeCompare(right.dueDate || '9999-12-31')
    }
    const orderedActions: Array<{ item: NodeKnowledgeItem; depth: number }> = []
    const visited = new Set<string>()
    const appendAction = (item: NodeKnowledgeItem, depth: number) => {
      if (visited.has(item.id)) return
      visited.add(item.id)
      orderedActions.push({ item, depth })
      activeItems
        .filter((child) => child.parentActionId === item.id)
        .sort(compareActions)
        .forEach((child) => appendAction(child, depth + 1))
    }
    rootActions
      .sort(compareActions)
      .forEach((item) => appendAction(item, 0))
    activeItems.filter((item) => !visited.has(item.id)).forEach((item) => appendAction(item, 0))

    const visibleActions = orderedActions.filter(({ item }) => {
      const status = getActionStatus(item.status)
      if (actionFilter === 'today') return isTodayDate(item.dueDate)
      if (actionFilter === 'in_progress') return status === 'in_progress'
      if (actionFilter === 'todo') return status === 'todo'
      if (actionFilter === 'done') return status === 'done'
      return true
    })
    const contextAction = actionContextMenu
      ? activeItems.find((item) => item.id === actionContextMenu.itemId)
      : undefined
    const priorityAction = actionPriorityMenu
      ? activeItems.find((item) => item.id === actionPriorityMenu.itemId)
      : undefined
    return (
      <section className="knowledge-page knowledge-page-action has-sticky-action">
        <div className="knowledge-page-scroll">
          <div className="knowledge-action-goal">
            <div>
              <strong><Target size={18} /> 行动目标</strong>
              <p>将因果洞察转化为具体行动，打破模式，建立新的回应方式。</p>
            </div>
            <div className="knowledge-action-goal-progress">
              <div className="knowledge-progress-ring" style={{ '--progress': `${progress}%` } as CSSProperties}>
                <span>{progress}%</span>
              </div>
              <small>{doneCount} / {activeItems.length} 已完成</small>
            </div>
          </div>

          <div className="knowledge-action-toolbar">
            <div className="knowledge-action-filters">
              {ACTION_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={actionFilter === filter.id ? 'is-active' : ''}
                  onClick={() => setActionFilter(filter.id)}
                >
                  {filter.label}{filter.id === 'all' ? `（${activeItems.length}）` : ''}
                </button>
              ))}
            </div>
            <div className="knowledge-action-tools">
              <select value={actionSort} onChange={(event) => setActionSort(event.target.value as ActionSort)} title="排序方式">
                <option value="dueDate">截止时间</option>
                <option value="createdAt">创建时间</option>
                <option value="priority">优先级</option>
              </select>
              <button type="button" className={actionView === 'list' ? 'is-active' : ''} title="列表视图" onClick={() => setActionView('list')}><List size={14} /></button>
              <button type="button" className={actionView === 'card' ? 'is-active' : ''} title="卡片视图" onClick={() => setActionView('card')}><Grid2X2 size={14} /></button>
            </div>
          </div>

          <div className={`knowledge-action-list is-${actionView}`}>
            {visibleActions.map(({ item, depth }) => {
              const isEditing = editingItemId === item.id
              const itemProgress = getActionProgress(item)
              const itemStatus = getActionStatus(item.status)
              return (
                <article
                  key={item.id}
                  data-knowledge-item-id={item.id}
                  className={`knowledge-action-row${depth > 0 ? ' is-child' : ''}${selectedActionId === item.id ? ' is-selected' : ''}${itemStatus === 'done' ? ' is-done' : ''}${getFocusItemClass(item.id)}`}
                  style={{ '--action-depth': Math.min(depth, 4) } as CSSProperties}
                  onClick={() => toggleActionDetail(item.id)}
                  onDoubleClick={() => !isEditing && startEditItem(item)}
                  onContextMenu={(event) => !isEditing && openActionContextMenu(event, item.id)}
                >
                  {isEditing ? renderItemEditor(item) : (
                    <>
                      <button
                        type="button"
                        className={`knowledge-check${item.status === 'done' ? ' is-checked' : ''}`}
                        title={item.status === 'done' ? '标记为未完成' : '标记为已完成'}
                        onClick={(event) => {
                          event.stopPropagation()
                          updateItemPatch(item.id, { status: itemStatus === 'done' ? 'todo' : 'done', progress: itemStatus === 'done' ? 0 : 100 })
                        }}
                      >
                        {itemStatus === 'done' && <Check size={13} />}
                      </button>
                      <div className="knowledge-action-content">
                        <strong>{item.title}</strong>
                      </div>
                      <div className="knowledge-action-due">
                        <button
                          type="button"
                          title="选择预计完成时间"
                          onClick={(event) => {
                            event.stopPropagation()
                            const input = event.currentTarget.nextElementSibling as HTMLInputElement | null
                            if (typeof input?.showPicker === 'function') input.showPicker()
                            else input?.click()
                          }}
                        >
                          <Calendar size={14} />
                          <span>{item.dueDate?.replaceAll('-', '/') ?? '未设置'}</span>
                        </button>
                        <input
                          className="knowledge-action-date-picker"
                          type="date"
                          tabIndex={-1}
                          value={item.dueDate ?? ''}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => updateItemPatch(item.id, { dueDate: event.target.value })}
                        />
                      </div>
                      <button
                        type="button"
                        className={`knowledge-action-priority is-priority-${item.priority ?? 'medium'}`}
                        title="选择优先级"
                        onClick={(event) => openActionPriorityMenu(event, item.id)}
                      >
                        {item.priority === 'high' ? '高' : item.priority === 'low' ? '低' : '中'}
                        <ChevronDown size={12} />
                      </button>
                      <span className={`knowledge-action-status is-${itemStatus}`}>{getActionStatusLabel(item.status)}</span>
                      <div className="knowledge-action-compact-progress">
                        <div className="knowledge-progress-bar"><span style={{ width: `${itemProgress}%` }} /></div>
                        <small>{itemProgress}%</small>
                      </div>
                    </>
                  )}
                </article>
              )
            })}
            {visibleActions.length === 0 && (
              <div className="knowledge-action-empty">
                <Target size={24} />
                <strong>当前筛选下没有行动</strong>
                <p>可以切换筛选条件，或新建一个可执行的小行动。</p>
              </div>
            )}
          </div>
          {actionContextMenu && contextAction && createPortal(
            <div
              className="knowledge-action-context-menu"
              style={{ left: actionContextMenu.x, top: actionContextMenu.y }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              <button type="button" onClick={() => startEditItem(contextAction)}><Pencil size={14} /> 编辑</button>
              <button type="button" onClick={() => startCreateAction(contextAction.id)}><Plus size={14} /> 新建子行动</button>
              <button type="button" className="is-danger" onClick={() => deleteItem(contextAction.id)}><Trash2 size={14} /> 删除</button>
            </div>,
            document.body,
          )}
          {actionPriorityMenu && priorityAction && createPortal(
            <div
              className="knowledge-action-priority-menu"
              style={{ left: actionPriorityMenu.x, top: actionPriorityMenu.y }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {(['high', 'medium', 'low'] as const).map((priority) => (
                <button
                  key={priority}
                  type="button"
                  className={`is-priority-${priority}${priorityAction.priority === priority ? ' is-active' : ''}`}
                  onClick={() => {
                    updateItemPatch(priorityAction.id, { priority })
                    setActionPriorityMenu(null)
                  }}
                >
                  <span />
                  {priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}
                  {priorityAction.priority === priority && <Check size={13} />}
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>
        <div className="knowledge-sticky-add knowledge-action-sticky-add">
          <button type="button" className="knowledge-workbench-add" onClick={() => startCreateAction()}><Plus size={16} /> 新建行动</button>
          <div className="knowledge-workbench-count">共 {activeItems.length} 个行动</div>
        </div>
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
      className={`node-knowledge-panel knowledge-workbench${selectedAction ? ' has-external-action-detail' : ''}`}
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

      {renderExternalActionDetail()}
      {renderPanelToolbar()}
      <main
        className="knowledge-workbench-content"
        onClick={() => {
          setQuoteActionMenuId(null)
          setChainContextMenu(null)
        }}
      >
        {renderActivePage()}
      </main>
      {renderTagContextMenu()}
      {renderTagDialog()}
    </div>
  )
}
