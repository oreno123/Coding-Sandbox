# 优化 GitHub 搜索消息显示方案

## 问题分析

### 当前实现流程

1. **Composer.tsx** - `handleSend` 函数：
   ```tsx
   const finalInput = state.forceGitHubSearch && input.trim()
     ? `/github ${input.trim()}`
     : input.trim();
   ```
   添加 `/github` 前缀

2. **useChat.ts** - `sendMessage` 函数：
   ```tsx
   const githubMatch = trimmed.match(GITHUB_CMD_PREFIX);
   const isGitHubSearch = !!githubMatch;
   const userQuery = isGitHubSearch
     ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim()
     : "";
   
   // 显示消息时包含完整内容（含 /github 前缀）
   addMessage({ role: "user", content });
   ```

### 问题

用户看到的消息内容包含 `/github` 前缀，影响观感：
```
用户：/github Python 异步 Web 框架
助手：找到以下项目...
```

### 期望效果

用户看到的消息应该干净整洁：
```
用户：Python 异步 Web 框架
助手：找到以下项目...
```

## 解决方案

### 核心思路

在 `useChat.ts` 的 `sendMessage` 函数中：
- **内部处理**：使用去除前缀后的纯净搜索内容
- **消息显示**：也使用纯净内容，不显示 `/github` 前缀
- **功能逻辑**：通过 `forceGitHubSearch` 状态控制，而不是依赖消息内容中的前缀

### 具体修改步骤

#### 步骤 1: 修改 Composer.tsx - 不添加前缀

**位置**: `Composer.tsx` 第 289-292 行

**当前代码**:
```tsx
// 如果启用了 GitHub 搜索，自动添加 /github 前缀
const finalInput = state.forceGitHubSearch && input.trim()
  ? `/github ${input.trim()}`
  : input.trim();
```

**修改为**:
```tsx
// 如果启用了 GitHub 搜索，使用纯净输入内容（不添加前缀）
const finalInput = input.trim();
```

#### 步骤 2: 修改 useChat.ts - 通过状态判断是否执行 GitHub 搜索

**位置**: `useChat.ts` 第 25-57 行

**当前逻辑**:
```tsx
const trimmed = content.trim();
const githubMatch = trimmed.match(GITHUB_CMD_PREFIX);
const isGitHubSearch = !!githubMatch;
const userQuery = isGitHubSearch
  ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim()
  : "";

// GitHub 找项目
if (isGitHubSearch) {
  addMessage({ role: "user", content }); // 显示包含前缀的内容
  // ...
  const res = await sendGitHubSearch(userQuery);
  // ...
}
```

**修改为**:
```tsx
const trimmed = content.trim();
// 通过 state.forceGitHubSearch 判断是否执行 GitHub 搜索
const isGitHubSearch = state.forceGitHubSearch;
const userQuery = trimmed; // 直接使用纯净内容

// GitHub 找项目
if (isGitHubSearch) {
  // 显示纯净内容（不含前缀）
  addMessage({ role: "user", content: trimmed, images });
  dispatch({ type: "SET_STATUS", payload: "responding" });
  startResponse();
  if (!userQuery) {
    finishResponse("请输入要搜索的项目描述，例如：Python 异步 Web 框架");
    return;
  }
  try {
    const res = await sendGitHubSearch(userQuery);
    if (res.success && res.items?.length) {
      finishResponse(`找到以下项目（搜索串：${res.query}）：`, res.items);
    } else {
      finishResponse(
        res.error ? `搜索失败：${res.error}` : "未找到相关项目",
      );
    }
  } catch (e) {
    finishResponse(`请求失败：${(e as Error).message}`);
  }
  // 搜索完成后重置标志
  dispatch({ type: "SET_FORCE_GITHUB_SEARCH", payload: false });
  return;
}
```

#### 步骤 3: 保留命令触发方式（可选）

如果用户手动输入 `/github` 命令，也应该支持。修改检测逻辑：

```tsx
const githubMatch = trimmed.match(GITHUB_CMD_PREFIX);
const isGitHubSearch = state.forceGitHubSearch || !!githubMatch;
const userQuery = isGitHubSearch
  ? (githubMatch ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim() : trimmed)
  : "";
```

这样可以同时支持两种方式：
1. 点击 GitHub 按钮 + 发送（通过状态判断）
2. 手动输入 `/github` 命令（通过前缀判断）

#### 步骤 4: 修改消息显示逻辑

**位置**: `useChat.ts` 第 38 行

**当前代码**:
```tsx
addMessage({ role: "user", content });
```

**修改为**:
```tsx
// 显示纯净内容（去除可能的前缀）
const displayContent = githubMatch 
  ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim()
  : content;
addMessage({ role: "user", content: displayContent, images });
```

## 修改文件清单

1. **Composer.tsx**
   - 修改 `handleSend` 函数，不添加 `/github` 前缀
   - 使用纯净的 `input.trim()`

2. **useChat.ts**
   - 修改 `sendMessage` 函数，通过 `state.forceGitHubSearch` 判断是否执行搜索
   - 修改消息显示逻辑，显示纯净内容
   - 搜索完成后重置 `forceGitHubSearch` 标志
   - 保留命令触发方式的支持

## 预期效果

### 场景 1: 使用 GitHub 按钮
1. 用户输入："Python 异步 Web 框架"
2. 点击 GitHub 按钮（启用状态）
3. 点击发送按钮

**显示效果**:
```
用户：Python 异步 Web 框架
助手：找到以下项目（搜索串：Python async web framework）：
  [GitHub 项目卡片列表]
```

### 场景 2: 使用命令方式
1. 用户输入："/github Python 异步 Web 框架"
2. 点击发送

**显示效果**:
```
用户：Python 异步 Web 框架
助手：找到以下项目（搜索串：Python async web framework）：
  [GitHub 项目卡片列表]
```

### 场景 3: 普通对话
1. 用户输入："你好"
2. 未启用 GitHub 搜索
3. 点击发送

**显示效果**:
```
用户：你好
助手：你好！有什么我可以帮助你的吗？
```

## 技术优势

1. **用户体验优化**: 消息内容干净整洁，无命令前缀
2. **功能分离**: 通过状态管理控制功能，而不是依赖消息内容
3. **向后兼容**: 保留命令触发方式，两种方式使用体验一致
4. **代码清晰**: 逻辑更直观，易于维护

## 注意事项

1. **搜索完成后重置标志**: 确保下次发送不会误触发 GitHub 搜索
2. **命令方式仍然有效**: 保留 `/github` 命令的支持
3. **截图功能**: 确保 GitHub 搜索不支持截图的逻辑仍然正确
