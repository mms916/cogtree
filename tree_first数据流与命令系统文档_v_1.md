# Tree First 数据流与命令系统文档（V1）

## 1. 文档信息

- 文档名称：Tree First 数据流与命令系统文档
- 所属产品：CogTree / 模型树阅读法
- 文档类型：核心技术设计文档
- 版本：V1.0
- 文档目标：明确 Tree First 的数据真相源原则、前后端数据流、命令系统设计、命令执行规则、撤销重做机制、自动保存策略与异常处理机制

---

## 2. 文档结论

## 2.1 一句话结论

本产品的核心结构编辑必须采用：

**Tree First + Command Driven**

即：
- 树结构是唯一真相源
- 所有结构变更都通过“命令”触发
- 视图、边、统计、提示信息都优先由树派生
- 撤销 / 重做、自动保存、来源继承都围绕命令系统运作

## 2.2 为什么必须这样做

因为本产品的核心是：
- 画布高频编辑
- 层级调整
- 结构修剪
- 节点合并 / 拆分 / 提升抽象
- 来源映射继承
- 多页面共享同一套树逻辑

如果没有 Tree First + 命令系统，极易出现：
- 树结构与边关系不一致
- 拖拽后层级错乱
- 画布显示正确但数据保存错误
- 撤销 / 重做难以实现
- 自动保存冲突增加

---

## 3. Tree First 原则

## 3.1 核心定义

Tree First 指：

### 树结构是唯一真相源
由以下字段共同决定：
- parentId
- childrenIds
- orderIndex

这三者决定：
- 层级
- 同级顺序
- 分支归属
- 子树结构

## 3.2 哪些数据属于真相源

### 真相源数据
- treeId
- rootNodeIds
- node.id
- node.parentId
- node.childrenIds
- node.orderIndex
- node.label
- node.type
- node.status
- node.definition
- 来源映射字段

### 非真相源数据（派生层）
- edges
- 可视化线条
- 布局坐标缓存
- 统计数量
- 关系高亮结果
- 画布小地图展示数据
- 过滤后的显示列表

## 3.3 派生原则

以下内容必须优先由树派生，而不是单独持久化为并列结构：

### 1）边关系 edges
- 父子边由 parentId / childrenIds 派生
- 辅助边若存在，也必须和树关系分开建模

### 2）层级路径
- 祖先链
- 深度层级
- 当前分支路径

### 3）节点数量统计
- 子节点数
- 折叠节点数
- 分支节点数

### 4）视图排序
- 同级排序由 orderIndex 决定

## 3.4 为什么不能双真相源

如果长期同时维护：
- tree 结构
- edge 结构

且两者都可独立修改，会产生以下问题：

1. 初始能显示，但拖拽后边丢失
2. parentId 已更新，但 edges 未重建
3. 前端显示一套，后端保存另一套
4. undo/redo 无法稳定恢复
5. 自动保存会反复覆盖错误状态

结论：

**树是真相源，边只是视图层产物。**

---

## 4. 数据流总览

## 4.1 总体数据流

前端到后端的结构更新应采用：

**用户操作 → 前端命令 → 本地树状态更新 → 视图派生 → 自动保存命令提交 → 后端命令执行 → 数据库持久化 → 返回确认结果**

## 4.2 六层数据流模型

### 第一层：用户交互层
用户操作包括：
- 点击节点
- 拖拽节点
- 新增节点
- 删除节点
- 重命名
- 合并
- 拆分
- 提升抽象
- 连线

### 第二层：前端命令层
前端不直接改一堆分散状态，而是生成明确命令，例如：
- moveNode
- renameNode
- mergeNodes
- splitNode
- elevateAbstract

### 第三层：本地树状态层
命令先作用于前端内存中的树状态：
- documentStore
- canvasStore
- historyStore

### 第四层：派生视图层
前端根据当前树派生：
- edges
- 展示节点
- 折叠状态
- 高亮路径
- 小地图
- 角标统计

### 第五层：后端命令提交层
前端将命令或 patch 提交给后端：
- 立即提交
- 批量缓冲后提交
- 自动保存定时提交

### 第六层：后端持久化层
后端执行命令：
- 校验
- 修改树
- 写入命令日志
- 更新版本
- 返回最新确认结果

---

## 5. 前端状态分层

## 5.1 前端状态设计原则

前端状态不要混成一个大对象，建议至少分为：

### 1）documentStore
负责：
- 当前树文档
- 节点字典
- 当前版本号
- 当前来源映射

### 2）canvasStore
负责：
- 当前选中节点
- 多选状态
- 当前视口
- 当前缩放
- 折叠状态
- 当前模式

### 3）historyStore
负责：
- undo stack
- redo stack
- 当前未同步命令栈

### 4）uiStore
负责：
- 左右侧栏展开状态
- Toast
- ContextMenu
- 轻量浮层

## 5.2 前端只维护一份结构状态

同一棵树在前端必须只有一份可编辑真相源：
- nodes map
- rootNodeIds

不要同时维护：
- 一个 React Flow nodes 数组
- 一个业务 tree
- 一个 edge-first 数据模型

正确方式是：
- 业务 tree 为真相源
- React Flow nodes / edges 每次由 tree 派生

---

## 6. 后端状态分层

## 6.1 后端职责

后端负责：
- 接收命令
- 校验合法性
- 执行结构更新
- 保留命令日志
- 更新版本号
- 返回最终确认结构或差异结果

## 6.2 后端不负责画布视图真相

后端可存：
- 视口快照
- 布局元信息

但这些不应反过来决定树结构。

## 6.3 后端结构一致性原则

后端执行命令时必须保证：
- 无循环引用
- 无非法 parentId
- 同级 orderIndex 合法
- childrenIds 与 parentId 一致
- 删除时来源映射同步处理

---

## 7. 命令系统总体设计

## 7.1 什么是命令

命令不是普通字段更新，而是：

**一个带有明确业务语义、输入结构、校验规则和副作用处理的结构操作单元。**

## 7.2 为什么必须命令化

如果只做“update node”这类粗粒度接口，无法清楚表达：
- 合并两个节点
- 拖拽后改变层级
- 提升抽象并继承来源
- 从 QuoteCard 生成 BookNode

命令化后可以更好支持：
- 历史记录
- 审计
- 撤销 / 重做
- 自动保存
- 冲突处理

## 7.3 命令设计原则

1. 一个命令只表达一个明确动作
2. 命令必须可校验
3. 命令必须有成功 / 失败结果
4. 命令尽量可逆（至少大部分结构命令）
5. 命令执行后必须触发版本更新

---

## 8. 核心命令清单

## 8.1 通用节点命令

### renameNode
重命名节点

### createNode
创建节点

### deleteNode
删除节点

### moveNode
移动节点（改父子关系 / 改排序）

### reorderNode
仅调整同级顺序

### collapseNode
折叠节点

### expandNode
展开节点

---

## 8.2 结构修剪命令

### mergeNodes
合并多个节点

### splitNode
拆分节点

### elevateAbstract
提升抽象，创建新上位节点

### tagNodeTheme
为节点打主主题 / 次主题标签

### markPendingVerify
标记待验证

### clearPendingVerify
取消待验证

---

## 8.3 来源相关命令

### attachQuoteCard
将 QuoteCard 吸收到 BookTree

### bindSourceMapping
绑定 ThemeNode 到 BookNode 的来源映射

### unbindSourceMapping
解绑来源映射

---

## 8.4 视图相关命令（轻量）

### updateViewport
保存视口

### setSelection
设置当前选中节点

说明：
这些视图命令通常只在前端或低优先级同步，不一定全部写命令日志。

---

## 9. 核心命令定义

以下给出重点命令的结构设计。

## 9.1 renameNode

### 作用
修改某个节点的 label。

### 输入
```ts
interface RenameNodeCommand {
  command: 'renameNode'
  treeId: string
  nodeId: string
  newLabel: string
  clientVersion: number
}
```

### 校验
- nodeId 必须存在
- newLabel 不得为空
- 长度在合理范围内

### 副作用
- 更新 node.label
- 更新时间 updatedAt
- 写命令日志
- 更新 tree version

---

## 9.2 createNode

### 作用
创建一个新节点，可作为根级、同级或子级节点。

### 输入
```ts
interface CreateNodeCommand {
  command: 'createNode'
  treeId: string
  parentId?: string | null
  afterSiblingId?: string | null
  label: string
  nodeType: string
  clientVersion: number
}
```

### 校验
- parentId 若存在必须合法
- afterSiblingId 若存在必须与 parentId 同层

### 副作用
- 创建新节点
- 维护 parent.childrenIds
- 计算 orderIndex
- 更新版本

---

## 9.3 deleteNode

### 作用
删除一个节点。

### 输入
```ts
interface DeleteNodeCommand {
  command: 'deleteNode'
  treeId: string
  nodeId: string
  deleteMode?: 'subtree'
  clientVersion: number
}
```

### MVP 约束
第一版仅支持：
- subtree 删除（连同子树一并删除）

### 校验
- root 节点删除要谨慎处理
- 节点必须存在

### 副作用
- 删除子树全部节点
- 清理 parent.childrenIds
- 清理来源映射
- 更新版本

---

## 9.4 moveNode

### 作用
将节点移动到新的父节点下，或改变同级顺序。

### 输入
```ts
interface MoveNodeCommand {
  command: 'moveNode'
  treeId: string
  nodeId: string
  targetParentId: string | null
  targetIndex: number
  clientVersion: number
}
```

### 校验
- nodeId 存在
- targetParentId 存在或允许为 null
- 不允许移动到自己的后代节点下
- targetIndex 合法

### 副作用
- 旧 parent.childrenIds 删除该节点
- 新 parent.childrenIds 插入该节点
- 更新 node.parentId
- 重算相关 orderIndex
- 更新版本

### 说明
这是最关键的命令之一，必须高度可靠。

---

## 9.5 reorderNode

### 作用
只改变同级排序，不改变父子关系。

### 输入
```ts
interface ReorderNodeCommand {
  command: 'reorderNode'
  treeId: string
  nodeId: string
  parentId: string | null
  targetIndex: number
  clientVersion: number
}
```

### 适用
- 同层拖拽排序

---

## 9.6 mergeNodes

### 作用
合并多个语义相近节点为一个节点。

### 输入
```ts
interface MergeNodesCommand {
  command: 'mergeNodes'
  treeId: string
  nodeIds: string[]
  keepNodeId?: string
  newLabel?: string
  inheritSources?: boolean
  clientVersion: number
}
```

### 校验
- nodeIds 至少两个
- 节点均存在
- 第一版建议要求同层节点合并

### 副作用
- 选定保留节点或创建新节点
- 合并来源
- 合并备注 / 待验证问题
- 合并子节点（按规则）
- 删除其余节点
- 清理重复 childrenIds
- 更新版本

### MVP 规则建议
第一版：
- 同层合并优先
- 子节点直接并入保留节点
- 冲突子节点先不自动深度去重，由用户后续整理

---

## 9.7 splitNode

### 作用
把语义过大的节点拆成多个节点。

### 输入
```ts
interface SplitNodeCommand {
  command: 'splitNode'
  treeId: string
  nodeId: string
  newNodes: Array<{
    label: string
    nodeType: string
  }>
  clientVersion: number
}
```

### 校验
- nodeId 存在
- newNodes 至少两个

### 副作用
- 在原节点位置附近创建多个新节点
- 原来源可暂时全部挂到新节点或等待再分配
- 原节点删除或保留为上位抽象（视策略）

### MVP 建议
第一版拆分可以比较保守：
- 先创建新节点
- 原来源全部复制给新节点
- 由用户后续人工整理来源归属

---

## 9.8 elevateAbstract

### 作用
为多个同层节点创建一个新上位抽象节点。

### 输入
```ts
interface ElevateAbstractCommand {
  command: 'elevateAbstract'
  treeId: string
  nodeIds: string[]
  newParentLabel: string
  nodeType?: string
  clientVersion: number
}
```

### 校验
- nodeIds 至少两个
- 默认要求同层
- 这些节点必须共享同一 parentId

### 副作用
- 创建新节点
- 新节点挂到原父节点下
- 所选节点成为新节点 children
- 更新 parentId 和 orderIndex
- 更新版本

---

## 9.9 attachQuoteCard

### 作用
将 QuoteCard 吸收进 BookTree。

### 输入
```ts
interface AttachQuoteCardCommand {
  command: 'attachQuoteCard'
  treeId: string
  quoteCardId: string
  targetParentId?: string | null
  mode: 'create_new_node' | 'merge_to_existing'
  targetNodeId?: string
  clientVersion: number
}
```

### 校验
- quoteCard 存在
- targetNodeId 在 merge 模式下必须存在

### 副作用
- 若 create_new_node：创建新的 BookNode
- 若 merge_to_existing：将 QuoteCard 来源挂入现有节点
- 更新 QuoteCard 状态为 absorbed
- 更新版本

---

## 10. 命令执行流程

## 10.1 前端执行流程

### 步骤 1：用户操作
例如拖拽节点。

### 步骤 2：构造命令
前端生成 `moveNode` 命令对象。

### 步骤 3：本地预执行
前端对本地树做 optimistic update。

### 步骤 4：派生视图
根据更新后的树重新生成：
- React Flow nodes
- edges
- 高亮状态
- 小地图

### 步骤 5：进入历史栈
将命令推进 undo stack。

### 步骤 6：异步提交后端
命令进入 autosave flush 队列，或立即提交。

## 10.2 后端执行流程

### 步骤 1：接收命令
校验身份、treeId、clientVersion。

### 步骤 2：读取当前树状态
读取 BookTree / ThemeTree 当前版本。

### 步骤 3：命令校验
校验是否：
- 合法层级
- 无循环引用
- 无非法目标
- 版本可接受

### 步骤 4：执行命令
修改树结构和附属映射。

### 步骤 5：写命令日志
记录 command_logs。

### 步骤 6：更新版本
tree.version + 1。

### 步骤 7：返回结果
返回：
- success
- newVersion
- affectedNodeIds
- optional patch

---

## 11. Optimistic Update 策略

## 11.1 为什么需要 optimistic update

因为画布操作频繁，如果每一步都等待后端返回再更新，会明显卡顿。

## 11.2 适合 optimistic update 的命令

- renameNode
- createNode
- moveNode
- reorderNode
- collapseNode
- expandNode
- markPendingVerify

## 11.3 需要谨慎 optimistic update 的命令

- mergeNodes
- splitNode
- elevateAbstract
- attachQuoteCard

这些命令可能带来较多副作用，前端可先局部乐观更新，但必须保留后端回滚能力。

## 11.4 后端失败时的处理

若命令失败：
- 回滚本地树到前一快照
- 弹 toast 提示失败原因
- 保留用户当前选中上下文

---

## 12. 撤销 / 重做设计

## 12.1 核心原则

撤销 / 重做本质上不是“随便恢复状态”，而是围绕命令系统进行。

## 12.2 前端实现建议

### undo stack
存储最近命令及其前状态快照或 inverseCommand。

### redo stack
在 undo 后可重放。

## 12.3 两种实现路线

### 路线 A：快照式
每次命令前保存局部快照。

优点：
- 实现简单

缺点：
- 内存开销更高

### 路线 B：逆命令式
为每个命令生成 inverseCommand。

优点：
- 更工程化

缺点：
- 实现复杂

### 当前建议
第一版采用：
**局部快照 + 命令记录混合方案**

即：
- 关键结构命令前存局部树快照
- 同时保留命令记录

## 12.4 后端一致性建议

后端记录命令日志与版本号，但不要求第一版实现完整后端级 undo API。

---

## 13. 自动保存策略

## 13.1 保存原则

- 高频命令本地立即生效
- 后端批量短延迟保存
- 避免每一步都整树提交

## 13.2 保存模式建议

### 轻命令
如 renameNode、moveNode：
- 300ms ~ 800ms debounce 后提交

### 重命令
如 mergeNodes、splitNode、elevateAbstract：
- 立即提交或极短延迟提交

## 13.3 提交单位

推荐提交：
- 命令对象
- 或命令 patch

不推荐：
- 整棵树全量 PUT

## 13.4 保存失败处理

- 前端标记 autosaveStatus = error
- 保留本地状态
- 用户可手动重试
- 不应立即清空当前画布

---

## 14. 版本与并发策略

## 14.1 版本字段

每棵树必须有：
- version

每次命令提交时带：
- clientVersion

## 14.2 后端版本校验

### 若 clientVersion == serverVersion
正常执行。

### 若 clientVersion 落后
后端返回冲突提示或要求重新拉取。

## 14.3 当前阶段策略

由于第一版不做多人实时协作，版本冲突主要来自：
- 多标签页编辑
- 刷新后旧状态提交

建议：
- 简单版本校验即可
- 冲突时提示用户刷新最新结构

---

## 15. 异常与容错设计

## 15.1 非法结构防护

必须防止：
- 节点移动到自己子树下
- parentId 丢失
- childrenIds 与 parentId 不一致
- 同级顺序重复紊乱

## 15.2 命令失败类型

### 校验失败
- 非法目标
- 版本冲突
- 参数不合法

### 执行失败
- 数据库事务失败
- 来源映射更新失败
- 树结构重建失败

## 15.3 容错原则

- 前端尽量保持当前上下文
- 后端失败后不写入半成品状态
- 关键结构命令必须事务化执行

---

## 16. 数据库事务策略

## 16.1 必须使用事务的命令

以下命令必须放在单个事务内：
- moveNode
- deleteNode
- mergeNodes
- splitNode
- elevateAbstract
- attachQuoteCard
- bindSourceMapping

## 16.2 事务原因

这些命令通常同时影响：
- 多个节点
- parent.childrenIds
- 来源映射
- 状态字段
- tree version
- command_logs

如果不事务化，容易出现半更新状态。

---

## 17. 接口风格建议

## 17.1 API 风格

采用：
**REST + 命令式动作接口**

## 17.2 接口示例

### 通用
- `POST /trees/:treeId/commands/rename-node`
- `POST /trees/:treeId/commands/create-node`
- `POST /trees/:treeId/commands/move-node`
- `POST /trees/:treeId/commands/reorder-node`
- `POST /trees/:treeId/commands/delete-node`

### 结构修剪
- `POST /trees/:treeId/commands/merge-nodes`
- `POST /trees/:treeId/commands/split-node`
- `POST /trees/:treeId/commands/elevate-abstract`

### 来源与吸收
- `POST /book-trees/:treeId/commands/attach-quote-card`
- `POST /theme-trees/:treeId/commands/bind-source-mapping`

---

## 18. 组件与模块建议

## 18.1 前端命令层模块

建议独立一层：
- commandFactory
- commandExecutor
- optimisticApplier
- undoRedoManager
- autosaveQueue

## 18.2 后端命令处理层模块

建议拆为：
- commandController
- commandValidator
- commandHandler
- treeRepository
- commandLogRepository

## 18.3 为什么要单独拆命令层

因为命令系统是全产品核心，如果直接散落在页面组件里，后期会非常难维护。

---

## 19. MVP 范围

## 19.1 MVP 必须实现

- Tree First 单真相源
- renameNode
- createNode
- deleteNode
- moveNode
- reorderNode
- mergeNodes
- elevateAbstract
- attachQuoteCard
- 自动保存
- 前端 undo/redo
- 后端版本号更新
- command_logs 写入

## 19.2 第二阶段建议实现

- splitNode
- bindSourceMapping / unbindSourceMapping
- 后端级回滚辅助
- 批量命令
- 冲突恢复机制增强

## 19.3 第三阶段建议实现

- 命令面板
- 命令审计可视化
- AI 命令建议
- 协作编辑冲突合并

---

## 20. 验收标准

### 功能验收
1. 节点拖拽后，树结构与视图一致
2. 合并、提升抽象后，来源与层级不丢失
3. 自动保存不依赖整树全量覆盖
4. undo/redo 可稳定工作
5. command_logs 能记录关键结构命令
6. 后端版本号可正确递增

### 架构验收
1. 前端只有一份可编辑树真相源
2. edges 由 tree 派生，而不是独立真相源
3. 关键结构命令均有明确输入、校验、输出与副作用定义
4. 后端关键结构命令事务化
5. 三大页面共享统一命令心智

---

## 21. 一句话总结

Tree First 数据流与命令系统，决定了这款产品能否真正从“一个能画树的页面”升级为“一个可持续编辑、可追溯、可撤销、可演进的知识结构引擎”。

