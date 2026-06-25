import { BaseEdge } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

type MindMapEdgeData = {
  color?: string
  siblingCount?: number
  isPreview?: boolean
}

export function MindMapEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const edgeData = data as MindMapEdgeData | undefined
  const cornerRadius = 12
  const shouldDrawStraight = (edgeData?.siblingCount ?? 1) <= 1
  const midX = sourceX + Math.max(40, (targetX - sourceX) / 2)
  const verticalDirection = targetY >= sourceY ? 1 : -1
  const horizontalDirection = targetX >= sourceX ? 1 : -1
  const firstRadius = Math.min(cornerRadius, Math.abs(midX - sourceX) / 2, Math.abs(targetY - sourceY) / 2)
  const secondRadius = Math.min(cornerRadius, Math.abs(targetX - midX) / 2, Math.abs(targetY - sourceY) / 2)

  const edgePath = shouldDrawStraight
    ? `M ${sourceX},${sourceY} L ${targetX},${targetY}`
    : [
        `M ${sourceX},${sourceY}`,
        `L ${midX - firstRadius * horizontalDirection},${sourceY}`,
        `Q ${midX},${sourceY} ${midX},${sourceY + firstRadius * verticalDirection}`,
        `L ${midX},${targetY - secondRadius * verticalDirection}`,
        `Q ${midX},${targetY} ${midX + secondRadius * horizontalDirection},${targetY}`,
        `L ${targetX},${targetY}`,
      ].join(' ')

  return (
    <BaseEdge
      path={edgePath}
      interactionWidth={18}
      style={{
        stroke: edgeData?.color ?? '#64748b',
        strokeWidth: edgeData?.isPreview ? 2.4 : 2,
        strokeOpacity: edgeData?.isPreview ? 0.7 : 0.86,
        strokeDasharray: edgeData?.isPreview ? '8 8' : undefined,
        fill: 'none',
      }}
    />
  )
}
