export type TreeKind = 'candidate' | 'book' | 'theme'

export type CanvasNodeType =
  | 'concept'
  | 'cause'
  | 'effect'
  | 'mechanism'
  | 'question'
  | 'note'
  | 'abstract'
  | 'pending'

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
  fitMode?: 'manual' | 'fit_all' | 'fit_selection'
}
