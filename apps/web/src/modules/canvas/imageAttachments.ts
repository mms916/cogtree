import type { NodeImageAttachment } from '../../stores/useDocumentStore'

const MAX_IMAGE_DIMENSION = 1600
const COMPRESSION_THRESHOLD_BYTES = 900 * 1024
const COMPRESSED_IMAGE_QUALITY = 0.82

function generateImageAttachmentId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unsupported image data'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = src
  })
}

async function normalizeImageDataUrl(file: File, sourceDataUrl: string) {
  if (file.type === 'image/gif') {
    return { src: sourceDataUrl, type: file.type }
  }

  try {
    const image = await loadImage(sourceDataUrl)
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
    const shouldCompress = scale < 1 || file.size > COMPRESSION_THRESHOLD_BYTES

    if (!shouldCompress) {
      return { src: sourceDataUrl, type: file.type }
    }

    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')

    if (!context) {
      return { src: sourceDataUrl, type: file.type }
    }

    context.drawImage(image, 0, 0, width, height)

    const outputType = file.type === 'image/png' && file.size <= COMPRESSION_THRESHOLD_BYTES * 2 ? 'image/png' : 'image/jpeg'
    return {
      src: canvas.toDataURL(outputType, COMPRESSED_IMAGE_QUALITY),
      type: outputType,
    }
  } catch {
    return { src: sourceDataUrl, type: file.type }
  }
}

export async function readImageFile(file: File): Promise<NodeImageAttachment> {
  const sourceDataUrl = await readAsDataUrl(file)
  const normalized = await normalizeImageDataUrl(file, sourceDataUrl)

  return {
    id: generateImageAttachmentId(),
    src: normalized.src,
    name: file.name || 'image',
    type: normalized.type,
    createdAt: Date.now(),
  }
}

export function getImageFilesFromClipboard(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return []

  const itemFiles = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))

  if (itemFiles.length > 0) return itemFiles

  return Array.from(dataTransfer.files ?? []).filter((file) => file.type.startsWith('image/'))
}
