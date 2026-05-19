# 修复 GitHub 搜索按钮功能 - 计划文档

## 问题分析

GitHub 搜索按钮点击后没有反应，原因是：

1. 点击 GitHub 按钮会设置 `state.forceGitHubSearch = true`（Composer.tsx 第 567-571 行）
2. 但现在的消息发送使用的是 `sendMessages` 函数（useChat.ts 第 119-179 行）
3. `sendMessages` 函数**没有处理 GitHub 搜索逻辑**
4. 只有旧的 `sendMessage` 函数（第 26-117 行）有 GitHub 搜索处理

## 代码对比

**sendMessage（有 GitHub 处理）**：
```typescript
const sendMessage = useCallback(async (content: string, images?: string[]) => {
  // ...
  const githubMatch = trimmed.match(GITHUB_CMD_PREFIX);
  const isGitHubSearch = state.forceGitHubSearch || !!githubMatch;
  
  if (isGitHubSearch) {
    // 处理 GitHub 搜索
    const res = await sendGitHubSearch(userQuery);
    // ...
    return; // 提前返回，不走普通聊天流程
  }
  // ... 普通聊天流程
}, []);
```

**sendMessages（缺少 GitHub 处理）**：
```typescript
const sendMessages = useCallback(async (messages: MessageItem[], images?: string[]) => {
  // 直接走普通聊天流程，没有检查 forceGitHubSearch
  // ...
  chrome.runtime.sendMessage({ action: "sendMessages", ... });
}, []);
```

## 解决方案

在 `sendMessages` 函数中添加 GitHub 搜索逻辑：

1. 检查 `state.forceGitHubSearch` 状态
2. 如果为 true，提取用户查询并执行 GitHub 搜索
3. 搜索完成后重置 `forceGitHubSearch` 状态

## 实施步骤

### 步骤 1: 修改 useChat.ts 的 sendMessages 函数

**文件**: `src/sidepanel/hooks/useChat.ts`

在 `sendMessages` 函数开头添加 GitHub 搜索处理：

```typescript
const sendMessages = useCallback(
  async (messages: MessageItem[], images?: string[], resourceInfos?: ResourceInfo[]) => {
    if ((!messages.length && !images?.length) || state.isResponding) return;

    // 提取用户输入消息
    const userMessage = messages.find(m => m.mime_type === "text/plain");
    const userContent = userMessage?.content || "";

    // ===== GitHub 搜索处理 =====
    if (state.forceGitHubSearch) {
      const trimmed = userContent.trim();
      const githubMatch = trimmed.match(GITHUB_CMD_PREFIX);
      const isGitHubSearch = state.forceGitHubSearch || !!githubMatch;
      
      if (isGitHubSearch) {
        const userQuery = githubMatch 
          ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim() 
          : trimmed;
        
        // 显示纯净内容（不含前缀）
        const displayContent = githubMatch 
          ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim()
          : trimmed;
        
        addMessage({ role: "user", content: displayContent, images });
        dispatch({ type: "SET_STATUS", payload: "responding" });
        startResponse();
        
        if (!userQuery) {
          finishResponse("请输入要搜索的项目描述，例如：Python 异步 Web 框架");
          dispatch({ type: "SET_FORCE_GITHUB_SEARCH", payload: false });
          return;
        }
        
        try {
          const res = await sendGitHubSearch(userQuery);
          if (res.success && res.items?.length) {
            finishResponse(`找到以下项目（搜索串: ${res.query}）：`, res.items);
          } else {
            finishResponse(
              res.error ? `搜索失败: ${res.error}` : "未找到相关项目",
            );
          }
        } catch (e) {
          finishResponse(`请求失败：${(e as Error).message}`);
        }
        
        // 搜索完成后重置标志
        dispatch({ type: "SET_FORCE_GITHUB_SEARCH", payload: false });
        return; // 提前返回，不走普通聊天流程
      }
    }
    // ===== GitHub 搜索处理结束 =====

    const forceSearch = state.forceSearch;

    // 添加用户消息到对话历史
    addMessage({ role: "user", content: userContent, images, resource_infos: resourceInfos });

    dispatch({ type: "SET_STATUS", payload: "responding" });
    startResponse();

    // ... 其余代码保持不变
  },
  [...]
);
```

### 步骤 2: 确保依赖项完整

确保 `sendMessages` 的依赖数组包含：
- `state`（包含 forceGitHubSearch）
- `addMessage`
- `startResponse`
- `finishResponse`
- `dispatch`
- `mode`
- `pageContent`

## 测试要点

1. 点击 GitHub 按钮，按钮变为激活状态
2. 输入查询内容并发送
3. 正确执行 GitHub 搜索
4. 显示搜索结果（GitHub 项目卡片）
5. 搜索完成后 GitHub 按钮恢复非激活状态
6. 普通聊天功能不受影响
