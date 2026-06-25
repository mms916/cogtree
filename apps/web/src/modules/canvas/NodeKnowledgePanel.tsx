import { useEffect, useMemo, useRef, useState } from 'react'
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
  ChevronDown,
  ChevronUp,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Quote,
  Redo2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from 'lucide-react'

import type { BaseNode, NodeNote } from '../../stores/useDocumentStore'
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
  onUpdateNotes: (notes: NodeNote[]) => void
  onUpdateMeta?: (meta: Record<string, unknown>) => void
  style?: React.CSSProperties
}

type RichTextEditorHandle = {
  persist: () => void
}

type MainKnowledgeEditorProps = {
  initialHtml: string
  onPersist: (payload: { html: string; text: string }) => void
}

const PANEL_MIN_WIDTH = 360
const PANEL_MAX_WIDTH = 760
const PANEL_DEFAULT_WIDTH = 420
const MAIN_NOTE_ID = 'main-knowledge-note'
const DEFAULT_TEXT_COLOR = '#e2e8f0'
const KNOWLEDGE_TEXT_COLORS = [
  '#f8fafc',
  '#cbd5e1',
  '#94a3b8',
  '#2dd4bf',
  '#38bdf8',
  '#60a5fa',
  '#818cf8',
  '#a78bfa',
  '#f472b6',
  '#fb7185',
  '#f87171',
  '#fb923c',
  '#facc15',
  '#a3e635',
  '#4ade80',
  '#34d399',
]
const DEFAULT_RECENT_TEXT_COLORS = ['#f8fafc', '#2dd4bf', '#60a5fa', '#f87171']

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

function clampPanelWidth(width: number) {
  return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, Math.round(width)))
}

function getPanelWidthFromStyle(style?: React.CSSProperties) {
  const width = style?.width
  if (typeof width === 'number') return clampPanelWidth(width)
  if (typeof width === 'string') {
    const parsed = Number.parseFloat(width)
    if (Number.isFinite(parsed)) return clampPanelWidth(parsed)
  }
  return PANEL_DEFAULT_WIDTH
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

function getNoteHtml(note: NodeNote) {
  return note.contentHtml || plainTextToHtml(note.content)
}

function normalizeEditorHtml(html: string) {
  return html.trim() || '<p></p>'
}

function getInitialKnowledgeHtml(notes: NodeNote[]) {
  if (notes.length === 0) return '<p></p>'
  if (notes.length === 1) return getNoteHtml(notes[0])

  return notes
    .map((note) => {
      const title = note.title?.trim()
      const html = getNoteHtml(note)
      return `${title ? `<h2>${escapeHtml(title)}</h2>` : ''}${html}`
    })
    .join('')
}

function MainKnowledgeEditor({ initialHtml, onPersist }: MainKnowledgeEditorProps) {
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null)
  const latestPayloadRef = useRef({ html: normalizeEditorHtml(initialHtml), text: '' })
  const persistRef = useRef(onPersist)
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false)
  const [recentTextColors, setRecentTextColors] = useState(DEFAULT_RECENT_TEXT_COLORS)
  const [activeTextColor, setActiveTextColor] = useState(DEFAULT_TEXT_COLOR)

  useEffect(() => {
    persistRef.current = onPersist
  }, [onPersist])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
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
        class: 'knowledge-rich-editor-content knowledge-main-editor-content',
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
      latestPayloadRef.current = {
        html: normalizeEditorHtml(activeEditor.getHTML()),
        text: activeEditor.getText().trim(),
      }
    },
    onBlur: ({ editor: activeEditor }) => {
      persistRef.current({
        html: normalizeEditorHtml(activeEditor.getHTML()),
        text: activeEditor.getText().trim(),
      })
    },
  })

  useEffect(() => {
    return () => {
      persistRef.current(latestPayloadRef.current)
    }
  }, [])

  const persistHandle = useMemo<RichTextEditorHandle>(() => ({
    persist: () => {
      if (!editor) return
      persistRef.current({
        html: normalizeEditorHtml(editor.getHTML()),
        text: editor.getText().trim(),
      })
    },
  }), [editor])

  useEffect(() => {
    ;(window as typeof window & { __cogtreeKnowledgeEditor?: RichTextEditorHandle }).__cogtreeKnowledgeEditor = persistHandle
    return () => {
      const target = window as typeof window & { __cogtreeKnowledgeEditor?: RichTextEditorHandle }
      if (target.__cogtreeKnowledgeEditor === persistHandle) {
        delete target.__cogtreeKnowledgeEditor
      }
    }
  }, [persistHandle])

  const runCommand = (event: React.MouseEvent, command: () => void) => {
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
    <div className="knowledge-rich-editor knowledge-main-editor">
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
          <button type="button" title="一级标题" className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}><Heading1 size={14} /></button>
          <button type="button" title="二级标题" className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}><Heading2 size={14} /></button>
        </div>
        <div className="knowledge-toolbar-group" aria-label="文字样式">
          <button type="button" title="加粗" className={editor.isActive('bold') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleBold().run())}><Bold size={14} /></button>
          <button type="button" title="斜体" className={editor.isActive('italic') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleItalic().run())}><Italic size={14} /></button>
          <button type="button" title="下划线" className={editor.isActive('underline') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleUnderline().run())}><UnderlineIcon size={14} /></button>
          <button type="button" className="knowledge-toolbar-text-btn" title="大号字体" onMouseDown={(event) => runCommand(event, () => editor.chain().focus().setMark('textStyle', { fontSize: '18px' }).run())}>大</button>
          <button type="button" className="knowledge-toolbar-text-btn" title="正常字体" onMouseDown={(event) => runCommand(event, () => editor.chain().focus().setMark('textStyle', { fontSize: null }).run())}>正</button>
          <div className="knowledge-rich-color-wrap" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={`knowledge-rich-color-trigger ${isColorPaletteOpen ? 'is-active' : ''}`}
              title="文字颜色"
              onMouseDown={(event) => runCommand(event, () => setIsColorPaletteOpen((current) => !current))}
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
                        style={{ '--swatch-color': color } as React.CSSProperties}
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
                        style={{ '--swatch-color': color } as React.CSSProperties}
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
          <button type="button" title="有序列表" className={editor.isActive('orderedList') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleOrderedList().run())}><ListOrdered size={14} /></button>
          <button type="button" title="引用" className={editor.isActive('blockquote') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().toggleBlockquote().run())}><Quote size={14} /></button>
        </div>
        <div className="knowledge-toolbar-group" aria-label="插入">
          <button type="button" title="链接" className={editor.isActive('link') ? 'is-active' : ''} onMouseDown={(event) => runCommand(event, addLink)}><Link2 size={14} /></button>
          <button type="button" title="插入图片" onMouseDown={(event) => runCommand(event, () => inlineImageInputRef.current?.click())}><ImagePlus size={14} /></button>
        </div>
        <div className="knowledge-toolbar-group knowledge-toolbar-history" aria-label="历史记录">
          <button type="button" title="撤销" disabled={!editor.can().undo()} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().undo().run())}><Undo2 size={14} /></button>
          <button type="button" title="重做" disabled={!editor.can().redo()} onMouseDown={(event) => runCommand(event, () => editor.chain().focus().redo().run())}><Redo2 size={14} /></button>
        </div>
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
  onUpdateNotes,
  style
}: NodeKnowledgePanelProps) {
  const [panelWidth, setPanelWidth] = useState(() => getPanelWidthFromStyle(style))
  const [isQuoteExpanded, setIsQuoteExpanded] = useState(false)
  const [isEditorExpanded, setIsEditorExpanded] = useState(true)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const latestPanelWidthRef = useRef(panelWidth)
  const hasUserResizedRef = useRef(false)

  const notes = selectedNode.meta?.notes ?? []
  const initialKnowledgeHtml = useMemo(() => getInitialKnowledgeHtml(notes), [selectedNode.id])
  const firstQuote = linkedQuotes[0]

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

  const persistMainNote = (richContent: { html: string; text: string }) => {
    const content = richContent.text.trim()
    const contentHtml = normalizeEditorHtml(richContent.html)
    const existingNote = notes[0]
    const note: NodeNote = {
      id: existingNote?.id ?? MAIN_NOTE_ID,
      title: '节点知识',
      content,
      contentHtml,
      createdAt: existingNote?.createdAt ?? Date.now(),
    }

    const unchanged = notes.length === 1 && notes[0]?.content === content && notes[0]?.contentHtml === contentHtml
    if (unchanged) return
    onUpdateNotes(content || contentHtml !== '<p></p>' ? [note] : [])
  }

  const stopPanelEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation()
  }

  const startPanelResize = (event: React.MouseEvent<HTMLDivElement>) => {
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

  return (
    <div
      ref={panelRef}
      className="node-knowledge-panel knowledge-panel-v2"
      style={{
        ...style,
        width: panelWidth
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

      <header className="knowledge-panel-v2-header">
        <div className="knowledge-panel-v2-titlebar">
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
            className="knowledge-panel-v2-node-input"
            placeholder="节点名称"
          />
          <button
            type="button"
            className="icon-btn"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
            title="关闭面板"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="knowledge-panel-v2-content">
        <section className="knowledge-panel-v2-section">
          <button
            type="button"
            className="knowledge-panel-v2-section-toggle"
            onClick={() => setIsQuoteExpanded((value) => !value)}
            disabled={linkedQuotes.length === 0}
          >
            <span><Link2 size={14} /> 关联金句</span>
            {linkedQuotes.length > 0 && (isQuoteExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />)}
          </button>
          {firstQuote ? (
            <div className={`knowledge-linked-quote knowledge-linked-quote-v2${isQuoteExpanded ? ' is-expanded' : ''}`}>
              {firstQuote.title && <div className="knowledge-linked-quote-title">{firstQuote.title}</div>}
              <div>{firstQuote.text}</div>
              {firstQuote.page && <div className="knowledge-linked-quote-page">{firstQuote.page}</div>}
              {isQuoteExpanded && linkedQuotes.slice(1).map((quote) => (
                <div key={`${selectedNode.id}-${quote.id}`} className="knowledge-linked-quote-extra">
                  {quote.text}
                </div>
              ))}
            </div>
          ) : (
            <div className="knowledge-empty-inline">暂无关联金句</div>
          )}
        </section>

        <section className="knowledge-panel-v2-section knowledge-panel-v2-editor-section">
          <div className="knowledge-panel-v2-editor-head">
            <h3>笔记</h3>
            <button type="button" onClick={() => setIsEditorExpanded((value) => !value)}>
              {isEditorExpanded ? '收起编辑' : '展开编辑'}
            </button>
          </div>

          {isEditorExpanded ? (
            <MainKnowledgeEditor
              key={selectedNode.id}
              initialHtml={initialKnowledgeHtml}
              onPersist={persistMainNote}
            />
          ) : (
            <div
              className="knowledge-main-preview knowledge-rich-display"
              dangerouslySetInnerHTML={{
                __html: notes[0] ? getNoteHtml(notes[0]) : '<p>暂无笔记，展开编辑后记录这个节点的判断、证据和下一步行动。</p>',
              }}
            />
          )}
        </section>
      </div>
    </div>
  )
}
