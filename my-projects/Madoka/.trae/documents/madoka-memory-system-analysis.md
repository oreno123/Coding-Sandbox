# Madoka 记忆系统技术解析

## 1. 系统概述

### 1.1 定位与作用

Madoka 的记忆系统是一个**纯本地**的智能记忆管理模块，负责：
- 存储用户与AI的对话历史片段（Episode）
- 基于权重算法智能管理记忆生命周期
- 支持长期记忆标记和固定保护
- 与 Obsidian 进行双向同步

### 1.2 架构关系

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ MemoryOverview│  │   Composer   │  │   ChatContext    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼───────────────────┼────────────┘
          │                 │                   │
          └─────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      消息通信层 (messaging)                   │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      后台服务层 (background)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ memoryWorker │  │cleanupEngine │  │   obsidianSync   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                   │            │
│  ┌──────┴───────┐  ┌──────┴───────┐          │            │
│  │  memoryDb    │  │memoryScoring │          │            │
│  └──────┬───────┘  └──────────────┘          │            │
└─────────┼─────────────────────────────────────┼────────────┘
          │                                     │
          ▼                                     ▼
┌─────────────────────────────────┐  ┌──────────────────────┐
│      IndexedDB (浏览器存储)      │  │ File System Access API│
│     (MadokaMemory Database)     │  │   (Obsidian 文件夹)   │
└─────────────────────────────────┘  └──────────────────────┘
```

### 1.3 核心设计原则

1. **纯本地存储**：所有记忆数据存储在浏览器 IndexedDB 中，无网络传输
2. **权重驱动**：通过算法计算记忆重要性，指导召回和清理决策
3. **渐进式清理**：保留规则优先，清理规则兜底，支持容量压力下的激进清理
4. **Obsidian 集成**：可选的双向同步，将记忆导出为 Markdown 文件

---

## 2. 核心数据模型

### 2.1 Episode（记忆单元）

Episode 是记忆系统的核心数据结构，代表一次对话片段：

```typescript
export interface Episode {
  uid: string                          // 唯一标识符
  content: string                      // 对话内容（用户+助手）
  role: 'user' | 'assistant' | 'system' // 角色
  createdAt: number                    // 创建时间戳
  lastAccessed: number                 // 最后访问时间戳
  producerId: string                   // 生产者ID
  producerRole: string                 // 生产者角色
  weight: number                       // 权重 (0-1)
  metadata: {
    source?: string                    // 来源
    remark?: string                    // 备注
    conversationId?: string            // 所属会话ID
    sourceUrl?: string                 // 来源URL
    pageTitle?: string                 // 页面标题
    contextRefs?: string               // 上下文引用
  }
  isLongTermCandidate: boolean         // 是否为长期记忆候选
  isLongTerm: boolean                  // 是否为长期记忆
  pinned: boolean                      // 是否固定
  syncToObsidian: boolean              // 是否同步到Obsidian
  syncStatus: 'success' | 'failed' | 'retrying' | ''  // 同步状态
  markdownPath: string                 // Markdown文件路径
  summary: string                      // 摘要
  topics: string[]                     // 主题标签
  memoryType: string                   // 记忆类型
  personaSignals: string[]             // 用户画像信号
}
```

**关键字段说明：**

| 字段 | 说明 |
|------|------|
| `uid` | 格式为 `ep-${timestamp}-${random}`，确保唯一性 |
| `weight` | 动态计算值，影响召回排序和清理决策 |
| `isLongTerm` | 由LLM判断的记忆类型，长期记忆享有权重保护 |
| `pinned` | 用户手动固定，固定记忆不会被清理 |
| `syncToObsidian` | 受全局设置控制，开启后自动同步 |

### 2.2 UserProfile（用户画像）

本地聚合的用户偏好信息：

```typescript
export interface UserProfile {
  preferredLanguages: string[]   // 偏好语言
  domains: string[]              // 关注领域
  interests: string[]            // 兴趣标签
  tonePreference: string         // 语气偏好
  toolPreferences: string[]      // 工具偏好
  updatedAt: number              // 更新时间
}
```

### 2.3 MemorySettings（记忆设置）

可配置的阈值参数：

```typescript
export interface MemorySettings {
  enabled: boolean                    // 记忆功能开关
  obsidianSyncEnabled: boolean        // Obsidian同步开关
  userProfileEnabled: boolean         // 用户画像开关
  
  // 保留规则
  retainCreatedDays: number           // 保留：最近N天内创建
  retainAccessedDays: number          // 保留：最近N天内访问
  retainWeightMin: number             // 保留：权重 >=
  
  // 清理规则
  cleanupCreatedDays: number          // 清理：创建超过N天
  cleanupWeightMax: number            // 清理：权重 <
  
  // 容量压力规则
  pressureCreatedDays: number         // 压力：创建超过N天
  pressureWeightMax: number           // 压力：权重 <
  
  // 配额设置
  quotaRatio: number                  // 存储配额比例 (0-1)
  quotaMaxMb: number                  // 绝对上限MB
  cleanupHour: number                 // 每日清理时间
  recallLimit: number                 // 召回条数上限
}
```

**默认值：**

```typescript
export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  enabled: true,
  obsidianSyncEnabled: false,
  userProfileEnabled: true,
  retainCreatedDays: 30,      // 30天内创建保留
  retainAccessedDays: 30,     // 30天内访问保留
  retainWeightMin: 0.6,       // 权重>=0.6保留
  cleanupCreatedDays: 90,     // 90天前创建可清理
  cleanupWeightMax: 0.4,      // 权重<0.4可清理
  pressureCreatedDays: 180,   // 180天前+低权重激进清理
  pressureWeightMax: 0.2,
  quotaRatio: 0.8,            // 使用80%配额
  quotaMaxMb: 0,              // 无绝对限制
  cleanupHour: 1,             // 凌晨1点清理
  recallLimit: 10,            // 召回最多10条
}
```

### 2.4 MemoryTagsFromLLM（LLM返回的记忆标签）

LLM在回复末尾通过JSON格式返回记忆元数据：

```typescript
export interface MemoryTagsFromLLM {
  shouldPersist: boolean           // 是否应持久化
  summary?: string                 // 摘要
  topics?: string[]                // 主题
  memoryType?: 'short' | 'long'    // 记忆类型
  personaSignals?: string[]        // 画像信号
}
```

**JSON格式示例：**

```json
```json
{
  "memory": {
    "shouldPersist": true,
    "summary": "用户询问React性能优化",
    "topics": ["React", "性能优化"],
    "memoryType": "long",
    "personaSignals": ["前端开发", "技术深度"]
  }
}
```
```

---

## 3. 存储层 (memoryDb.ts)

### 3.1 数据库结构

```typescript
const DB_NAME = 'MadokaMemory'
const DB_VERSION = 1

// ObjectStore 定义
const STORE_EPISODES = 'episodes'      // 记忆单元存储
const STORE_PROFILE = 'userProfile'    // 用户画像存储
const STORE_SETTINGS = 'memorySettings' // 设置存储
const STORE_OBSIDIAN = 'obsidianSettings' // Obsidian设置
const STORE_LOGS = 'cleanupLogs'       // 清理日志
```

### 3.2 索引设计

Episodes Store 建立了4个索引：

```typescript
const os = db.createObjectStore(STORE_EPISODES, { keyPath: 'uid' })
os.createIndex('createdAt', 'createdAt', { unique: false })
os.createIndex('conversationId', 'metadata.conversationId', { unique: false })
os.createIndex('lastAccessed', 'lastAccessed', { unique: false })
os.createIndex('weight', 'weight', { unique: false })
```

| 索引名 | 字段 | 用途 |
|--------|------|------|
| createdAt | createdAt | 按创建时间排序、范围查询 |
| conversationId | metadata.conversationId | 会话维度查询 |
| lastAccessed | lastAccessed | 访问时间排序 |
| weight | weight | 权重筛选 |

### 3.3 核心操作方法

| 方法 | 功能 | 关键实现 |
|------|------|----------|
| `addEpisode(ep)` | 添加记忆 | `objectStore.put(ep)` |
| `updateEpisode(uid, updates)` | 更新记忆 | 先get再put，自动更新lastAccessed |
| `getEpisode(uid)` | 获取单条 | `objectStore.get(uid)` |
| `deleteEpisode(uid)` | 删除记忆 | `objectStore.delete(uid)` |
| `getAllEpisodes()` | 获取全部 | `objectStore.getAll()` |
| `getEpisodesForRecall(opts)` | 召回查询 | 过滤+排序+分页 |
| `estimateEpisodesSize()` | 估算大小 | JSON序列化后计算字节数 |

### 3.4 召回查询实现

```typescript
export async function getEpisodesForRecall(opts: {
  conversationId?: string
  sourceUrl?: string
  limit: number
  minWeight?: number
}): Promise<Episode[]> {
  let list = await getAllEpisodes()
  
  // 会话过滤
  if (opts.conversationId) {
    list = list.filter((e) => e.metadata.conversationId === opts.conversationId)
  }
  
  // URL过滤
  if (opts.sourceUrl) {
    list = list.filter((e) => e.metadata.sourceUrl === opts.sourceUrl)
  }
  
  // 权重过滤
  if (opts.minWeight != null) {
    list = list.filter((e) => e.weight >= opts.minWeight)
  }
  
  // 按访问时间倒序
  list.sort((a, b) => b.lastAccessed - a.lastAccessed)
  return list.slice(0, opts.limit)
}
```

---

## 4. 权重计算机制 (memoryScoring.ts)

### 4.1 基础权重算法

权重计算基于**时间衰减**和**访问衰减**两个维度：

```typescript
export function computeWeight(ep: Episode): number {
  const createdAgo = (NOW() - ep.createdAt) / MS_DAY    // 创建距今天数
  const accessedAgo = (NOW() - ep.lastAccessed) / MS_DAY // 访问距今天数
  
  // 双指数衰减
  const decay = Math.exp(-0.02 * createdAgo) * Math.exp(-0.05 * accessedAgo)
  
  // 基础权重 (0.5 ~ 1.0)
  let w = 0.5 + 0.5 * decay
  
  // 保护机制
  if (ep.pinned) w = Math.max(w, 0.9)       // 固定记忆最低0.9
  if (ep.isLongTerm) w = Math.max(w, 0.65)  // 长期记忆最低0.65
  
  return Math.min(1, Math.max(0, w))
}
```

**衰减系数说明：**

| 维度 | 系数 | 半衰期 |
|------|------|--------|
| 创建时间 | 0.02 | ~35天 |
| 访问时间 | 0.05 | ~14天 |

### 4.2 召回评分机制

召回时除了基础权重，还考虑上下文匹配：

```typescript
export function recallScore(
  ep: Episode,
  opts: { conversationId?: string; sourceUrl?: string }
): number {
  let s = ep.weight
  
  // 同会话加分
  if (opts.conversationId && ep.metadata.conversationId === opts.conversationId) {
    s += 0.2
  }
  
  // 同URL加分
  if (opts.sourceUrl && ep.metadata.sourceUrl === opts.sourceUrl) {
    s += 0.15
  }
  
  return Math.min(1, s)
}
```

---

## 5. 核心业务逻辑 (memoryWorker.ts)

### 5.1 记忆添加流程

```
┌─────────────┐
│  接收对话   │
└──────┬──────┘
       ▼
┌─────────────┐     否    ┌─────────────┐
│ 记忆功能    │──────────▶│   直接返回   │
│ 是否开启？  │           └─────────────┘
└──────┬──────┘
       │ 是
       ▼
┌─────────────┐
│ 解析LLM标签  │
│ (shouldPersist,│
│ summary, etc)│
└──────┬──────┘
       ▼
┌─────────────┐
│ 构建Episode │
│ - 生成UID   │
│ - 设置初始  │
│   权重0.6   │
└──────┬──────┘
       ▼
┌─────────────┐
│ 计算最终权重 │
│ (computeWeight)
└──────┬──────┘
       ▼
┌─────────────┐
│ 写入IndexedDB│
└──────┬──────┘
       ▼
┌─────────────┐     否    ┌─────────────┐
│ Obsidian    │──────────▶│   完成      │
│ 同步开启？   │           └─────────────┘
└──────┬──────┘
       │ 是
       ▼
┌─────────────┐
│ 写入Markdown │
│ 更新syncStatus│
└─────────────┘
```

### 5.2 记忆查询流程

```typescript
export async function memoryQuery(opts: {
  conversationId?: string
  sourceUrl?: string
  limit?: number
}): Promise<{ episodes: Episode[] }> {
  const settings = await db.getMemorySettings()
  if (!settings.enabled) return { episodes: [] }

  const limit = opts.limit ?? settings.recallLimit
  const list = await db.getEpisodesForRecall({
    conversationId: opts.conversationId,
    sourceUrl: opts.sourceUrl,
    limit,
  })
  
  // 按权重排序
  const scored = list.map((ep) => ({ ...ep, score: ep.weight }))
  scored.sort((a, b) => b.score - a.score)
  return { episodes: scored.slice(0, limit) }
}
```

### 5.3 配额检查与清理触发

```typescript
export async function memoryCheckQuotaAndCleanup(): 
  Promise<{ overQuota: boolean; deleted: number }> {
  
  const settings = await db.getMemorySettings()
  if (!settings.enabled) return { overQuota: false, deleted: 0 }

  // 计算配额字节数
  let quotaBytes: number
  const est = await navigator.storage.estimate()
  const total = est.quota ?? 0
  quotaBytes = Math.floor(total * settings.quotaRatio)
  if (settings.quotaMaxMb > 0) {
    quotaBytes = Math.min(quotaBytes, settings.quotaMaxMb * 1024 * 1024)
  }

  // 检查是否超限
  const usage = await db.estimateEpisodesSize()
  if (usage <= quotaBytes) return { overQuota: false, deleted: 0 }

  // 执行压力清理
  const { deleted } = await runPressureCleanup()
  return { overQuota: deleted === 0, deleted }
}
```

---

## 6. 智能清理机制 (cleanupEngine.ts)

### 6.1 清理规则设计

清理采用**保留优先**策略：

```
保留规则（满足任一即保留）：
├── 创建时间在 retainCreatedDays 内
├── 访问时间在 retainAccessedDays 内
└── 权重 >= retainWeightMin

清理规则（需全部满足）：
├── 创建时间超过 cleanupCreatedDays
├── 权重 < cleanupWeightMax
└── 访问时间超过 retainAccessedDays
```

### 6.2 普通清理流程

```typescript
export async function runCleanup(reason: string): 
  Promise<{ deleted: number; uids: string[] }> {
  
  const settings = await db.getMemorySettings()
  const all = await db.getAllEpisodes()
  const now = Date.now()
  
  const toDelete: Episode[] = []
  for (const ep of all) {
    if (ep.pinned) continue  // 跳过固定记忆
    
    const createdAgo = now - ep.createdAt
    const accessedAgo = now - ep.lastAccessed
    const weight = computeWeight(ep)

    // 保留检查
    const retain =
      createdAgo < retainCreatedMs ||
      weight >= settings.retainWeightMin ||
      accessedAgo < retainAccessedMs
    if (retain) continue

    // 清理检查
    const cleanup =
      createdAgo > cleanupCreatedMs &&
      weight < settings.cleanupWeightMax &&
      accessedAgo >= retainAccessedMs
    if (cleanup) toDelete.push(ep)
  }

  // 执行删除 + Obsidian同步删除
  for (const ep of toDelete) {
    await db.deleteEpisode(ep.uid)
    await runObsidianDeleteForEpisodes([ep])
  }

  // 记录日志
  if (uids.length > 0) {
    await db.addCleanupLog({ id, at, deletedCount, uids, reason })
  }
}
```

### 6.3 容量压力清理

当存储超过配额时，触发更激进的清理：

```typescript
export async function runPressureCleanup(): 
  Promise<{ deleted: number; uids: string[] }> {
  
  const settings = await db.getMemorySettings()
  const all = await db.getAllEpisodes()
  const now = Date.now()
  const pressureCreatedMs = settings.pressureCreatedDays * 86400000

  const toDelete: Episode[] = []
  for (const ep of all) {
    if (ep.pinned) continue
    const createdAgo = now - ep.createdAt
    const weight = computeWeight(ep)
    
    // 激进条件：超期 + 低权重
    if (createdAgo > pressureCreatedMs && weight < settings.pressureWeightMax) {
      toDelete.push(ep)
    }
  }

  // 批量删除
  for (const ep of toDelete) {
    await db.deleteEpisode(ep.uid)
    await runObsidianDeleteForEpisodes([ep])
  }
}
```

### 6.4 清理配置对比

| 场景 | 创建时间 | 权重阈值 | 访问时间 |
|------|----------|----------|----------|
| 普通保留 | < 30天 | ≥ 0.6 | < 30天 |
| 普通清理 | > 90天 | < 0.4 | ≥ 30天 |
| 压力清理 | > 180天 | < 0.2 | 不考虑 |

---

## 7. Obsidian同步 (obsidianSync.ts)

### 7.1 架构设计

```
┌─────────────────────────────────────────┐
│           File System Access API        │
│  (用户通过侧栏选择 Obsidian 文件夹)       │
└───────────────────┬─────────────────────┘
                    ▼
┌─────────────────────────────────────────┐
│           rootDirHandle                 │
│     (存储在 IndexedDB obsidianSettings)  │
└───────────────────┬─────────────────────┘
                    ▼
┌─────────────────────────────────────────┐
│         MadokaMemory 子文件夹           │
│         (自动创建，可配置)               │
└───────────────────┬─────────────────────┘
                    ▼
┌─────────────────────────────────────────┐
│      ${uid}.md 记忆文件                 │
│  ┌─────────────────────────────────┐   │
│  │ ---                             │   │
│  │ uid: ep-xxx                     │   │
│  │ created_at: "2024-01-01T00:00"  │   │
│  │ weight: 0.85                    │   │
│  │ pinned: true                    │   │
│  │ ---                             │   │
│  │ # 记忆                          │   │
│  │ 摘要内容...                     │   │
│  │ 对话内容...                     │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 7.2 Markdown生成

支持 YAML 和 JSON 两种 frontmatter 格式：

**YAML格式（默认）：**

```markdown
---
uid: ep-1234567890-abc
created_at: "2024-01-15T08:30:00.000Z"
updated_at: "2024-01-20T10:15:00.000Z"
weight: 0.85
pinned: true
sync_status: success
---
# 记忆
用户询问React性能优化方法

用户: 如何优化React组件性能？

助手: 可以使用useMemo、useCallback...

> 来源：某网页
> 备注：重要技术点
```

### 7.3 同步流程

```typescript
export async function writeEpisodeToObsidian(ep: Episode): Promise<void> {
  // 1. 获取子文件夹句柄
  const sub = await getSubDirHandle()
  if (!sub) return

  // 2. 获取设置
  const settings = await getObsidianSettings()
  const name = `${ep.uid}.md`

  // 3. 创建/获取文件句柄
  const file = await sub.getFileHandle(name, { create: true })

  // 4. 写入内容
  const w = await file.createWritable()
  await w.write(episodeToMarkdown(ep, settings.frontmatterFormat))
  await w.close()
}
```

---

## 8. 记忆解析 (memory-parse.ts)

### 8.1 LLM返回格式

LLM在回复末尾附加JSON代码块：

````markdown
这是正常的回复内容...

```json
{
  "memory": {
    "shouldPersist": true,
    "summary": "用户询问React性能优化",
    "topics": ["React", "性能优化", "前端"],
    "memoryType": "long",
    "personaSignals": ["前端开发"]
  }
}
```
````

### 8.2 解析实现

```typescript
const MEMORY_JSON_REG = 
  /```json\s*[\r\n]*(\{[\s\S]*?"memory"\s*:\s*\{[\s\S]*?\}\s*\})[\s\r\n]*```/i

export function parseMemoryBlockFromContent(content: string): ParseResult {
  const match = content.match(MEMORY_JSON_REG)
  if (!match) {
    return { contentWithoutMemory: content, memory: null }
  }

  const jsonStr = match[1]
  let memory: MemoryTagsFromLLM | null = null
  try {
    const obj = JSON.parse(jsonStr)
    if (obj && typeof obj.memory === 'object') {
      memory = {
        shouldPersist: Boolean(obj.memory.shouldPersist),
        summary: typeof obj.memory.summary === 'string' 
          ? obj.memory.summary : undefined,
        topics: Array.isArray(obj.memory.topics) 
          ? obj.memory.topics : undefined,
        memoryType: obj.memory.memoryType === 'long' ? 'long' : 'short',
        personaSignals: Array.isArray(obj.memory.personaSignals) 
          ? obj.memory.personaSignals : undefined,
      }
    }
  } catch {
    /* 解析失败忽略 */
  }

  // 剥离记忆JSON后的内容
  const contentWithoutMemory = content.slice(0, match.index).trimEnd()
  return { contentWithoutMemory, memory }
}
```

---

## 9. UI交互层 (MemoryOverview.tsx)

### 9.1 功能概览

MemoryOverview组件提供记忆管理界面：

| 功能 | 操作 |
|------|------|
| 浏览记忆 | 列表展示，显示摘要/内容预览、创建时间、权重 |
| 固定记忆 | 点击星标按钮切换pinned状态 |
| 删除记忆 | 点击删除按钮，确认后删除 |
| 执行清理 | 手动触发智能清理流程 |

### 9.2 状态流转

```
┌─────────────┐
│   加载中    │
│ (loading)   │
└──────┬──────┘
       ▼
┌─────────────┐
│  空状态     │◀────────────────┐
│ (无记忆)    │                 │
└──────┬──────┘                 │
       │ 有数据                 │
       ▼                        │
┌─────────────┐    删除全部     │
│  记忆列表   │─────────────────┘
│             │
└──────┬──────┘
       │
       ├── 固定/取消固定 ──▶ 更新UI + 后台同步
       │
       ├── 删除 ──────────▶ 确认弹窗 ▶ 删除 ▶ 刷新列表
       │
       └── 执行清理 ──────▶ 确认弹窗 ▶ 清理 ▶ 刷新列表
```

---

## 10. 完整数据流转图

### 10.1 记忆生命周期

```
┌─────────────────────────────────────────────────────────────────────┐
│                          记忆生命周期                                │
└─────────────────────────────────────────────────────────────────────┘

  对话发生
     │
     ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  LLM    │───▶│  解析记忆    │───▶│  创建Episode │───▶│  计算权重    │
│  回复   │    │  JSON标签    │    │             │    │             │
└─────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                            │
                                                            ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 清理删除 │◀───│  权重衰减    │◀───│  访问更新    │◀───│  存入DB      │
│ (终态)  │    │  (时间流逝)  │    │  (被召回)    │    │             │
└─────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                            │
                              ┌─────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Obsidian同步   │
                    │  (可选)         │
                    └─────────────────┘
```

### 10.2 清理决策流程

```
                    ┌─────────────┐
                    │   开始清理   │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  是否固定？  │
                    └──────┬──────┘
                      是 /    \ 否
                        /      \
                       ▼        ▼
                ┌─────────┐  ┌─────────────┐
                │  保留   │  │ 创建<30天？  │
                └─────────┘  └──────┬──────┘
                               是 /    \ 否
                                 /      \
                                ▼        ▼
                         ┌─────────┐  ┌─────────────┐
                         │  保留   │  │ 访问<30天？  │
                         └─────────┘  └──────┬──────┘
                                        是 /    \ 否
                                          /      \
                                         ▼        ▼
                                  ┌─────────┐  ┌─────────────┐
                                  │  保留   │  │ 权重>=0.6？  │
                                  └─────────┘  └──────┬──────┘
                                                 是 /    \ 否
                                                   /      \
                                                  ▼        ▼
                                           ┌─────────┐  ┌─────────────┐
                                           │  保留   │  │ 创建>90天？  │
                                           └─────────┘  └──────┬──────┘
                                                          是 /    \ 否
                                                            /      \
                                                           ▼        ▼
                                                    ┌─────────┐  ┌─────────┐
                                                    │权重<0.4？│  │  保留   │
                                                    └────┬────┘  └─────────┘
                                                   是 /    \ 否
                                                     /      \
                                                    ▼        ▼
                                             ┌─────────┐  ┌─────────┐
                                             │  删除   │  │  保留   │
                                             └─────────┘  └─────────┘
```

---

## 11. 关键设计决策

### 11.1 纯本地存储

**决策：** 所有记忆数据仅存储在浏览器 IndexedDB，不上传服务器。

**理由：**
- 隐私保护：敏感对话数据不离本地
- 离线可用：无需网络即可访问历史
- 成本优势：无服务器存储成本

**权衡：**
- 无法跨设备同步（除非通过Obsidian等外部工具）
- 浏览器数据清除会丢失记忆

### 11.2 权重驱动的智能管理

**决策：** 使用算法权重替代简单的FIFO/LRU清理策略。

**理由：**
- 重要记忆（长期、固定）得到保护
- 自动识别"有价值"的记忆
- 可配置的阈值适应不同用户需求

**核心算法：**
```
weight = 0.5 + 0.5 * exp(-0.02 * 创建天数) * exp(-0.05 * 访问天数)
```

### 11.3 Obsidian集成设计

**决策：** 通过 File System Access API 直接写入本地文件系统。

**理由：**
- 双向同步：删除记忆时同步删除文件
- 开放格式：Markdown + YAML frontmatter
- 用户可控：用户选择目标文件夹

**限制：**
- 需要用户手动授权文件夹访问
- 浏览器支持限制（Chrome/Edge）

---

## 12. 文件索引

| 文件路径 | 职责 |
|----------|------|
| `src/shared/memory-types.ts` | 类型定义和默认配置 |
| `src/shared/memory-parse.ts` | LLM记忆JSON解析 |
| `src/shared/memory-db-constants.ts` | 数据库常量 |
| `src/background/memoryDb.ts` | IndexedDB封装 |
| `src/background/memoryScoring.ts` | 权重计算 |
| `src/background/memoryWorker.ts` | 核心业务逻辑 |
| `src/background/cleanupEngine.ts` | 智能清理 |
| `src/background/obsidianSync.ts` | Obsidian同步 |
| `src/sidepanel/components/MemoryOverview.tsx` | 记忆管理UI |

---

## 13. 总结

Madoka的记忆系统是一个设计精巧的本地优先解决方案：

1. **数据模型**：Episode作为核心单元，包含丰富的元数据支持智能管理
2. **存储层**：IndexedDB提供可靠的本地持久化，多索引支持高效查询
3. **权重机制**：双指数衰减算法平衡时效性和重要性
4. **清理策略**：保留优先、分级清理，确保重要记忆不丢失
5. **外部集成**：Obsidian同步将封闭数据转化为开放的Markdown知识库

整个系统体现了**隐私优先、智能管理、开放集成**的设计理念。
