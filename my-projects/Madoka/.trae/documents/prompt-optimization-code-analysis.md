# 提示词优化功能代码分析报告

## 功能概述

提示词优化功能允许用户将简单的输入转换为结构化的专业提示词，使用 CO-STAR 框架（Context, Objective, Style, Tone, Audience, Response）。

## 相关代码文件清单

### 1. 数据层

| 文件 | 说明 |
|------|------|
| [src/shared/prompt-templates.ts](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/shared/prompt-templates.ts) | 模板类型定义、内置模板 |

**关键内容：**
- `PromptTemplate` 接口定义
- `DEFAULT_EXPERT_TEMPLATE` - Expert Prompt Architect 模板
- `SIMPLE_OPTIMIZER_TEMPLATE` - 简洁优化模板
- `BUILTIN_TEMPLATES` - 内置模板数组
- `createTemplate()` - 创建新模板函数

### 2. 状态管理层

| 文件 | 说明 |
|------|------|
| [src/sidepanel/hooks/usePromptTemplates.ts](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/hooks/usePromptTemplates.ts) | 模板状态管理 Hook |

**关键功能：**
- 从 `chrome.storage.local` 加载/保存模板
- 合并内置模板和用户自定义模板
- CRUD 操作：`addTemplate`, `updateTemplate`, `deleteTemplate`, `setDefaultTemplate`
- `activeTemplate` - 当前激活的模板

### 3. UI 层

| 文件 | 说明 |
|------|------|
| [src/sidepanel/components/composer/Composer.tsx](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/components/composer/Composer.tsx) | 优化按钮、调用逻辑 |
| [src/sidepanel/components/composer/PromptTemplateManager.tsx](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/components/composer/PromptTemplateManager.tsx) | 模板管理界面 |

**Composer.tsx 关键代码：**
- 第 12 行：`import { usePromptTemplates } from '../../hooks/usePromptTemplates'`
- 第 42-50 行：使用 Hook 获取模板相关方法
- 第 58 行：`const [isOptimizing, setIsOptimizing] = useState(false)` - 优化状态
- 第 270-301 行：`handleOptimizePrompt` - 优化处理函数
- 第 507-520 行：优化按钮 JSX

### 4. 后端处理层

| 文件 | 说明 |
|------|------|
| [src/background/index.ts:432-455](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/index.ts#L432-L455) | 处理 `optimizePrompt` 消息 |
| [src/background/api.ts:486-571](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/api.ts#L486-L571) | API 调用实现 |

**background/index.ts 关键代码：**
```typescript
if (request.action === "optimizePrompt") {
  const userInput = request.input as string;
  const systemPrompt = request.systemPrompt as string | undefined;
  const optimizedPrompt = await callTongyiAPIForOptimize(userInput, systemPrompt);
  sendResponse({ success: true, data: optimizedPrompt });
}
```

**background/api.ts 关键内容：**
- `PROMPT_OPTIMIZER_SYSTEM` - 默认系统提示词（第 486-524 行）
- `callTongyiAPIForOptimize()` - 调用通义千问 API（第 531-571 行）

## 数据流

```
用户输入 → 点击优化按钮
    ↓
Composer.tsx: handleOptimizePrompt()
    ↓
sendToBackground({ action: 'optimizePrompt', input, systemPrompt })
    ↓
background/index.ts: 处理消息
    ↓
api.ts: callTongyiAPIForOptimize()
    ↓
通义千问 API (非流式)
    ↓
提取 markdown 代码块内容
    ↓
返回优化后的提示词
    ↓
Composer.tsx: setInput(response.data)
```

## 存储结构

模板存储在 `chrome.storage.local`，键名为 `madokaPromptTemplates`：

```typescript
interface PromptTemplate {
  id: string           // 唯一标识
  name: string         // 模板名称
  content: string      // 模板内容（系统提示词）
  isDefault: boolean   // 是否为默认模板
  isBuiltIn: boolean   // 是否为内置模板
  createdAt: number    // 创建时间
  updatedAt: number    // 更新时间
}
```

## 内置模板

### 1. Expert Prompt Architect
- ID: `builtin-expert-architect`
- 使用 CO-STAR 框架
- 输出结构化的 Markdown 提示词

### 2. Simple Optimizer
- ID: `builtin-simple-optimizer`
- 简洁的优化模板
- 输出改进后的提示词

## UI 组件

### 模板选择器
- 位置：Composer 底部工具栏
- 功能：快速切换模板、打开管理界面

### 模板管理器 (PromptTemplateManager)
- 全屏模态框
- 功能：创建、编辑、删除、复制模板
- 自动保存（500ms 防抖）

## 代码位置速查表

| 功能 | 文件 | 行号 |
|------|------|------|
| 模板类型定义 | prompt-templates.ts | 7-15 |
| 内置模板 | prompt-templates.ts | 21-97 |
| 模板 Hook | usePromptTemplates.ts | 31-179 |
| 优化按钮 | Composer.tsx | 507-520 |
| 优化处理函数 | Composer.tsx | 270-301 |
| 消息处理 | background/index.ts | 432-455 |
| API 调用 | api.ts | 531-571 |
| 默认系统提示词 | api.ts | 486-524 |
| 模板管理器 | PromptTemplateManager.tsx | 全文 |
