/* eslint-disable react-refresh/only-export-components -- Symbol definitions and their renderer form one shared registry. */
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpLeft,
  ArrowUpRight,
  AtSign,
  Ban,
  Bell,
  Bookmark,
  Box,
  Calendar,
  CalendarDays,
  Check,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock3,
  Code2,
  Copyright,
  Divide,
  DollarSign,
  Equal,
  Euro,
  Eye,
  FileText,
  Flame,
  Flag,
  Folder,
  Hand,
  Hash,
  Heart,
  Home,
  Hourglass,
  Image,
  Laugh,
  Lightbulb,
  Link2,
  LoaderCircle,
  Lock,
  Minus,
  PackageOpen,
  Paperclip,
  PartyPopper,
  Pause,
  Pencil,
  Percent,
  Play,
  Plus,
  PoundSterling,
  Repeat2,
  RotateCcw,
  RotateCw,
  Section,
  Settings,
  Smile,
  Sparkles,
  Square,
  Star,
  Tag,
  ThumbsUp,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react'

export type NodeSymbolCategory =
  | 'priority'
  | 'progress'
  | 'tag'
  | 'arrow'
  | 'flag'
  | 'star'
  | 'importance'
  | 'status'
  | 'workflow'
  | 'generic'
  | 'time'
  | 'other'

export type NodeSymbolDefinition = {
  id: string
  category: NodeSymbolCategory
  label: string
  value?: string
  color?: string
  progress?: number
  icon?: LucideIcon
  variant?: string
  pickerLabel?: string
  appearance?: 'circle' | 'plain'
}

export const NODE_SYMBOL_CATEGORY_LABELS: Record<NodeSymbolCategory, string> = {
  priority: '优先级（填充）',
  progress: '进度',
  tag: '标签',
  arrow: '箭头',
  flag: '旗帜',
  star: '星形',
  importance: '重要程度',
  status: '状态（任务/事项）',
  workflow: '任务状态（扩展）',
  generic: '符号（通用）',
  time: '时间相关',
  other: '其他',
}

export const NODE_SYMBOL_COLUMNS: NodeSymbolCategory[][] = [
  ['priority', 'flag', 'star', 'workflow', 'time'],
  ['progress', 'tag', 'arrow', 'importance', 'status', 'generic', 'other'],
]

const priorityTones = [
  { key: 'blue', label: '蓝色', color: '#2f7df6' },
  { key: 'pink', label: '粉色', color: '#ec4e91' },
  { key: 'red', label: '红色', color: '#f04448' },
  { key: 'orange', label: '橙色', color: '#f97316' },
  { key: 'yellow', label: '黄色', color: '#fbbf24' },
  { key: 'green', label: '绿色', color: '#2ecb83' },
  { key: 'purple', label: '紫色', color: '#8b5cf6' },
  { key: 'gray', label: '灰色', color: '#9ca3af' },
] as const

const semanticColors = ['#2f7df6', '#ec4e91', '#f04448', '#f97316', '#fbbf24', '#2ecb83', '#8b5cf6', '#9ca3af']

const createIconSymbols = (
  category: NodeSymbolCategory,
  entries: Array<{
    id: string
    label: string
    icon: LucideIcon
    color?: string
    pickerLabel?: string
    appearance?: 'circle' | 'plain'
  }>,
): NodeSymbolDefinition[] => entries.map((entry) => ({ category, ...entry }))

const prioritySymbols: NodeSymbolDefinition[] = priorityTones.flatMap((tone) =>
  Array.from({ length: 10 }, (_, value) => ({
    id: `priority-${tone.key}-${value}`,
    category: 'priority' as const,
    label: `${tone.label}优先级 ${value}`,
    value: String(value),
    color: tone.color,
    variant: tone.label,
  })),
)

const progressSymbols: NodeSymbolDefinition[] = [0, 12.5, 25, 37.5, 50, 62.5, 75, 100].map((progress, index) => ({
  id: `progress-${index + 1}`,
  category: 'progress',
  label: progress === 100 ? '已完成' : progress === 0 ? '未开始' : `进度 ${progress}%`,
  progress,
  color: '#2f7df6',
}))

const tagSymbols = createIconSymbols('tag', [
  { id: 'tag-1', label: '赞', icon: ThumbsUp, color: '#fbbf24', appearance: 'plain' },
  { id: 'tag-2', label: '喜欢', icon: Heart, color: '#f04448', appearance: 'plain' },
  { id: 'tag-3', label: '热门', icon: Flame, color: '#f97316', appearance: 'plain' },
  { id: 'tag-4', label: '开心', icon: Smile, color: '#ec4e91', appearance: 'plain' },
  { id: 'tag-5', label: '喜悦', icon: Laugh, color: '#fbbf24', appearance: 'plain' },
  { id: 'tag-6', label: '庆祝', icon: PartyPopper, color: '#8b5cf6', appearance: 'plain' },
  { id: 'tag-7', label: '鼓掌', icon: Hand, color: '#fbbf24', appearance: 'plain' },
  { id: 'tag-8', label: '亮点', icon: Star, color: '#fbbf24', appearance: 'plain' },
  { id: 'tag-9', label: '灵感', icon: Lightbulb, color: '#fbbf24', appearance: 'plain' },
  { id: 'tag-10', label: '闪光', icon: Sparkles, color: '#fbbf24', appearance: 'plain' },
  { id: 'tag-11', label: '关注', icon: Eye, color: '#38bdf8', appearance: 'plain' },
  { id: 'tag-12', label: '禁止', icon: Ban, color: '#f04448', appearance: 'plain' },
])

const arrowSymbols = createIconSymbols('arrow', [
  ['arrow-1', '向上', ArrowUp],
  ['arrow-2', '向下', ArrowDown],
  ['arrow-3', '向左', ArrowLeft],
  ['arrow-4', '向右', ArrowRight],
  ['arrow-5', '左上', ArrowUpLeft],
  ['arrow-6', '右上', ArrowUpRight],
  ['arrow-7', '左下', ArrowDownLeft],
  ['arrow-8', '右下', ArrowDownRight],
  ['arrow-9', '返回', RotateCcw],
  ['arrow-10', '刷新', RotateCw],
  ['arrow-11', '上下', ArrowUpDown],
  ['arrow-12', '左右', ArrowLeftRight],
].map(([id, label, icon]) => ({ id: id as string, label: label as string, icon: icon as LucideIcon, color: '#2f7df6' })))

const flagSymbols: NodeSymbolDefinition[] = semanticColors.map((color, index) => ({
  id: `flag-${index + 1}`,
  category: 'flag',
  label: `旗帜 ${index + 1}`,
  color,
  icon: Flag,
}))

const starSymbols: NodeSymbolDefinition[] = semanticColors.map((color, index) => ({
  id: `star-${index + 1}`,
  category: 'star',
  label: `星形 ${index + 1}`,
  color,
  icon: Star,
}))

const importanceSymbols = createIconSymbols('importance', [
  { id: 'importance-normal', label: '一般', pickerLabel: '一般', icon: Minus, color: '#9ca3af' },
  { id: 'importance-important', label: '重要', pickerLabel: '重要', icon: CircleAlert, color: '#2f7df6' },
  { id: 'importance-very', label: '非常重要', pickerLabel: '非常重要', icon: CircleAlert, color: '#f97316' },
  { id: 'importance-critical', label: '极其重要', pickerLabel: '极其重要', icon: CircleAlert, color: '#f04448' },
])

const statusSymbols = createIconSymbols('status', [
  { id: 'status-pending', label: '待处理', pickerLabel: '待处理', icon: Clock3, color: '#9ca3af' },
  { id: 'status-active', label: '进行中', pickerLabel: '进行中', icon: LoaderCircle, color: '#2f7df6' },
  { id: 'status-complete', label: '已完成', pickerLabel: '已完成', icon: CircleCheck, color: '#2ecb83' },
  { id: 'status-paused', label: '已暂停', pickerLabel: '已暂停', icon: Pause, color: '#f97316' },
  { id: 'status-cancelled', label: '已取消', pickerLabel: '已取消', icon: CircleX, color: '#f04448' },
])

const workflowSymbols = createIconSymbols('workflow', [
  { id: 'workflow-open', label: '待解决', pickerLabel: '待解决', icon: CircleHelp, color: '#9ca3af' },
  { id: 'workflow-resolved', label: '已解决', pickerLabel: '已解决', icon: CircleCheck, color: '#2ecb83' },
  { id: 'workflow-blocked', label: '阻塞中', pickerLabel: '阻塞中', icon: Ban, color: '#f04448' },
  { id: 'workflow-waiting', label: '等待中', pickerLabel: '等待中', icon: Hourglass, color: '#fbbf24' },
  { id: 'workflow-planned', label: '计划中', pickerLabel: '计划中', icon: CalendarDays, color: '#2f7df6' },
  { id: 'workflow-running', label: '进行中', pickerLabel: '进行中', icon: Play, color: '#2f7df6' },
  { id: 'workflow-review', label: '评审中', pickerLabel: '评审中', icon: Eye, color: '#8b5cf6' },
  { id: 'workflow-published', label: '已发布', pickerLabel: '已发布', icon: Upload, color: '#2ecb83' },
  { id: 'workflow-archived', label: '已归档', pickerLabel: '已归档', icon: PackageOpen, color: '#9ca3af' },
  { id: 'workflow-closed', label: '已关闭', pickerLabel: '已关闭', icon: X, color: '#9ca3af' },
  { id: 'workflow-draft', label: '草稿', pickerLabel: '草稿', icon: Pencil, color: '#2f7df6' },
  { id: 'workflow-deleted', label: '已删除', pickerLabel: '已删除', icon: Trash2, color: '#f04448' },
])

const genericSymbols = createIconSymbols('generic', [
  ['generic-plus', '加', Plus],
  ['generic-minus', '减', Minus],
  ['generic-close', '乘', X],
  ['generic-divide', '除', Divide],
  ['generic-equal', '等于', Equal],
  ['generic-percent', '百分比', Percent],
  ['generic-hash', '编号', Hash],
  ['generic-at', '提及', AtSign],
  ['generic-dollar', '美元', DollarSign],
  ['generic-euro', '欧元', Euro],
  ['generic-pound', '英镑', PoundSterling],
  ['generic-copyright', '版权', Copyright],
  ['generic-registered', '注册商标', Circle],
  ['generic-section', '章节', Section],
].map(([id, label, icon]) => ({ id: id as string, label: label as string, icon: icon as LucideIcon, color: '#2f7df6' })))

const timeSymbols = createIconSymbols('time', [
  { id: 'time-today', label: '今天', pickerLabel: '今天', icon: Clock3, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-tomorrow', label: '明天', pickerLabel: '明天', icon: Bell, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-week', label: '本周', pickerLabel: '本周', icon: Calendar, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-month', label: '本月', pickerLabel: '本月', icon: CalendarDays, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-year', label: '本年', pickerLabel: '本年', icon: CalendarDays, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-past', label: '过去', pickerLabel: '过去', icon: RotateCcw, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-future', label: '未来', pickerLabel: '未来', icon: RotateCw, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-reminder', label: '提醒', pickerLabel: '提醒', icon: Bell, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-deadline', label: '截止', pickerLabel: '截止', icon: Flag, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-start', label: '开始', pickerLabel: '开始', icon: Play, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-end', label: '结束', pickerLabel: '结束', icon: Square, color: '#2f7df6', appearance: 'plain' },
  { id: 'time-repeat', label: '重复', pickerLabel: '重复', icon: Repeat2, color: '#2f7df6', appearance: 'plain' },
])

const otherSymbols = createIconSymbols('other', [
  ['other-home', '主页', Home],
  ['other-user', '用户', User],
  ['other-users', '团队', Users],
  ['other-folder', '文件夹', Folder],
  ['other-file', '文档', FileText],
  ['other-image', '图片', Image],
  ['other-link', '链接', Link2],
  ['other-lock', '锁定', Lock],
  ['other-settings', '设置', Settings],
  ['other-box', '模块', Box],
  ['other-tag', '标签', Tag],
  ['other-bookmark', '书签', Bookmark],
  ['other-heart', '收藏', Heart],
  ['other-attachment', '附件', Paperclip],
  ['other-code', '代码', Code2],
].map(([id, label, icon]) => ({ id: id as string, label: label as string, icon: icon as LucideIcon, color: '#7f8b9d' })))

export const NODE_SYMBOLS: NodeSymbolDefinition[] = [
  ...prioritySymbols,
  ...progressSymbols,
  ...tagSymbols,
  ...arrowSymbols,
  ...flagSymbols,
  ...starSymbols,
  ...importanceSymbols,
  ...statusSymbols,
  ...workflowSymbols,
  ...genericSymbols,
  ...timeSymbols,
  ...otherSymbols,
]

const legacyPriorityColors = ['#ff3f62', '#ff765f', '#ffc247', '#3ddc97', '#246cf5', '#8438f5', '#ef72d7', '#aeb3ce']
const legacyPrioritySymbols: NodeSymbolDefinition[] = legacyPriorityColors.map((color, index) => ({
  id: `priority-${index + 1}`,
  category: 'priority',
  label: `优先级 ${index + 1}`,
  value: String(index + 1),
  color,
}))

export const getNodeSymbol = (id?: string) =>
  NODE_SYMBOLS.find((symbol) => symbol.id === id) ??
  legacyPrioritySymbols.find((symbol) => symbol.id === id)

export function NodeSymbolPicker({
  selectedId,
  onSelect,
}: {
  selectedId?: string
  onSelect: (symbolId?: string) => void
}) {
  const renderCategory = (category: NodeSymbolCategory) => {
    const symbols = NODE_SYMBOLS.filter((symbol) => symbol.category === category)
    if (category === 'priority') {
      const variants = Array.from(new Set(symbols.map((symbol) => symbol.variant).filter(Boolean)))
      return (
        <section key={category} className="node-symbol-category is-priority">
          <strong>{NODE_SYMBOL_CATEGORY_LABELS[category]}</strong>
          <div className="node-priority-rows">
            {variants.map((variant) => (
              <div key={variant} className="node-priority-row">
                <span>{variant}</span>
                <div>
                  {symbols.filter((symbol) => symbol.variant === variant).map((symbol) => (
                    <button
                      key={symbol.id}
                      type="button"
                      title={symbol.label}
                      className={selectedId === symbol.id ? 'is-active' : ''}
                      onClick={() => onSelect(symbol.id)}
                    >
                      <NodeSymbolIcon symbol={symbol} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )
    }

    const hasLabels = symbols.some((symbol) => symbol.pickerLabel)
    return (
      <section key={category} className={`node-symbol-category is-${category}${hasLabels ? ' has-labels' : ''}`}>
        <strong>{NODE_SYMBOL_CATEGORY_LABELS[category]}</strong>
        <div className={`node-symbol-category-grid is-${category}`}>
          {symbols.map((symbol) => (
            <button
              key={symbol.id}
              type="button"
              title={symbol.label}
              className={selectedId === symbol.id ? 'is-active' : ''}
              onClick={() => onSelect(symbol.id)}
            >
              <NodeSymbolIcon symbol={symbol} />
              {symbol.pickerLabel && <span>{symbol.pickerLabel}</span>}
            </button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="node-symbol-picker">
      <div className="node-symbol-picker-head">
        <div>
          <strong>符号库</strong>
          <span>选择一个标记，它不会写入节点文字</span>
        </div>
        <button type="button" className={!selectedId ? 'is-active' : ''} onClick={() => onSelect()}>
          清除符号
        </button>
      </div>
      <div className="node-symbol-columns">
        {NODE_SYMBOL_COLUMNS.map((column, index) => (
          <div key={index} className="node-symbol-column">
            {column.map(renderCategory)}
          </div>
        ))}
      </div>
    </div>
  )
}

export function NodeSymbolIcon({
  symbol,
  size = 'normal',
}: {
  symbol: NodeSymbolDefinition
  size?: 'small' | 'normal'
}) {
  const style = {
    '--symbol-color': symbol.color ?? '#2f7df6',
    '--symbol-progress': `${symbol.progress ?? 0}%`,
  } as CSSProperties
  const Icon = symbol.icon

  if (symbol.category === 'progress') {
    return (
      <span
        className={`semantic-node-symbol is-progress is-${size}${symbol.progress === 100 ? ' is-complete' : ''}`}
        style={style}
        title={symbol.label}
      >
        {symbol.progress === 0 && <Play size={size === 'small' ? 9 : 12} fill="currentColor" />}
        {symbol.progress === 100 && <Check size={size === 'small' ? 10 : 13} strokeWidth={3} />}
      </span>
    )
  }

  return (
    <span
      className={`semantic-node-symbol is-${symbol.category} is-${symbol.appearance ?? 'circle'} is-${size}`}
      style={style}
      title={symbol.label}
    >
      {Icon && <Icon size={size === 'small' ? 11 : 15} strokeWidth={symbol.category === 'arrow' ? 2.5 : 2.2} />}
      {!Icon && symbol.value}
    </span>
  )
}
