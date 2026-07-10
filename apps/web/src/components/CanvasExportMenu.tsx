import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Download, FileText, FileUp, ImageDown } from 'lucide-react'

type ImageExportResolution = '2k' | '4k'

type CanvasExportMenuProps = {
  open: boolean
  onExportImage: (resolution: ImageExportResolution) => void
  onExportSvg: () => void
  onExportOutlineMarkdown: () => void
  onExportKnowledgeMarkdown: () => void
  onImportMarkdown?: () => void
  onRequestClose?: () => void
}

export function CanvasExportMenu({
  open,
  onExportImage,
  onExportSvg,
  onExportOutlineMarkdown,
  onExportKnowledgeMarkdown,
  onImportMarkdown,
  onRequestClose
}: CanvasExportMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const [markdownMenuOpen, setMarkdownMenuOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const closeMenu = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && menuRef.current?.contains(target)) return
      onRequestClose?.()
    }

    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [onRequestClose, open])

  if (!open) return null

  return (
    <div
      ref={menuRef}
      className="canvas-export-menu"
      onMouseLeave={() => {
        setImageMenuOpen(false)
        setMarkdownMenuOpen(false)
      }}
    >
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => {
          setImageMenuOpen(true)
          setMarkdownMenuOpen(false)
        }}
      >
        <button className="canvas-export-menu-item">
          <ImageDown size={15} />
          <span>导出图片</span>
          <ChevronRight size={14} />
        </button>
        {imageMenuOpen && (
          <div className="canvas-export-submenu">
            <button className="canvas-export-menu-item" onClick={() => onExportImage('2k')}>
              <Download size={14} />
              <span>2K PNG</span>
              <span />
            </button>
            <button className="canvas-export-menu-item" onClick={() => onExportImage('4k')}>
              <Download size={14} />
              <span>4K PNG</span>
              <span />
            </button>
            <button className="canvas-export-menu-item" onClick={onExportSvg}>
              <Download size={14} />
              <span>SVG</span>
              <span />
            </button>
          </div>
        )}
      </div>
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => {
          setImageMenuOpen(false)
          setMarkdownMenuOpen(true)
        }}
      >
        <button className="canvas-export-menu-item is-active">
          <FileText size={15} />
          <span>导出 MD</span>
          <ChevronRight size={14} />
        </button>
        {markdownMenuOpen && (
          <div className="canvas-export-submenu">
            <button className="canvas-export-menu-item" onClick={onExportOutlineMarkdown}>
              <Download size={14} />
              <span>层级 MD</span>
              <span />
            </button>
            <button className="canvas-export-menu-item" onClick={onExportKnowledgeMarkdown}>
              <Download size={14} />
              <span>知识 MD</span>
              <span />
            </button>
          </div>
        )}
      </div>
      {onImportMarkdown && (
        <button className="canvas-export-menu-item" onClick={onImportMarkdown}>
          <FileUp size={15} />
          <span>导入 MD</span>
          <span />
        </button>
      )}
    </div>
  )
}
