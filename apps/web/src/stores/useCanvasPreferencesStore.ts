import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FrameworkTemplateNode = {
  id: string
  label: string
  children: FrameworkTemplateNode[]
}

export type FrameworkTemplate = {
  id: string
  name: string
  enabled: boolean
  nodes: FrameworkTemplateNode[]
}

type CanvasPreferencesState = {
  frameworkTemplates: FrameworkTemplate[]
  addFrameworkTemplate: () => void
  updateFrameworkTemplate: (id: string, patch: Partial<FrameworkTemplate>) => void
  deleteFrameworkTemplate: (id: string) => void
  addTemplateNode: (templateId: string, parentNodeId?: string) => void
  updateTemplateNode: (templateId: string, nodeId: string, patch: Pick<FrameworkTemplateNode, 'label'>) => void
  deleteTemplateNode: (templateId: string, nodeId: string) => void
}

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const defaultTemplates: FrameworkTemplate[] = [{
  id: 'framework-default',
  name: '思考框架',
  enabled: true,
  nodes: [
    { id: 'framework-cause', label: '提炼因果', children: [] },
    { id: 'framework-transform', label: '转换因果', children: [] },
    { id: 'framework-goal', label: '思考目标', children: [] },
    { id: 'framework-puzzle', label: '搜集拼图', children: [] },
  ],
}]

function mapTemplateNodes(
  nodes: FrameworkTemplateNode[],
  nodeId: string,
  mapper: (node: FrameworkTemplateNode) => FrameworkTemplateNode | null,
): FrameworkTemplateNode[] {
  return nodes.flatMap((node) => {
    if (node.id === nodeId) {
      const mapped = mapper(node)
      return mapped ? [mapped] : []
    }
    return [{ ...node, children: mapTemplateNodes(node.children, nodeId, mapper) }]
  })
}

export const useCanvasPreferencesStore = create<CanvasPreferencesState>()(
  persist(
    (set) => ({
      frameworkTemplates: defaultTemplates,
      addFrameworkTemplate: () => set((state) => ({
        frameworkTemplates: [...state.frameworkTemplates, {
          id: createId('framework'),
          name: `新框架 ${state.frameworkTemplates.length + 1}`,
          enabled: true,
          nodes: [
            { id: createId('framework-node'), label: '节点 1', children: [] },
            { id: createId('framework-node'), label: '节点 2', children: [] },
          ],
        }],
      })),
      updateFrameworkTemplate: (id, patch) => set((state) => ({
        frameworkTemplates: state.frameworkTemplates.map((template) => template.id === id ? { ...template, ...patch } : template),
      })),
      deleteFrameworkTemplate: (id) => set((state) => ({
        frameworkTemplates: state.frameworkTemplates.filter((template) => template.id !== id),
      })),
      addTemplateNode: (templateId, parentNodeId) => set((state) => ({
        frameworkTemplates: state.frameworkTemplates.map((template) => {
          if (template.id !== templateId) return template
          const nextNode: FrameworkTemplateNode = {
            id: createId('framework-node'),
            label: '新节点',
            children: [],
          }
          if (!parentNodeId) {
            if (template.nodes.length >= 5) return template
            return { ...template, nodes: [...template.nodes, nextNode] }
          }
          return {
            ...template,
            nodes: mapTemplateNodes(template.nodes, parentNodeId, (node) => ({
              ...node,
              children: node.children.length >= 5 ? node.children : [...node.children, nextNode],
            })),
          }
        }),
      })),
      updateTemplateNode: (templateId, nodeId, patch) => set((state) => ({
        frameworkTemplates: state.frameworkTemplates.map((template) => template.id === templateId
          ? { ...template, nodes: mapTemplateNodes(template.nodes, nodeId, (node) => ({ ...node, ...patch })) }
          : template),
      })),
      deleteTemplateNode: (templateId, nodeId) => set((state) => ({
        frameworkTemplates: state.frameworkTemplates.map((template) => template.id === templateId
          ? template.nodes.some((node) => node.id === nodeId) && template.nodes.length <= 2
            ? template
            : { ...template, nodes: mapTemplateNodes(template.nodes, nodeId, () => null) }
          : template),
      })),
    }),
    { name: 'cogtree-canvas-preferences', version: 1 },
  ),
)
