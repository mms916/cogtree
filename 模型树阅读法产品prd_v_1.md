# 模型树阅读法产品 PRD（V1）

## 1. 文档信息

- 产品名称：CogTree / 模型树阅读法
- 文档类型：产品需求文档（PRD）
- 版本：V1.0
- 文档目标：明确模型树阅读法产品的整体定位、UI 布局、核心页面、产品流转机制、页面交互规则、画布区交互设计与后续实现优先级

---

## 2. 产品定位

### 2.1 产品一句话定义

一个以**画布为核心**、帮助用户将阅读中的金句与因果关系逐步沉淀为**书内知识树**与**跨书主题知识体系**的系统思考工作台。

### 2.2 产品本质

它不是普通读书笔记工具，也不是单纯的脑图工具，而是一个：

- 以阅读为输入
- 以因果提炼为中层加工
- 以书内修剪为第一轮收敛
- 以主题整理为第二轮收敛
- 最终形成个人知识体系

的认知建构系统。

### 2.3 目标用户

核心用户特征：

- 有较强的深度阅读需求
- 不满足于摘抄金句，想提炼底层逻辑
- 关注因果思考、系统思考、主题建树
- 希望通过阅读搭建长期知识体系
- 愿意投入时间进行结构整理与修剪

### 2.4 产品核心价值

1. 将“原始句子”转化为“结构化认知单元”
2. 将“零散书内观点”转化为“书内知识树”
3. 将“多本书的局部结构”转化为“主题知识体系”
4. 让用户在画布中进行持续的因果思考与系统思考
5. 让阅读不止于记录，而是通向认知积累与知识复利

---

## 3. 产品总体架构

### 3.1 总体工作链路

产品核心流转主线：

**金句提炼页 → 书内修剪台 → 主题整理页**

分别解决三个问题：

- 金句提炼页：这句话说了什么？
- 书内修剪台：这本书怎么讲这个主题？
- 主题整理页：我如何把多本书整合成自己的知识体系？

### 3.2 三层加工模型

#### 第一层：金句提炼页（粗加工）
输入：原始句子、段落、阅读启发
输出：候选关键词、候选因果、候选节点、候选关系、待定问题

#### 第二层：书内修剪台（精加工）
输入：同一本书中的候选因果单元
输出：书内稳定节点、书内局部树、书内主题结构、书内关系优化结果

#### 第三层：主题整理页（总装）
输入：多本书内树中的稳定节点与局部结构
输出：主题树、跨书关系、主题层抽象、个人知识体系节点

---

## 4. 产品信息架构

### 4.1 一级导航结构

一级导航建议保留以下必需模块：

#### 主流程
- 书籍
- 金句
- 书内整理
- 主题整理
- 复盘

#### 工具
- 搜索
- 设置

### 4.2 一级导航设计原则

1. 一级导航只承载“工作阶段切换”
2. 不堆过多栏目，不做功能垃圾桶
3. 尽量稳定、可记忆、低干扰
4. 导航本身不抢占画布注意力

### 4.3 页面结构层级

每个核心页面统一采用以下布局骨架：

1. 顶部全局操作栏
2. 最左侧一级导航栏
3. 左侧二级资源面板
4. 中间核心画布区
5. 右侧详情/思考辅助面板

这是一个典型的：

**导航层 → 资源层 → 认知操作层 → 解释层**

---

## 5. UI 页面布局设计

## 5.1 总体布局原则

### 原则 1：画布优先
中间画布是整个页面最重要的区域，应当占据最大、最连续、最稳定的空间。

### 原则 2：左右侧栏服务画布
左侧负责输入与上下文选择，右侧负责说明与沉淀，均不应喧宾夺主。

### 原则 3：高频操作低打断
用户应尽可能在画布内完成思考与操作，减少弹窗、跳页、多层确认。

### 原则 4：可折叠
左侧资源栏和右侧辅助栏都必须支持折叠/收起/缩窄。

### 原则 5：跨页面共享设计语言
金句提炼页、书内修剪台、主题整理页应共享统一的画布交互体系与组件逻辑。

---

## 5.2 顶部全局操作栏

### 功能构成
- 面包屑路径
- 自动保存状态
- 撤销 / 重做
- 分享
- 导出
- 专注计时器
- 全屏/聚焦视图

### 功能作用

#### 1）路径定位
告诉用户当前在哪个模块、哪本书、哪个主题之下工作。

#### 2）全局动作承载
承载页面无关的通用行为，例如保存、撤销、导出、分享。

#### 3）工作状态展示
展示自动保存状态、是否专注模式、计时器等全局状态信息。

---

## 5.3 最左侧一级导航栏

### 功能作用
回答用户：

**“我当前要进入产品的哪个工作阶段？”**

### 交互设计要求
- 点击后切换工作模式，而不是简单页面跳转
- 尽量保留书籍/主题上下文
- 当前页面高亮
- 工具项（搜索、设置）视觉降级

---

## 5.4 左侧二级资源面板

### 页面角色
当前工作阶段下的“资源池 / 对象池 / 素材池”。

### 核心功能
- 标题区
- 搜索框
- 过滤器
- 资源列表
- 添加资源按钮
- 收起/展开

### 在不同页面中的变化

#### 金句提炼页
- 书籍库 / 金句库切换
- 当前书籍
- 金句列表
- 待处理金句
- 标签筛选

#### 书内修剪台
- 当前书的章节 / 书内主题
- 待修剪节点
- 待合并节点
- 候选因果卡
- 节点池

#### 主题整理页
- 来源书籍
- 来源主题
- 主题搜索
- 待整合书内节点
- 跨书来源管理

---

## 5.5 中间核心画布区

### 页面角色
画布区是整个产品的核心认知操作区，而不是展示区。

### 承载的关键任务
- 因果提炼
- 节点操作
- 关系判断
- 结构修剪
- 抽象提升
- 系统思考
- 主题建树

### 画布区内部组成
1. 画布顶部操作条
2. 画布左侧悬浮工具栏
3. 主画布内容区
4. 小地图 / 迷你导航区
5. 节点状态反馈层

---

## 5.6 右侧详情 / 思考辅助面板

### 页面角色
将当前选中的节点从“短标签”变成“可解释、可沉淀、可复用”的知识单元。

### 建议信息结构
- 标题区
- 节点定义 / 主题定义
- 关键洞察
- 来源书籍 / 来源节点
- 相关主题
- 挂起问题
- 备注
- 我的启发

### 设计原则
- 以 Tab 或折叠区组织信息，避免一长列信息堆叠
- 右侧信息与中间画布强联动
- 修改右侧信息时，中间节点状态应同步反馈

---

## 6. 产品流转机制

## 6.1 核心流转结论

三者关系：

### 金句提炼页
把原始句子转成候选因果单元

### 书内修剪台
把候选因果单元整理成该书自己的局部知识树

### 主题整理页
把多本书中的局部知识树整合为跨书主题树

主线为：

**金句 → 书内树 → 主题树**

---

## 6.2 三层对象定义

### 1）金句因果卡（QuoteCard）
字段建议：
- quoteId
- bookId
- originalText
- page / chapter
- keywords
- candidateNodes
- candidateEdges
- candidateThemes
- questions
- status

### 2）书内节点（BookNode）
字段建议：
- bookNodeId
- bookId
- label
- definition
- parentId
- children
- sourceQuoteIds
- themes
- status

### 3）主题节点（ThemeNode）
字段建议：
- themeNodeId
- themeId
- label
- definition
- parentId
- children
- sourceBookNodeIds
- sourceBooks
- relatedThemes
- notes
- insights

链路：

**QuoteCard → BookNode → ThemeNode**

---

## 6.3 金句提炼页 → 书内修剪台

### 流转逻辑
1. 用户在金句提炼页提取句子关键词与初步因果
2. 系统生成金句因果卡
3. 因果卡进入“待入书内树”池
4. 用户在书内修剪台中吸收这些因果卡
5. 候选节点被挂接到书内树中，或合并到已有节点中

### 规则
- 金句提炼页只生成候选结构，不直接决定最终书内树结构
- 金句提炼结果默认进入“待整理状态”
- 书内修剪台负责第一次正式收敛

---

## 6.4 书内修剪台 → 主题整理页

### 流转逻辑
1. 书内树经过修剪后形成相对稳定节点
2. 节点被打上主题归属（主主题 / 次主题）
3. 主题整理页按主题拉取多个书内树中的稳定节点或局部结构
4. 用户在主题整理页中做跨书整合与抽象提升

### 规则
- 主题整理页优先吸收书内成熟节点，而非直接吸收原始金句
- 主题树可引用书内树来源，但不强制反向污染书内树结构
- 书内树偏作者视角，主题树偏用户整合视角

---

## 6.5 三棵树的关系

### 金句页中的“树”
更准确地说是局部提炼结构，偏句子级、临时性强。

### 书内修剪台中的树
是单书结构树，偏书级，服务于理解该书作者框架。

### 主题整理页中的树
是跨书主题树，偏知识体系级，服务于搭建用户自己的主题知识结构。

---

## 7. 页面交互设计

## 7.1 页面级交互

页面首次加载时，应完成：

1. 恢复上次工作上下文
2. 默认加载当前主题树 / 当前书内树
3. 默认高亮一个焦点节点
4. 右侧自动显示当前节点的详情信息

### 建议恢复的信息
- 当前模块
- 当前书籍
- 当前主题
- 当前选中节点
- 当前画布缩放和视口位置
- 左右侧栏展开状态

---

## 7.2 一级导航交互

### 点击“书籍”
进入书籍管理视图，保留当前上下文尽量不丢失

### 点击“金句”
进入阅读提炼模式，左侧资源栏切换为书籍库 / 金句库

### 点击“书内整理”
进入书内修剪台，加载当前书的内部结构

### 点击“主题整理”
进入跨书主题整理模式

### 点击“复盘”
进入沉淀与总结模式，可带着当前主题或书籍上下文进入

### 导航交互原则
- 尽量保留上下文
- 切换的是工作模式，而不只是页面
- 避免无意义整页刷新

---

## 7.3 左侧资源面板交互

### 支持的交互类型
1. 搜索
2. 单击切换对象
3. 双击深入对象
4. 悬停快捷操作
5. 多选书籍 / 多选来源
6. 拖拽资源到画布
7. 折叠/展开资源面板

### 搜索行为
输入关键词后优先在当前资源池中过滤，不立即跳转页面。

### 单击行为
切换当前书籍 / 主题 / 资源对象，中间画布与右侧信息同步刷新。

### 悬停行为
可显示：
- 设为主来源
- 查看贡献节点
- 固定
- 移除当前主题来源

### 多选行为
在主题整理页中支持多书作为当前主题来源，切换“仅主来源 / 全部来源”。

---

## 7.4 右侧详情面板交互

### 交互原则
- 与中间画布强联动
- 选中节点即刷新内容
- 在右侧修改时，中间节点状态同步
- 信息结构建议使用 Tab 或折叠区

### 推荐 Tab
- 说明
- 来源
- 备注
- 系统思考

### 联动行为示例
- 点击来源书籍，高亮中间画布中该书贡献节点
- 点击相关主题，可切换或高亮相关主题树
- 编辑节点定义，画布 hover 时可显示摘要

---

## 8. 画布区交互设计

## 8.1 画布设计总原则

1. 画布是主战场
2. 高频操作必须短路径
3. 尽量原地编辑
4. 低打断、少弹窗
5. 支持复杂结构管理
6. 支持系统思考而不只是树形展示

---

## 8.2 画布视角交互

### 支持能力
- 滚轮缩放
- 按住空格平移
- 适配视图
- 聚焦当前节点
- 小地图导航
- 返回上一步视图
- 一键查看当前分支

### 小地图功能
- 展示全局结构
- 点击跳转
- 拖拽视口框移动
- 快速回中心

---

## 8.3 节点交互

### 单击节点
- 高亮当前节点
- 右侧刷新详情
- 高亮上下游关系
- 小地图同步定位

### 双击节点
进入原地编辑模式，默认支持修改节点名称。

### 悬停节点
显示轻量工具：
- 新增子节点
- 新增同级节点
- 连线
- 备注
- 更多操作

### 右键节点
打开快捷菜单：
- 重命名
- 合并
- 拆分
- 删除
- 添加备注
- 添加来源
- 标记待验证
- 设为核心节点
- 折叠分支

### 拖拽节点
支持：
- 改变父子层级
- 同级重排
- 整个分支移动

拖拽时必须有明确预反馈：
- 目标高亮
- 插入位置指示
- 非法位置提示

### 折叠 / 展开
- 节点可折叠子树
- 折叠后显示子节点数量
- 支持整树局部控制复杂度

---

## 8.4 关系交互

### 关系类型建议分层
#### 1）树结构关系
用于父子归属

#### 2）辅助关系
用于：
- 因果支撑
- 相关
- 冲突
- 来源映射
- 待验证关系

### 创建关系
从一个节点拖到另一个节点，可创建关系，关系类型可在后续菜单中指定。

### 关系高亮
选中节点时：
- 上游关系高亮
- 下游关系高亮
- 无关节点弱化

### 点击关系线
右侧显示：
- 关系类型
- 关系说明
- 是否待验证
- 来源支撑

---

## 8.5 结构交互

### 合并节点
适用于重复概念、近义概念、同层冗余节点。

操作：
- 多选节点
- 点击“合并节点”
- 选择保留名称或新命名
- 自动继承来源、备注、关系

### 拆分节点
适用于节点语义过大、概念混合、抽象不清。

操作：
- 选中节点
- 点击“拆分”
- 生成多个新节点
- 原关系继承后可再调整

### 提升抽象
适用于多个并列节点可以抽象为更高层概念。

操作：
- 多选若干节点
- 点击“提升抽象”
- 创建新上位节点
- 所选节点自动挂为其子节点

### 删除冗余
适用于：
- 重复节点
- 无效节点
- 暂时不成立节点

建议采用软删除，可恢复。

### MECE 检查
用于辅助用户检查：
- 是否有重叠
- 是否有遗漏
- 是否存在维度混乱

初期建议采用：
- 系统提示疑似问题
- 用户人工判断

---

## 8.6 批量交互

### 支持能力
- 框选多个节点
- Shift / Cmd 多选
- 批量移动
- 批量合并
- 批量打标签
- 批量设为待验证
- 批量删除

---

## 8.7 反馈与状态交互

### 页面反馈
- 自动保存成功提示
- 撤销 / 重做提示
- 结构修改成功提示

### 节点状态建议
- 当前选中
- 待整理
- 待验证
- 可合并
- 有备注
- 有来源
- 多主题引用
- 已折叠

### 反馈示例
- 已移动到“增长财富”下
- 已合并 2 个节点为“股权”
- 当前节点存在 2 条待验证关系
- 当前节点暂无来源支撑

---

## 9. 核心页面功能定义

## 9.1 金句提炼页

### 页面定位
阅读中的局部因果提炼台

### 主要目标
- 从句子中提关键词
- 提初步因果
- 生成候选节点和候选关系
- 将提炼结果送入待整理池

### 页面布局建议
- 顶部目标条
- 左侧书籍库 / 金句库
- 中间局部画布
- 当前金句卡
- 右侧提炼辅助区

### 关键功能
- 金句录入 / 选中
- 关键词提取
- 因 / 果 / 中间环节 / 待定分类
- 生成因果卡
- 送入书内整理池
- 标记候选主题
- 添加问题

---

## 9.2 书内修剪台

### 页面定位
单书知识结构收敛台

### 主要目标
- 吸收金句因果卡
- 合并重复节点
- 调整书内结构
- 修剪并形成书内主题树

### 页面布局建议
- 左侧章节 / 节点池 / 待整理区
- 中间大画布
- 右侧修剪建议 / 节点详情
- 底部待修剪节点托盘（可选）

### 关键功能
- 待整理池接收金句因果卡
- 节点挂接
- 合并 / 拆分 / 提升抽象
- 书内主题标记
- 冗余检查
- 关系修正
- 书内结构备注

---

## 9.3 主题整理页

### 页面定位
跨书主题知识整合台

### 主要目标
- 吸收多书书内稳定节点
- 搭建跨书主题树
- 做跨书抽象提升
- 形成用户自己的主题知识体系

### 页面布局建议
- 左侧来源书籍 / 来源主题
- 中间主题树画布
- 右侧主题定义 / 关键洞察 / 来源 / 备注

### 关键功能
- 多来源书筛选
- 吸收书内稳定节点
- 节点来源映射
- 跨书整合
- 相关主题连接
- 输出用户主题框架

---

## 9.4 复盘页

### 页面定位
阶段性认知沉淀与回顾区

### 主要目标
- 回看某本书或某个主题的整理结果
- 总结洞察
- 记录实践启发与下一步问题

### 关键功能
- 复盘记录
- 主题总结
- 书籍总结
- 核心节点回顾
- 问题回顾
- 导出复盘内容

---

## 10. 用户主流程

## 10.1 从阅读到主题体系的完整链路

### 步骤 1：阅读并摘取金句
用户在阅读时选中一句话，进入金句提炼页。

### 步骤 2：提炼因果卡
用户提取关键词、判断因果、补待定问题，生成因果卡。

### 步骤 3：送入书内整理池
因果卡进入书内修剪台中的待整理池。

### 步骤 4：纳入书内树
用户在书内修剪台中将候选节点挂入书内树，合并冗余、修正结构。

### 步骤 5：形成书内稳定节点
经修剪后形成成熟的书内节点，并标记所属主题。

### 步骤 6：进入主题整理页
主题整理页按主题拉取多本书中的成熟节点与局部结构。

### 步骤 7：跨书整合
用户对跨书节点进行抽象提升、合并、重构，形成主题树。

### 步骤 8：沉淀定义与洞察
在右侧详情面板中补充定义、来源、关键洞察、备注与待验证问题。

### 步骤 9：进入复盘
用户对某本书、某个主题或某段学习过程进行复盘沉淀。

---

## 11. MVP 范围建议

## 11.1 必须优先实现

### 基础架构
- 一级导航
- 左侧资源面板
- 中间画布
- 右侧详情面板
- 顶部全局操作栏

### 金句提炼页
- 金句列表
- 关键词提取
- 因 / 果 / 中间环节 / 待定
- 生成金句因果卡
- 送入待整理池

### 书内修剪台
- 接收待整理因果卡
- 书内树展示
- 拖拽挂接
- 合并节点
- 重命名
- 删除
- 折叠展开

### 主题整理页
- 按主题读取多个书内成熟节点
- 显示跨书主题树
- 编辑主题定义
- 记录来源书籍
- 添加备注

### 画布基础能力
- 缩放
- 平移
- 小地图
- 单击 / 双击 / 拖拽节点
- 原地编辑
- 撤销 / 重做
- 自动保存

---

## 11.2 第二阶段建议实现
- 拆分节点
- 提升抽象
- 辅助关系线
- 待验证状态
- 多选与批量操作
- 右键菜单
- 复盘页
- 主题相关性高亮
- 节点来源回跳

---

## 11.3 第三阶段建议实现
- AI 辅助 MECE 检查
- AI 辅助抽象提升建议
- AI 辅助重复检测
- AI 辅助主题归类
- 协作与分享
- 导出 Markdown / 图片 / 大纲
- 节点历史版本回溯

---

## 12. 页面级字段与状态定义

## 12.1 全局上下文字段

### GlobalContext
- currentModule：当前模块（books / quotes / book_tree / theme_tree / review）
- currentBookId：当前书籍 ID
- currentThemeId：当前主题 ID
- currentViewMode：当前视图模式（normal / focus / pruning / extraction）
- currentSelectedNodeId：当前选中节点 ID
- currentSelectionIds：当前多选节点 ID 列表
- leftPanelState：左侧资源栏状态（expanded / collapsed / hidden）
- rightPanelState：右侧面板状态（expanded / collapsed / hidden）
- canvasViewport：当前画布视口信息
- zoomLevel：当前缩放比例
- autosaveStatus：自动保存状态（idle / saving / saved / error）
- undoAvailable：是否可撤销
- redoAvailable：是否可重做

## 12.2 页面级状态定义

### 通用页面状态
- 初始化中
- 加载成功
- 空状态
- 编辑中
- 自动保存中
- 保存成功
- 保存失败
- 本地变更未同步
- 网络异常

### 左侧资源面板状态
- 默认展开
- 缩窄
- 完全收起
- 搜索中
- 过滤结果为空
- 多来源选中

### 右侧详情面板状态
- 未选中节点
- 已选中节点
- 编辑定义中
- 编辑备注中
- 查看来源中
- 查看系统思考中

### 画布状态
- 空画布
- 正常浏览
- 节点选中
- 多选中
- 拖拽中
- 连线中
- 重命名中
- 框选中
- 合并预览中
- 拆分编辑中
- 提升抽象中
- 关系高亮中
- 只读模式

## 12.3 节点状态定义

### BookNode / ThemeNode 通用状态
- normal：正常
- selected：当前选中
- editing：编辑中
- collapsed：已折叠
- pending_review：待整理
- pending_verify：待验证
- merge_candidate：可合并候选
- duplicated：疑似重复
- has_note：有备注
- has_source：有来源
- referenced_multi_theme：多主题引用
- hidden_by_filter：被过滤隐藏

### 关系状态定义
- tree_parent_child：父子关系
- support：支撑关系
- related：相关关系
- conflict：冲突关系
- pending_verify：待验证关系
- derived_from_source：来源映射关系

---

## 13. 页面字段设计

## 13.1 金句提炼页字段

### 页面级字段
- pageTitle：页面标题
- readingGoal：当前阅读目标
- currentBookId：当前书籍 ID
- currentQuoteId：当前金句 ID
- currentQuoteSource：金句来源位置（章节 / 页码 / 段落）
- extractionStatus：提炼状态
- candidateThemeIds：候选主题列表

### 金句卡字段
- quoteId
- originalText
- normalizedText
- chapterLabel
- pageLabel
- tags
- createdAt
- updatedAt
- favoriteStatus

### 提炼结果字段
- keywordList
- causeList
- effectList
- middleStepList
- pendingList
- pendingQuestions
- candidateNodeLabels
- candidateEdgeList
- readyToPushBookTree（是否送入书内整理池）

## 13.2 书内修剪台字段

### 页面级字段
- pageTitle
- currentBookId
- bookStructureVersion
- pruningQueueCount
- mergeSuggestionCount
- currentChapterId
- currentBookThemeFilter

### 书内节点字段
- bookNodeId
- label
- shortDefinition
- fullDefinition
- nodeType（concept / cause / effect / mechanism / question / note）
- parentId
- childrenIds
- orderIndex
- sourceQuoteIds
- sourceChapterIds
- themeIds
- noteCount
- pendingQuestionCount
- confidenceScore
- reviewStatus

### 待整理池字段
- queueItemId
- sourceQuoteId
- candidateNodes
- candidateEdges
- suggestedMountPoint
- suggestedTheme
- queueStatus

## 13.3 主题整理页字段

### 页面级字段
- pageTitle
- currentThemeId
- selectedSourceBookIds
- selectedSourceBookNodeIds
- themeTreeVersion
- crossBookConnectionCount
- pendingVerifyCount
- insightCount

### 主题节点字段
- themeNodeId
- label
- shortDefinition
- fullDefinition
- nodeLevel
- parentId
- childrenIds
- orderIndex
- sourceBookNodeIds
- sourceBooksSummary
- relatedThemeIds
- insightList
- noteList
- pendingQuestionList
- abstractLevel
- verificationStatus

## 13.4 复盘页字段

### 页面级字段
- reviewId
- reviewType（book / theme / stage）
- sourceBookIds
- sourceThemeIds
- summaryText
- insightList
- unresolvedQuestions
- nextActionList
- exportStatus

---

## 14. 核心数据结构建议

## 14.1 QuoteCard 数据结构

```ts
interface QuoteCard {
  quoteId: string
  bookId: string
  chapterId?: string
  originalText: string
  normalizedText?: string
  pageLabel?: string
  tags: string[]
  keywords: string[]
  causeList: string[]
  effectList: string[]
  middleStepList: string[]
  pendingList: string[]
  pendingQuestions: string[]
  candidateNodes: CandidateNode[]
  candidateEdges: CandidateEdge[]
  candidateThemeIds: string[]
  status: 'draft' | 'extracted' | 'queued_for_book_tree' | 'archived'
  createdAt: string
  updatedAt: string
}

interface CandidateNode {
  tempId: string
  label: string
  nodeType: 'concept' | 'cause' | 'effect' | 'mechanism' | 'pending'
}

interface CandidateEdge {
  tempId: string
  sourceTempId: string
  targetTempId: string
  relationType: 'tree_parent_child' | 'support' | 'related' | 'pending_verify'
}
```

## 14.2 BookNode / BookTree 数据结构

```ts
interface BookTree {
  treeId: string
  bookId: string
  version: number
  rootNodeIds: string[]
  nodes: Record<string, BookNode>
  updatedAt: string
}

interface BookNode {
  bookNodeId: string
  bookId: string
  label: string
  shortDefinition?: string
  fullDefinition?: string
  nodeType: 'concept' | 'cause' | 'effect' | 'mechanism' | 'question' | 'note'
  parentId?: string | null
  childrenIds: string[]
  orderIndex: number
  sourceQuoteIds: string[]
  sourceChapterIds: string[]
  themeIds: string[]
  relatedNodeIds?: string[]
  noteIds?: string[]
  status: 'normal' | 'selected' | 'editing' | 'collapsed' | 'pending_review' | 'pending_verify' | 'merge_candidate'
  createdAt: string
  updatedAt: string
}
```

## 14.3 ThemeNode / ThemeTree 数据结构

```ts
interface ThemeTree {
  treeId: string
  themeId: string
  version: number
  rootNodeIds: string[]
  nodes: Record<string, ThemeNode>
  updatedAt: string
}

interface ThemeNode {
  themeNodeId: string
  themeId: string
  label: string
  shortDefinition?: string
  fullDefinition?: string
  nodeLevel: number
  parentId?: string | null
  childrenIds: string[]
  orderIndex: number
  sourceBookNodeIds: string[]
  sourceBooksSummary: string[]
  relatedThemeIds: string[]
  insightIds?: string[]
  noteIds?: string[]
  pendingQuestionIds?: string[]
  status: 'normal' | 'selected' | 'editing' | 'collapsed' | 'pending_verify' | 'referenced_multi_theme'
  createdAt: string
  updatedAt: string
}
```

## 14.4 画布视口数据结构

```ts
interface CanvasViewport {
  x: number
  y: number
  zoom: number
  fitMode?: 'manual' | 'fit_all' | 'fit_selection'
}
```

---

## 15. 页面交互规则（开发级）

## 15.1 通用交互规则

### 规则 1：保留上下文
用户切换一级页面时，应尽可能保留当前书籍、主题、选中节点与画布视口上下文。

### 规则 2：尽量原地编辑
节点命名、定义补充、备注编辑优先采用原地编辑或右侧编辑，不使用打断式弹窗。

### 规则 3：所有关键操作必须可撤销
包括：
- 新增节点
- 删除节点
- 重命名节点
- 改父子关系
- 合并
- 拆分
- 提升抽象
- 关系创建 / 删除

### 规则 4：所有结构性操作必须有反馈
必须反馈：
- 操作成功
- 操作失败
- 非法目标
- 自动保存中 / 已保存

## 15.2 金句提炼页交互规则

### 选中金句
- 单击金句：加载该金句内容与历史提炼状态
- 切换金句前：自动保存当前提炼结果

### 提炼完成
- 点击“送入书内整理池”后，QuoteCard 状态改为 queued_for_book_tree
- 系统提示“已加入待整理池”
- 支持继续留在当前页或跳转书内修剪台

### 候选主题标记
- 一条金句可标多个候选主题
- 主题标记仅做候选，不直接生成主题树节点

## 15.3 书内修剪台交互规则

### 吸收待整理因果卡
- 左侧待整理池展示 QuoteCard 列表
- 用户可拖拽因果卡到书内树某节点下
- 拖拽前显示挂接预览
- 拖拽后由系统生成对应 BookNode，或合并到已有 BookNode

### 合并节点
- 多选两个及以上节点后可触发“合并节点”
- 合并时弹出轻量确认层，允许：
  - 选择保留名称
  - 自定义新名称
  - 是否继承所有来源
- 合并成功后保留审计记录

### 提升抽象
- 仅允许多选同层节点触发
- 触发后生成新上位节点
- 所选节点自动成为其子节点
- 若当前节点跨层，则提示“仅支持同层节点提升抽象”

### 标记主题归属
- BookNode 允许添加主主题与次主题
- 主主题为后续主题整理页主要吸收依据

## 15.4 主题整理页交互规则

### 拉取来源
- 进入某主题后，默认拉取该主题下全部已勾选来源书籍的 BookNode
- 用户取消某本书勾选后，仅隐藏其来源节点，不直接删除 ThemeNode

### 主题节点创建
- ThemeNode 可由以下方式创建：
  1. 从书内节点拖入主题画布
  2. 在主题画布中手动新建
  3. 多节点提升抽象生成

### 来源映射
- 每个 ThemeNode 必须至少支持查看来源 BookNode 列表
- 点击来源时可选择：
  - 高亮来源节点
  - 打开来源书内修剪台
  - 查看来源金句

### 主题层抽象规则
- ThemeNode 为用户整合视角，不强制回写到 BookTree
- 若用户主动选择“同步为书内抽象建议”，才写入建议池，而非直接改书内树

## 15.5 复盘页交互规则

- 可从书籍、主题、当前阶段发起复盘
- 复盘内容默认引用当前上下文的核心节点、洞察与问题
- 支持导出 Markdown

---

## 16. 画布区专项交互规则

## 16.1 视角交互规则

### 缩放
- 滚轮缩放以鼠标所在位置为中心
- 顶部缩放控件每次缩放固定比例
- 双击节点可聚焦到节点区域

### 平移
- 按住空格 + 拖拽空白区域：平移画布
- 选择“手型工具”后拖拽：平移画布

### 适配视图
- fit_all：适配整棵树
- fit_selection：适配当前选中节点或分支

## 16.2 节点交互规则

### 单击
- 高亮节点
- 右侧加载详情
- 画布高亮上下游路径

### 双击
- 进入节点重命名态
- Enter 保存
- Esc 取消

### 悬停
- 显示轻量快捷工具：
  - 新增子节点
  - 新增同级节点
  - 连线
  - 添加备注
  - 更多

### 右键
- 打开节点菜单：
  - 重命名
  - 合并
  - 拆分
  - 提升抽象
  - 删除
  - 添加来源
  - 标记待验证
  - 折叠 / 展开

## 16.3 拖拽规则

### 拖拽改父子关系
- 当拖拽节点悬停在另一个节点上方时，目标节点高亮
- 松开鼠标后，该节点成为目标节点子节点
- 若会产生循环引用，则禁止并提示

### 拖拽重排同级顺序
- 在同级节点区域拖拽时显示插入指示线
- 松开后更新 orderIndex

### 拖拽整棵子树
- 默认拖拽节点时，连带其 childrenIds 一起移动

## 16.4 关系创建规则

### 创建关系
- 从节点连接点拖向目标节点
- 松开后弹出轻量关系类型菜单
- 默认关系类型按当前模式决定：
  - 书内树 / 主题树模式：默认 tree_parent_child
  - 系统思考模式：默认 support

### 删除关系
- 选中关系线后 Delete 删除
- 删除前显示关系摘要

## 16.5 批量操作规则

### 多选
- Shift + 单击：累积多选
- 拖框：框选
- Cmd/Ctrl + A：选择当前分支下全部节点（后期可选）

### 批量操作能力
- 合并
- 移动到某节点下
- 标记待验证
- 删除
- 加入某主题

## 16.6 键盘快捷键建议

### 基础快捷键
- Enter：新增同级节点
- Tab：新增子节点
- Shift + Tab：提升一级
- Delete / Backspace：删除节点
- Cmd/Ctrl + Z：撤销
- Cmd/Ctrl + Shift + Z：重做
- Space：临时手型拖动画布
- Cmd/Ctrl + F：搜索当前页
- Cmd/Ctrl + K：全局命令面板（后期）
- Esc：退出当前编辑态

---

## 17. 组件清单（开发拆解）

## 17.1 布局组件
- AppShell
- TopGlobalBar
- PrimarySidebar
- SecondaryResourcePanel
- CanvasWorkspace
- RightDetailPanel
- BottomTray（可选）

## 17.2 资源组件
- BookList
- QuoteList
- SourceBookSelector
- ThemeSourceList
- SearchInput
- FilterBar
- ResourceCard

## 17.3 画布组件
- CanvasViewport
- CanvasToolbar
- FloatingToolPalette
- MiniMap
- NodeRenderer
- EdgeRenderer
- SelectionBox
- ContextMenu
- RelationTypePopover
- ZoomController
- LayoutSwitcher

## 17.4 右侧面板组件
- NodeHeader
- DefinitionCard
- InsightCard
- SourceMappingCard
- RelatedThemeCard
- PendingQuestionCard
- NotesCard
- TabsContainer

## 17.5 操作组件
- CommandBar（后期）
- ToastFeedback
- ConfirmPopover
- MergeDialog（轻量）
- SplitPanel
- AbstractUpgradePopover

---

## 18. 接口与存储建议（简版）

## 18.1 最低必需接口
- 获取当前页面上下文
- 获取书籍列表
- 获取金句列表
- 获取 QuoteCard 详情
- 保存 QuoteCard 提炼结果
- 获取 BookTree
- 保存 BookTree 变更
- 获取 ThemeTree
- 保存 ThemeTree 变更
- 获取节点详情
- 保存节点定义 / 备注 / 洞察
- 获取来源映射
- 撤销 / 重做

## 18.2 存储建议
- Tree First：树结构为唯一真相源
- Edge 可派生，不建议作为最终真相源
- 节点的关系、来源、状态单独存储字段
- 自动保存采用增量更新

---

## 19. 关键设计原则总结

1. 画布优先
2. 左侧供料，中间思考，右侧沉淀
3. 金句不直接等于知识体系
4. 书内树是第一次正式收敛
5. 主题树是第二次高层收敛
6. 书内树偏作者视角，主题树偏用户整合视角
7. 高频操作必须低打断
8. 尽量原地编辑，少跳转、少弹窗
9. 复杂结构必须通过缩放、折叠、小地图来管理
10. 所有结构操作都需要明确反馈

---

## 20. 一句话总结

模型树阅读法产品的核心，不是“记下多少金句”，而是让用户在一个以画布为核心的工作台里，完成：

**从句子到因果、从因果到书内树、从书内树到主题树、从主题树到个人知识体系**

的完整认知建构过程。

