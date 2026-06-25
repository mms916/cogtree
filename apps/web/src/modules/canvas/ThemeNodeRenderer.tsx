import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { Gift, Heart, Lightbulb, Rocket, Shield, Sparkles, Users } from 'lucide-react'

import type { BaseNode } from '../../stores/useDocumentStore'

type ThemeNodeData = Node<
  BaseNode & {
    depth: number
    branchIndex: number
    branchColor: string
    branchIcon: string
    isEditing: boolean
    editDraft: string
    isDropTarget: boolean
    dropPreviewMode: 'child' | 'sibling' | 'invalid' | null
    isCollapsed: boolean
    onStartEdit: () => void
    onEditDraftChange: (value: string) => void
    onSaveEdit: (value?: string) => void
    onCancelEdit: () => void
    onAddChild: () => void
    onAddSibling: () => void
    onDelete: () => void
    onToggleCollapsed: () => void
    onOpenKnowledge: () => void
    onResizeImage: (size: { width: number; height: number }, commit?: boolean) => void
    onResizeNote: (size: { width: number; height: number }, commit?: boolean) => void
    onUpdateNoteMeta: (meta: { noteBadge?: string; noteBody?: string }, commit?: boolean) => void
  }
>

const branchIcons = {
  gift: Gift,
  heart: Heart,
  lightbulb: Lightbulb,
  rocket: Rocket,
  shield: Shield,
  users: Users,
}

export const ThemeNodeRenderer = memo(({ data, selected }: NodeProps<ThemeNodeData>) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const noteEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const updateNodeInternals = useUpdateNodeInternals()
  const selectedEditSessionRef = useRef<string | null>(null)
  const userInteractedWithEditRef = useRef(false)
  const isComposingRef = useRef(false)
  const [localDraft, setLocalDraft] = useState(data.editDraft)
  const isRoot = data.parentId === null
  const isBranch = data.depth === 1
  const isLeaf = data.depth >= 2
  const nodeImages = data.meta?.nodeImages ?? []
  const isCanvasImage = data.meta?.canvasImage === true && nodeImages.length > 0
  const imageSize = isCanvasImage && data.meta?.imageSize
    && typeof data.meta.imageSize.width === 'number'
    && typeof data.meta.imageSize.height === 'number'
    ? data.meta.imageSize
    : { width: 260, height: 180 }
  const isCanvasNote = data.meta?.canvasNote === true
  const noteSize = isCanvasNote && data.meta?.noteSize
    && typeof data.meta.noteSize.width === 'number'
    && typeof data.meta.noteSize.height === 'number'
    ? data.meta.noteSize
    : { width: 330, height: 220 }
  const noteNumber = String((data.orderIndex ?? 0) + 1).padStart(3, '0')
  const noteBadge = typeof data.meta?.noteBadge === 'string' ? data.meta.noteBadge : '心理成长洞见'
  const noteBody = typeof data.meta?.noteBody === 'string'
    ? data.meta.noteBody
    : '在这里记录这个洞见的背景、判断和下一步行动。'
  const Icon = branchIcons[data.branchIcon as keyof typeof branchIcons] ?? Lightbulb
  const isChildPreview = data.isDropTarget && data.dropPreviewMode === 'child'
  const isSiblingPreview = data.isDropTarget && data.dropPreviewMode === 'sibling'
  const isInvalidPreview = data.isDropTarget && data.dropPreviewMode === 'invalid'
  const isImportant = data.meta?.isImportant === true
  const nodeColor = isImportant ? '#ef4444' : isRoot ? '#4f46e5' : data.branchColor
  const nodeClassName = [
    'tree-node',
    isRoot ? 'tree-node-root' : '',
    isBranch ? 'tree-node-branch' : '',
    isLeaf ? 'tree-node-leaf' : '',
    isCanvasImage ? 'tree-node-image' : '',
    isCanvasNote ? 'tree-node-note' : '',
    isImportant ? 'is-important' : '',
    selected ? 'is-selected' : '',
    isChildPreview ? 'is-child-preview' : '',
    isSiblingPreview ? 'is-sibling-preview' : '',
    isInvalidPreview ? 'is-invalid-preview' : '',
  ].filter(Boolean).join(' ')

  useEffect(() => {
    if (!data.isEditing) return
    setLocalDraft(data.editDraft)
  }, [data.id, data.isEditing, data.editDraft])

  useLayoutEffect(() => {
    updateNodeInternals(data.id)
  }, [data.id, imageSize.width, imageSize.height, noteSize.width, noteSize.height, updateNodeInternals])

  useLayoutEffect(() => {
    if (!data.isEditing || (!inputRef.current && !noteEditorRef.current)) return

    const input = inputRef.current ?? noteEditorRef.current
    if (!input) return
    const shouldSelectAll = selectedEditSessionRef.current !== data.id

    input.focus({ preventScroll: true })
    if (!shouldSelectAll) return

    selectedEditSessionRef.current = data.id

    const focusAndSelect = () => {
      const currentInput = inputRef.current ?? noteEditorRef.current
      if (!currentInput || userInteractedWithEditRef.current) return
      currentInput.focus({ preventScroll: true })
      currentInput.select()
    }

    focusAndSelect()
    const frameId = window.requestAnimationFrame(focusAndSelect)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [data.id, data.isEditing])

  useLayoutEffect(() => {
    if (data.isEditing) return
    selectedEditSessionRef.current = null
    userInteractedWithEditRef.current = false
  }, [data.isEditing])

  const shouldKeepEditingInsideNote = (event: React.FocusEvent<HTMLElement>) => {
    if (!isCanvasNote) return false
    const noteElement = event.currentTarget.closest('.tree-node-note')
    const nextFocusedElement = event.relatedTarget as HTMLElement | null
    return Boolean(noteElement && nextFocusedElement && noteElement.contains(nextFocusedElement))
  }

  const shouldSaveAfterBlur = (event: React.FocusEvent<HTMLElement>) => {
    const nodeElement = event.currentTarget.closest('.tree-node')
    const nextFocusedElement = event.relatedTarget as HTMLElement | null
    return Boolean(nextFocusedElement && (!nodeElement || !nodeElement.contains(nextFocusedElement)))
  }

  const refocusAfterTransientBlur = (input: HTMLInputElement | HTMLTextAreaElement | null) => {
    window.setTimeout(() => {
      if (!input || !input.isConnected) return
      if (document.activeElement && document.activeElement !== document.body) return
      input.focus({ preventScroll: true })
    }, 0)
  }

  const isComposingEvent = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => (
    isComposingRef.current || event.nativeEvent.isComposing
  )

  return (
    <>
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            visibility: 'hidden',
          }}
        />
      )}

      <div
        className={nodeClassName}
        onDoubleClick={(event) => {
          event.stopPropagation()
          data.onStartEdit()
        }}
        style={{
          '--node-color': isInvalidPreview ? '#f87171' : nodeColor,
          '--node-glow': `${nodeColor}33`,
          ...(isCanvasImage ? {
            width: `${imageSize.width}px`,
            height: `${imageSize.height}px`,
          } : {}),
          ...(isCanvasNote ? {
            width: `${noteSize.width}px`,
            minHeight: `${noteSize.height}px`,
          } : {}),
        } as CSSProperties}
      >
        {isChildPreview && <div className="tree-node-child-preview" />}
        {isSiblingPreview && <div className="tree-node-sibling-preview" />}
        {data.isCollapsed && <div className="tree-node-collapse-dot" />}
        <button
          type="button"
          className="tree-node-info-button nodrag nopan"
          data-node-id={data.id}
          title="Open knowledge panel"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            data.onOpenKnowledge()
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            data.onOpenKnowledge()
          }}
          onMouseUp={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            data.onOpenKnowledge()
          }}
          onPointerUp={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          i
        </button>
        {isCanvasImage ? (
          <div className="tree-node-image-content">
            {nodeImages.map((image) => (
              <img key={image.id} src={image.src} alt={image.name ?? data.label} draggable={false} />
            ))}
          </div>
        ) : isCanvasNote ? (
          <div className="tree-node-note-shell">
            <div className="tree-node-note-corner">
              <Sparkles size={28} strokeWidth={1.8} />
            </div>
            <div className="tree-node-note-badge">
              <span />
              {data.isEditing ? (
                <input
                  className="nodrag nopan"
                  value={noteBadge}
                  onChange={(event) => data.onUpdateNoteMeta({ noteBadge: event.target.value })}
                  onBlur={() => data.onUpdateNoteMeta({ noteBadge }, true)}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onMouseUp={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                />
              ) : (
                noteBadge
              )}
            </div>
            {data.isEditing ? (
              <textarea
                ref={noteEditorRef}
              autoFocus
              value={localDraft}
              onChange={(event) => {
                setLocalDraft(event.target.value)
              }}
              onBlur={(event) => {
                if (isComposingRef.current) {
                  window.setTimeout(() => noteEditorRef.current?.focus({ preventScroll: true }), 0)
                  return
                }
                if (shouldKeepEditingInsideNote(event)) return
                if (!shouldSaveAfterBlur(event)) {
                  refocusAfterTransientBlur(noteEditorRef.current)
                  return
                }
                data.onSaveEdit(localDraft)
              }}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onCompositionStart={() => {
                isComposingRef.current = true
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false
              }}
              onMouseDown={(event) => {
                userInteractedWithEditRef.current = true
                event.stopPropagation()
              }}
              onMouseUp={(event) => event.stopPropagation()}
              onPointerDown={(event) => {
                userInteractedWithEditRef.current = true
                event.stopPropagation()
              }}
              onPointerUp={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (isComposingEvent(event)) return
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault()
                    data.onSaveEdit(localDraft)
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    data.onCancelEdit()
                  }
                }}
              className="tree-node-note-editor nodrag nopan"
            />
            ) : (
              <div className="tree-node-note-content">{data.label}</div>
            )}
            <div className="tree-node-note-divider" />
            {data.isEditing ? (
              <textarea
                value={noteBody}
                onChange={(event) => data.onUpdateNoteMeta({ noteBody: event.target.value })}
                onBlur={() => data.onUpdateNoteMeta({ noteBody }, true)}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onMouseUp={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (isComposingEvent(event)) return
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault()
                    data.onUpdateNoteMeta({ noteBody }, true)
                    data.onSaveEdit()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    data.onCancelEdit()
                  }
                }}
                className="tree-node-note-body-editor nodrag nopan"
              />
            ) : (
              <div className="tree-node-note-body">{noteBody}</div>
            )}
            <div className="tree-node-note-footer">
              <span>INSIGHT · {noteNumber}</span>
              <div>
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        ) : isBranch && (
          <span className="tree-node-branch-icon">
            <Icon size={19} strokeWidth={1.8} />
          </span>
        )}
        {!isCanvasImage && !isCanvasNote && data.isEditing ? (
          <input
            ref={inputRef}
            autoFocus
            value={localDraft}
            onChange={(event) => {
              setLocalDraft(event.target.value)
            }}
            onBlur={(event) => {
              if (isComposingRef.current) {
                window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0)
                return
              }
              if (!shouldSaveAfterBlur(event)) {
                refocusAfterTransientBlur(inputRef.current)
                return
              }
              data.onSaveEdit(localDraft)
            }}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onCompositionStart={() => {
              isComposingRef.current = true
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false
            }}
            onMouseDown={(event) => {
              userInteractedWithEditRef.current = true
              event.stopPropagation()
            }}
            onMouseUp={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              userInteractedWithEditRef.current = true
              event.stopPropagation()
            }}
            onPointerUp={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (isComposingEvent(event)) return
              if (event.key === 'Enter') {
                event.preventDefault()
                data.onSaveEdit(localDraft)
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                data.onCancelEdit()
              }
            }}
            className="tree-node-edit-input nodrag nopan"
          />
        ) : !isCanvasImage && !isCanvasNote && isLeaf ? (
          <div className="tree-node-leaf-title">
            <span>{data.label}</span>
          </div>
        ) : !isCanvasImage && !isCanvasNote ? (
          <div className="tree-node-title">{data.label}</div>
        ) : null}
        {!isCanvasImage && !isCanvasNote && nodeImages.length > 0 && (
          <div className="tree-node-image-strip">
            {nodeImages.slice(0, 3).map((image) => (
              <img key={image.id} src={image.src} alt={image.name ?? data.label} draggable={false} />
            ))}
            {nodeImages.length > 3 && <span>+{nodeImages.length - 3}</span>}
          </div>
        )}
        {isCanvasImage && (
          <button
            type="button"
            className="tree-node-resize-handle tree-node-image-resize"
            title="调整图片大小"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const startX = event.clientX
              const startY = event.clientY
              const startWidth = imageSize.width
              const startHeight = imageSize.height

              const handlePointerMove = (moveEvent: PointerEvent) => {
                data.onResizeImage({
                  width: startWidth + moveEvent.clientX - startX,
                  height: startHeight + moveEvent.clientY - startY,
                })
              }

              const handlePointerUp = (upEvent: PointerEvent) => {
                window.removeEventListener('pointermove', handlePointerMove)
                window.removeEventListener('pointerup', handlePointerUp)
                data.onResizeImage({
                  width: startWidth + upEvent.clientX - startX,
                  height: startHeight + upEvent.clientY - startY,
                }, true)
              }

              window.addEventListener('pointermove', handlePointerMove)
              window.addEventListener('pointerup', handlePointerUp, { once: true })
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          />
        )}
        {isCanvasNote && (
          <button
            type="button"
            className="tree-node-resize-handle tree-node-note-resize"
            title="调整便签大小"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const startX = event.clientX
              const startY = event.clientY
              const startWidth = noteSize.width
              const startHeight = noteSize.height

              const handlePointerMove = (moveEvent: PointerEvent) => {
                data.onResizeNote({
                  width: startWidth + moveEvent.clientX - startX,
                  height: startHeight + moveEvent.clientY - startY,
                })
              }

              const handlePointerUp = (upEvent: PointerEvent) => {
                window.removeEventListener('pointermove', handlePointerMove)
                window.removeEventListener('pointerup', handlePointerUp)
                data.onResizeNote({
                  width: startWidth + upEvent.clientX - startX,
                  height: startHeight + upEvent.clientY - startY,
                }, true)
              }

              window.addEventListener('pointermove', handlePointerMove)
              window.addEventListener('pointerup', handlePointerUp, { once: true })
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          visibility: 'hidden',
        }}
      />
    </>
  )
})
