# API 接口详细设计文档（V1）

## 1. 文档信息

- 文档名称：API 接口详细设计文档
- 所属产品：CogTree / 模型树阅读法
- 文档类型：后端接口设计文档
- 版本：V1.0
- 文档目标：明确前后端交互所需的查询接口、命令接口、返回结构、错误结构、自动保存策略与接口分层规范，支撑三大核心页面与 Tree First 命令系统落地

---

## 2. 文档结论

## 2.1 一句话结论

本产品 API 采用：

**REST 为主 + 命令式接口优先 + 查询与命令分层**

即：
- 查询接口负责读取上下文、树、节点、来源、列表
- 命令接口负责结构修改、状态变更、吸收、映射、导出触发
- 不采用“整棵树全量 PUT 覆盖”的粗放接口模式

## 2.2 为什么这样设计

因为本产品的核心操作不是普通 CRUD，而是：
- moveNode
- mergeNodes
- splitNode
- elevateAbstract
- attachQuoteCard
- bindSourceMapping
- pushQuoteCardToBookTree

这些都属于“有明确语义的结构命令”，更适合用命令式接口表达。

---

## 3. 接口设计原则

## 3.1 查询与命令分离

### 查询接口
只负责读取，不产生结构副作用。

### 命令接口
只负责执行有语义的状态变更，必须：
- 可校验
- 可记录日志
- 可触发版本更新
- 可支持撤销/重做体系

## 3.2 Tree First

接口的输入输出必须围绕树结构真相源设计：
- parentId
- childrenIds
- orderIndex

视图层 edges、布局、局部高亮等不作为主接口真相源。

## 3.3 命令粒度清晰

一个命令接口只表达一个明确动作，不做模糊“大更新”。

## 3.4 返回结构统一

成功、失败、分页、列表、节点详情、树详情，都要使用统一返回格式，降低前端集成成本。

## 3.5 版本校验

结构修改类命令必须带 `clientVersion`，后端返回 `serverVersion`，用于处理版本一致性。

---

## 4. 基础约定

## 4.1 基础路径建议

建议统一前缀：

```http
/api/v1
```

## 4.2 鉴权方式

第一版建议：
- Bearer Token
- Header：`Authorization: Bearer <token>`

## 4.3 时间格式

统一使用 ISO 8601：
- `2026-04-22T10:30:00Z`

## 4.4 ID 类型

统一使用 UUID 字符串。

## 4.5 分页参数

推荐使用：
- `page`
- `pageSize`

对于无限滚动列表，可扩展 cursor 模式，第一版先不强制。

---

## 5. 统一返回结构

## 5.1 成功返回

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

## 5.2 失败返回

```json
{
  "success": false,
  "error": {
    "code": "TREE_VERSION_CONFLICT",
    "message": "当前树版本已过期，请刷新后重试。",
    "details": {}
  }
}
```

## 5.3 列表返回

```json
{
  "success": true,
  "data": {
    "items": []
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 120
  }
}
```

## 5.4 命令返回

```json
{
  "success": true,
  "data": {
    "command": "moveNode",
    "treeId": "uuid",
    "serverVersion": 18,
    "affectedNodeIds": ["n1", "n2"],
    "patch": {}
  }
}
```

---

## 6. 错误码规范

## 6.1 通用错误码

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `INTERNAL_ERROR`
- `RATE_LIMITED`

## 6.2 结构相关错误码

- `TREE_VERSION_CONFLICT`
- `NODE_NOT_FOUND`
- `INVALID_PARENT_TARGET`
- `CYCLE_DETECTED`
- `INVALID_TARGET_INDEX`
- `MERGE_NOT_ALLOWED`
- `SPLIT_NOT_ALLOWED`
- `ELEVATE_NOT_ALLOWED`
- `QUOTE_CARD_ALREADY_ABSORBED`
- `SOURCE_MAPPING_DUPLICATED`

## 6.3 保存相关错误码

- `AUTOSAVE_FAILED`
- `COMMAND_EXECUTION_FAILED`
- `TREE_INCONSISTENT`

---

## 7. 认证接口

## 7.1 登录

### `POST /api/v1/auth/login`

#### 请求体
```json
{
  "email": "user@example.com",
  "password": "******"
}
```

#### 返回
```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "displayName": "G bin"
    }
  }
}
```

## 7.2 获取当前用户

### `GET /api/v1/auth/me`

---

## 8. 书籍与章节接口

## 8.1 获取书籍列表

### `GET /api/v1/books`

#### 查询参数
- `page`
- `pageSize`
- `keyword`

#### 返回字段
- id
- title
- author
- coverUrl
- meta
- createdAt
- updatedAt

## 8.2 获取单本书详情

### `GET /api/v1/books/:bookId`

## 8.3 获取书籍章节列表

### `GET /api/v1/books/:bookId/chapters`

#### 返回字段
- id
- title
- orderIndex
- level
- parentId

---

## 9. 金句与 QuoteCard 接口

## 9.1 获取金句列表

### `GET /api/v1/books/:bookId/quotes`

#### 查询参数
- `page`
- `pageSize`
- `keyword`
- `chapterId`
- `extractionStatus`
- `favoriteStatus`

#### 返回字段
- id
- originalText
- pageLabel
- chapterId
- extractionStatus
- favoriteStatus
- createdAt
- updatedAt

## 9.2 获取单条金句详情

### `GET /api/v1/quotes/:quoteId`

## 9.3 获取 QuoteCard 详情

### `GET /api/v1/quotes/:quoteId/quote-card`

#### 返回字段
- id
- quoteId
- keywords
- causeList
- effectList
- middleStepList
- pendingList
- pendingQuestions
- candidateNodes
- candidateEdges
- candidateThemeIds
- notes
- status
- updatedAt

## 9.4 创建或初始化 QuoteCard

### `POST /api/v1/quotes/:quoteId/quote-card/init`

### 说明
若不存在则创建，若已存在则返回现有卡片。

## 9.5 保存 QuoteCard 草稿

### `PATCH /api/v1/quote-cards/:quoteCardId`

#### 请求体
```json
{
  "keywords": ["财富自由", "股权"],
  "causeList": ["股权"],
  "effectList": ["财富自由"],
  "middleStepList": ["持续现金流"],
  "pendingList": [],
  "pendingQuestions": ["为什么股权更接近财富自由？"],
  "candidateNodes": [],
  "candidateEdges": [],
  "candidateThemeIds": ["wealth"],
  "notes": []
}
```

## 9.6 送入书内整理池

### `POST /api/v1/quote-cards/:quoteCardId/push-to-book-tree`

#### 请求体
```json
{
  "bookId": "uuid"
}
```

#### 返回
```json
{
  "success": true,
  "data": {
    "quoteCardId": "uuid",
    "status": "queued_for_book_tree",
    "queuedAt": "2026-04-22T10:30:00Z"
  }
}
```

---

## 10. 书内修剪台查询接口

## 10.1 获取书内页面上下文

### `GET /api/v1/books/:bookId/book-tree/context`

#### 返回字段
- bookId
- bookName
- activeTreeId
- activeVersion
- currentThemeFilter
- pruningQueueCount
- mergeSuggestionCount

## 10.2 获取 BookTree

### `GET /api/v1/book-trees/:treeId`

#### 查询参数
- `includeNodes=true`
- `includeStats=true`

#### 返回字段
- treeId
- bookId
- version
- rootNodeIds
- stats
- nodes

#### nodes 建议结构
```json
{
  "n1": {
    "id": "n1",
    "label": "财富自由",
    "nodeType": "concept",
    "parentId": null,
    "childrenIds": ["n2", "n3"],
    "orderIndex": 0,
    "shortDefinition": "...",
    "themeIds": ["wealth"],
    "sourceQuoteIds": ["q1"],
    "status": "normal"
  }
}
```

## 10.3 获取书内节点详情

### `GET /api/v1/book-nodes/:nodeId`

## 10.4 获取待整理池列表

### `GET /api/v1/book-trees/:treeId/queue`

#### 查询参数
- `page`
- `pageSize`
- `status`
- `chapterId`
- `themeId`

#### 返回字段
- queueItemId
- quoteCardId
- sourceQuoteId
- candidateNodes
- candidateEdges
- suggestedMountPoint
- suggestedTheme
- queueStatus

## 10.5 获取节点来源 QuoteCard 列表

### `GET /api/v1/book-nodes/:nodeId/sources`

#### 返回字段
- quoteId
- quoteCardId
- originalText
- chapterId
- chapterTitle
- pageLabel

---

## 11. 主题整理页查询接口

## 11.1 获取主题页面上下文

### `GET /api/v1/themes/:themeId/context`

#### 返回字段
- themeId
- themeName
- activeTreeId
- activeVersion
- selectedSourceBookIds
- crossBookConnectionCount
- pendingVerifyCount

## 11.2 获取 ThemeTree

### `GET /api/v1/theme-trees/:treeId`

#### 查询参数
- `includeNodes=true`
- `includeStats=true`
- `sourceBookIds=...`（可选）

#### 返回字段
- treeId
- themeId
- version
- rootNodeIds
- stats
- nodes

## 11.3 获取主题节点详情

### `GET /api/v1/theme-nodes/:nodeId`

## 11.4 获取主题节点来源映射

### `GET /api/v1/theme-nodes/:nodeId/source-mappings`

#### 返回字段
- themeNodeId
- bookNodeId
- bookId
- bookTitle
- mappingType
- strength

## 11.5 获取主题来源书籍列表

### `GET /api/v1/themes/:themeId/source-books`

#### 返回字段
- bookId
- title
- author
- contributionNodeCount
- isSelected
- isPrimarySource

---

## 12. 复盘接口

## 12.1 获取复盘列表

### `GET /api/v1/reviews`

#### 查询参数
- `reviewType`
- `page`
- `pageSize`

## 12.2 获取复盘详情

### `GET /api/v1/reviews/:reviewId`

## 12.3 创建复盘

### `POST /api/v1/reviews`

#### 请求体
```json
{
  "reviewType": "theme",
  "title": "财富主题复盘",
  "sourceBookIds": ["uuid1", "uuid2"],
  "sourceThemeIds": ["wealth"],
  "summaryText": "..."
}
```

## 12.4 更新复盘

### `PATCH /api/v1/reviews/:reviewId`

---

## 13. Tree 命令接口（通用风格）

## 13.1 统一命令返回建议

```json
{
  "success": true,
  "data": {
    "command": "moveNode",
    "treeId": "uuid",
    "serverVersion": 12,
    "affectedNodeIds": ["n1", "n2"],
    "patch": {}
  }
}
```

## 13.2 通用命令请求公共字段

所有结构命令建议带：
- `clientVersion`
- `requestId`（可选，便于幂等）

示例：
```json
{
  "clientVersion": 11,
  "requestId": "uuid"
}
```

---

## 14. BookTree 命令接口

## 14.1 重命名节点

### `POST /api/v1/book-trees/:treeId/commands/rename-node`

#### 请求体
```json
{
  "nodeId": "uuid",
  "newLabel": "财富自由",
  "clientVersion": 11
}
```

## 14.2 创建节点

### `POST /api/v1/book-trees/:treeId/commands/create-node`

#### 请求体
```json
{
  "parentId": "uuid",
  "afterSiblingId": null,
  "label": "股权",
  "nodeType": "concept",
  "clientVersion": 11
}
```

## 14.3 删除节点

### `POST /api/v1/book-trees/:treeId/commands/delete-node`

#### 请求体
```json
{
  "nodeId": "uuid",
  "deleteMode": "subtree",
  "clientVersion": 11
}
```

## 14.4 移动节点

### `POST /api/v1/book-trees/:treeId/commands/move-node`

#### 请求体
```json
{
  "nodeId": "uuid",
  "targetParentId": "uuid",
  "targetIndex": 2,
  "clientVersion": 11
}
```

## 14.5 同级重排

### `POST /api/v1/book-trees/:treeId/commands/reorder-node`

#### 请求体
```json
{
  "nodeId": "uuid",
  "parentId": "uuid",
  "targetIndex": 1,
  "clientVersion": 11
}
```

## 14.6 合并节点

### `POST /api/v1/book-trees/:treeId/commands/merge-nodes`

#### 请求体
```json
{
  "nodeIds": ["uuid1", "uuid2"],
  "keepNodeId": "uuid1",
  "newLabel": "股权",
  "inheritSources": true,
  "clientVersion": 11
}
```

## 14.7 拆分节点

### `POST /api/v1/book-trees/:treeId/commands/split-node`

#### 请求体
```json
{
  "nodeId": "uuid",
  "newNodes": [
    { "label": "时间自由", "nodeType": "concept" },
    { "label": "财务自由", "nodeType": "concept" }
  ],
  "clientVersion": 11
}
```

## 14.8 提升抽象

### `POST /api/v1/book-trees/:treeId/commands/elevate-abstract`

#### 请求体
```json
{
  "nodeIds": ["uuid1", "uuid2", "uuid3"],
  "newParentLabel": "放大机制",
  "nodeType": "abstract",
  "clientVersion": 11
}
```

## 14.9 吸收 QuoteCard

### `POST /api/v1/book-trees/:treeId/commands/attach-quote-card`

#### 请求体
```json
{
  "quoteCardId": "uuid",
  "targetParentId": "uuid",
  "mode": "create_new_node",
  "clientVersion": 11
}
```

## 14.10 标记主/次主题

### `POST /api/v1/book-trees/:treeId/commands/tag-node-theme`

#### 请求体
```json
{
  "nodeId": "uuid",
  "mainThemeId": "wealth",
  "secondaryThemeIds": ["growth"],
  "clientVersion": 11
}
```

## 14.11 标记待验证

### `POST /api/v1/book-trees/:treeId/commands/mark-pending-verify`

#### 请求体
```json
{
  "nodeId": "uuid",
  "clientVersion": 11
}
```

---

## 15. ThemeTree 命令接口

## 15.1 重命名节点

### `POST /api/v1/theme-trees/:treeId/commands/rename-node`

## 15.2 创建节点

### `POST /api/v1/theme-trees/:treeId/commands/create-node`

## 15.3 删除节点

### `POST /api/v1/theme-trees/:treeId/commands/delete-node`

## 15.4 移动节点

### `POST /api/v1/theme-trees/:treeId/commands/move-node`

## 15.5 重排节点

### `POST /api/v1/theme-trees/:treeId/commands/reorder-node`

## 15.6 合并节点

### `POST /api/v1/theme-trees/:treeId/commands/merge-nodes`

## 15.7 提升抽象

### `POST /api/v1/theme-trees/:treeId/commands/elevate-abstract`

## 15.8 绑定来源映射

### `POST /api/v1/theme-trees/:treeId/commands/bind-source-mapping`

#### 请求体
```json
{
  "themeNodeId": "uuid",
  "bookNodeId": "uuid",
  "mappingType": "direct",
  "clientVersion": 11
}
```

## 15.9 解绑来源映射

### `POST /api/v1/theme-trees/:treeId/commands/unbind-source-mapping`

#### 请求体
```json
{
  "themeNodeId": "uuid",
  "bookNodeId": "uuid",
  "clientVersion": 11
}
```

## 15.10 设置来源书籍启用状态

### `POST /api/v1/theme-trees/:treeId/commands/set-source-books`

#### 请求体
```json
{
  "selectedSourceBookIds": ["uuid1", "uuid2"],
  "clientVersion": 11
}
```

---

## 16. 视口与 UI 状态接口

## 16.1 保存视口

### `POST /api/v1/canvas/viewports`

#### 请求体
```json
{
  "targetType": "book_tree",
  "targetId": "uuid",
  "viewport": {
    "x": 100,
    "y": 200,
    "zoom": 1.1,
    "fitMode": "manual"
  }
}
```

### 说明
第一版可做轻持久化，不强制写 command_logs。

## 16.2 获取视口

### `GET /api/v1/canvas/viewports?targetType=book_tree&targetId=uuid`

---

## 17. 自动保存接口策略

## 17.1 设计原则

自动保存不单独设计成“整页保存接口”，而是依赖各命令接口自然完成。

## 17.2 前端策略

- 轻命令 debounce 提交
- 重命令立即提交
- 当前状态由 `autosaveStatus` 管理

## 17.3 后端返回要求

结构命令返回中必须至少有：
- `serverVersion`
- `affectedNodeIds`
- `command`

必要时可返回：
- `patch`
- `warnings`

---

## 18. 撤销 / 重做接口建议

## 18.1 第一版建议

第一版撤销 / 重做以前端为主，不强制提供完整后端 undo API。

## 18.2 第二阶段建议

可以预留：

### `POST /api/v1/trees/:treeType/:treeId/commands/undo`
### `POST /api/v1/trees/:treeType/:treeId/commands/redo`

但这不是第一版必要接口。

---

## 19. 导出接口

## 19.1 导出 Markdown

### `POST /api/v1/exports/markdown`

#### 请求体
```json
{
  "targetType": "theme_tree",
  "targetId": "uuid"
}
```

#### 返回
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "queued"
  }
}
```

## 19.2 查询导出任务

### `GET /api/v1/exports/jobs/:jobId`

---

## 20. 命令日志接口（调试 / 管理）

## 20.1 获取树命令日志

### `GET /api/v1/trees/:treeType/:treeId/command-logs`

#### 查询参数
- `page`
- `pageSize`
- `commandName`

#### 返回字段
- commandName
- payload
- clientVersion
- serverVersion
- resultStatus
- createdAt

---

## 21. 版本冲突处理接口行为

## 21.1 冲突场景

当 `clientVersion < serverVersion` 时，结构命令应返回：

```json
{
  "success": false,
  "error": {
    "code": "TREE_VERSION_CONFLICT",
    "message": "当前树版本已过期，请刷新后重试。",
    "details": {
      "clientVersion": 11,
      "serverVersion": 13,
      "treeId": "uuid"
    }
  }
}
```

## 21.2 前端建议行为

- 保留当前本地状态
- 弹出提示
- 允许用户刷新最新树
- 后期可做冲突合并策略

---

## 22. 幂等与 requestId 建议

## 22.1 为什么需要 requestId

在自动保存和重试场景下，命令可能因网络抖动重复提交。

## 22.2 建议

结构命令可带：
- `requestId`

后端可基于：
- userId + requestId + command

做短期幂等去重。

---

## 23. 第一阶段最小接口集合

## 23.1 必需查询接口

- `GET /auth/me`
- `GET /books`
- `GET /books/:bookId`
- `GET /books/:bookId/chapters`
- `GET /books/:bookId/quotes`
- `GET /quotes/:quoteId`
- `GET /quotes/:quoteId/quote-card`
- `GET /books/:bookId/book-tree/context`
- `GET /book-trees/:treeId`
- `GET /book-trees/:treeId/queue`
- `GET /book-nodes/:nodeId`
- `GET /book-nodes/:nodeId/sources`
- `GET /themes/:themeId/context`
- `GET /theme-trees/:treeId`
- `GET /theme-nodes/:nodeId`
- `GET /theme-nodes/:nodeId/source-mappings`
- `GET /themes/:themeId/source-books`

## 23.2 必需命令接口

- `POST /quote-cards/:quoteCardId/push-to-book-tree`
- `PATCH /quote-cards/:quoteCardId`
- `POST /book-trees/:treeId/commands/rename-node`
- `POST /book-trees/:treeId/commands/create-node`
- `POST /book-trees/:treeId/commands/delete-node`
- `POST /book-trees/:treeId/commands/move-node`
- `POST /book-trees/:treeId/commands/reorder-node`
- `POST /book-trees/:treeId/commands/merge-nodes`
- `POST /book-trees/:treeId/commands/elevate-abstract`
- `POST /book-trees/:treeId/commands/attach-quote-card`
- `POST /book-trees/:treeId/commands/tag-node-theme`
- `POST /theme-trees/:treeId/commands/rename-node`
- `POST /theme-trees/:treeId/commands/create-node`
- `POST /theme-trees/:treeId/commands/delete-node`
- `POST /theme-trees/:treeId/commands/move-node`
- `POST /theme-trees/:treeId/commands/reorder-node`
- `POST /theme-trees/:treeId/commands/merge-nodes`
- `POST /theme-trees/:treeId/commands/elevate-abstract`
- `POST /theme-trees/:treeId/commands/bind-source-mapping`

---

## 24. 接口开发顺序建议

建议按以下顺序落地：

### 第一批
- auth
- books
- quotes
- quote_cards

### 第二批
- book-tree 查询
- book-tree 命令
- attachQuoteCard

### 第三批
- theme-tree 查询
- theme-tree 命令
- source mappings

### 第四批
- reviews
- exports
- command logs

---

## 25. 一句话总结

这套 API 的核心不是“把前端数据存回去”，而是围绕 **Tree First、命令式更新、来源可追溯、版本可校验** 四条主线，构建一层真正支撑画布编辑与知识结构演进的后端接口系统。

