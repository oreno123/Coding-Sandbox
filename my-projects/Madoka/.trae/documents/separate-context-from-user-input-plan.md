# 分离文件引用与用户输入 - 计划文档

## 问题分析

当前实现的问题：
1. 用户输入 `@` 选择文件后，引用内容被拼接到用户输入中一起发送
2. 这导致：
   - 用户输入框显示混乱（有 `@` 符号残留）
   - AI 看到的消息格式混杂，影响理解
   - 引用内容和用户查询混在一起

## 参考：通义千问的实现方式

从通义千问的 API 请求可以看到：

```json
{
  "messages": [
    {
      "mime_type": "doc/url",
      "content": "",
      "meta_data": {
        "resource_infos": [{
          "file_name": "代码冲突.docx",
          "file_format": "DOCX",
          "file_size": 21861,
          "id": "...",
          "url": "https://..."
        }]
      }
    },
    {
      "content": "理解一下",
      "mime_type": "text/plain",
      "meta_data": {
        "ori_query": "理解一下"
      }
    }
  ]
}
```

**关键设计**：
1. 文件引用作为独立的消息项，使用 `mime_type: "doc/url"` 标识
2. 用户输入作为另一条消息，`mime_type: "text/plain"`
3. 文件元数据（文件名、格式、大小、URL）放在 `meta_data.resource_infos` 中
4. 内容可以为空，由后端根据 URL 获取

## 优化方案

### 方案：模仿通义千问的消息结构

将引用内容作为独立的消息项，与用户输入分离：

```typescript
// 构建消息数组
const messages = [];

// 1. 添加文件引用消息（如果有）
if (attachedContext.refs.length > 0) {
  const resourceInfos = attachedContext.refs.map(ref => ({
    file_name: ref.title,
    file_format: 'HTML', // 或根据内容类型判断
    url: ref.url,
    id: ref.id,
    // 已解析的内容
    content: attachedContext.resolvedContent[ref.id] || ''
  }));
  
  messages.push({
    role: 'user',
    mime_type: 'context/reference',
    meta_data: {
      resource_infos: resourceInfos
    }
  });
}

// 2. 添加用户输入消息
messages.push({
  role: 'user',
  content: userInput,
  mime_type: 'text/plain'
});

// 发送消息
sendMessages(messages, images);
```

## 实施步骤

### 步骤 1: 修改消息构建逻辑

**文件**: `src/sidepanel/components/composer/Composer.tsx`

修改 `handleSend` 函数：

```typescript
const handleSend = useCallback(async () => {
  if ((!input.trim() && attachedImages.length === 0) || isResponding) return;

  const userInput = input.trim() || "请描述或分析这张截图中的内容。";
  
  // 构建消息数组（模仿通义千问的结构）
  const messages: MessageItem[] = [];
  
  // 1. 添加上下文引用消息（如果有）
  if (attachedContext.refs.length > 0) {
    const resourceInfos = attachedContext.refs.map(ref => {
      const content = attachedContext.resolvedContent[ref.id];
      return {
        file_name: ref.title,
        file_format: getFileFormat(ref.type),
        url: ref.url,
        id: ref.id,
        content: content || '',
        type: ref.type
      };
    });
    
    messages.push({
      role: 'user',
      mime_type: 'context/reference',
      meta_data: { resource_infos: resourceInfos }
    });
  }
  
  // 2. 添加用户输入消息
  messages.push({
    role: 'user',
    content: userInput,
    mime_type: 'text/plain'
  });

  // 发送消息
  sendMessages(messages, attachedImages.length > 0 ? attachedImages : undefined);

  setInput("");
  clearContextRefs();
  setAttachedImages([]);
  
  if (textareaRef.current) {
    textareaRef.current.style.height = "auto";
  }
}, [...]);
```

### 步骤 2: 修改 useChat hook 支持消息数组

**文件**: `src/sidepanel/hooks/useChat.ts`

添加新的 `sendMessages` 函数或修改现有函数：

```typescript
const sendMessages = useCallback(async (
  messages: MessageItem[],
  images?: string[]
) => {
  // 将消息数组转换为后端可理解的格式
  // 或者保持原样发送到 background
  
  const response = await sendToBackground({
    action: 'sendMessages',
    messages,
    images
  });
  
  // ... 处理响应
}, []);
```

### 步骤 3: 修改 background 处理消息数组

**文件**: `src/background/index.ts`

添加对 `sendMessages` action 的处理：

```typescript
case 'sendMessages': {
  const { messages, images } = request;
  
  // 将消息数组转换为 AI 可理解的格式
  // 1. 提取上下文引用消息
  const contextRefs = messages.filter(m => m.mime_type === 'context/reference');
  const userMessage = messages.find(m => m.mime_type === 'text/plain');
  
  // 2. 构建系统提示词（包含上下文引用）
  let systemPrompt = activeTemplate.content;
  if (contextRefs.length > 0) {
    const contextContent = buildContextContent(contextRefs);
    systemPrompt += '\n\n' + contextContent;
  }
  
  // 3. 发送给 AI
  await sendToAI(userMessage.content, systemPrompt, images);
  break;
}
```

### 步骤 4: 构建上下文内容函数

```typescript
function buildContextContent(contextRefs: MessageItem[]): string {
  const parts = ['You have access to the following context references:'];
  
  for (const ref of contextRefs) {
    const infos = ref.meta_data?.resource_infos || [];
    for (const info of infos) {
      parts.push(`\n[${info.file_name}] (${info.url}):\n${info.content}`);
    }
  }
  
  return parts.join('\n');
}
```

### 步骤 5: 清理输入框的 @ 处理逻辑

**文件**: `src/sidepanel/components/composer/Composer.tsx`

简化 `handleSelectContext`，不再修改输入框内容：

```typescript
const handleSelectContext = useCallback((ref: AnyContextRef) => {
  const isAlreadyAdded = attachedContext.refs.some((r) => r.id === ref.id);

  if (isAlreadyAdded) {
    removeContextRef(ref.id);
  } else {
    addContextRef(ref);
    resolveContextRef(ref);
  }

  // 关闭 picker，不修改输入框
  setPickerOpen(false);
  setPickerQuery("");
  setAtPosition(null);

  textareaRef.current?.focus();
}, [...]);
```

## 消息格式对比

### 优化前
```
--- Context from: GitHub (https://github.com/...) ---
页面内容...

--- User Query ---
这个代码有什么问题？
```

### 优化后（模仿通义千问）

**消息数组**：
```json
[
  {
    "role": "user",
    "mime_type": "context/reference",
    "meta_data": {
      "resource_infos": [{
        "file_name": "GitHub",
        "file_format": "HTML",
        "url": "https://github.com/...",
        "id": "...",
        "content": "页面内容...",
        "type": "tab"
      }]
    }
  },
  {
    "role": "user",
    "content": "这个代码有什么问题？",
    "mime_type": "text/plain"
  }
]
```

**实际发送给 AI**：
```
System: ...原有系统提示词...

You have access to the following context references:

[GitHub] (https://github.com/...):
页面内容...

User: 这个代码有什么问题？
```

## 测试要点

1. 用户输入框只显示纯文本，无引用内容混入
2. 消息数组正确构建，包含上下文引用和用户输入
3. 系统提示词正确包含上下文引用
4. AI 能正确理解引用内容和用户查询的关系
5. 多个引用时格式正确
6. 无引用时只发送用户输入

## 优势

1. **结构清晰**: 模仿通义千问的消息结构，业界认可
2. **用户输入纯净**: 输入框只显示用户输入的内容
3. **AI 理解更好**: 上下文引用作为独立消息项，结构清晰
4. **可扩展性**: 支持多种 mime_type，未来可扩展图片、PDF 等
5. **元数据丰富**: 文件名、格式、URL 等信息完整
