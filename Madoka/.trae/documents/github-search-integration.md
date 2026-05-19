# GitHub 按钮点击后触发项目搜索功能的实现计划

## 当前状态分析

### 已有功能
1. **GitHub 搜索按钮已存在**：在 Composer 工具栏中有一个 GitHub 按钮（第 572-592 行）
2. **Toggle 状态管理**：点击按钮会切换 `state.forceGitHubSearch` 状态
3. **命令触发方式**：已支持通过 `/github`、`/find`、`/找项目` 命令触发搜索
4. **后端搜索逻辑**：`handleGitHubSearch` 函数已实现完整的搜索流程
   - LLM 生成搜索串 → GitHub API → 重排 → 返回 Top N
5. **长连接通信**：使用 `chrome.runtime.connect` 建立长连接 Port 调用搜索

### 当前问题
**点击 GitHub 按钮后只是切换了 toggle 状态，没有实际触发搜索功能**

现有逻辑：
```tsx
onClick={() => {
  dispatch({
    type: "SET_FORCE_GITHUB_SEARCH",
    payload: !state.forceGitHubSearch,
  });
  textareaRef.current?.focus();
}}
```

这只设置了标志位，但没有：
- 自动获取输入框内容
- 调用 GitHub 搜索 API
- 显示搜索结果

## 实现方案

### 方案设计原则
1. **保持用户体验一致**：与联网搜索按钮类似的交互逻辑
2. **复用现有代码**：利用已有的 `sendGitHubSearch` 和 `handleGitHubSearch`
3. **智能触发**：根据输入框内容决定是否立即搜索

### 具体实现步骤

#### 步骤 1: 修改 Composer 中的 GitHub 按钮点击处理逻辑

**位置**：`Composer.tsx` 第 574-579 行

**当前代码**：
```tsx
onClick={() => {
  dispatch({
    type: "SET_FORCE_GITHUB_SEARCH",
    payload: !state.forceGitHubSearch,
  });
  textareaRef.current?.focus();
}}
```

**修改为**：
```tsx
onClick={async () => {
  const willEnable = !state.forceGitHubSearch;
  dispatch({
    type: "SET_FORCE_GITHUB_SEARCH",
    payload: willEnable,
  });
  
  // 如果启用 GitHub 搜索且输入框不为空，立即触发搜索
  if (willEnable && input.trim()) {
    // 在输入内容前添加 /github 前缀来触发搜索
    const newInput = `/github ${input.trim()}`;
    setInput(newInput);
    // 自动发送消息（复用 handleSend）
    // 或者直接调用 sendMessage
  }
  
  textareaRef.current?.focus();
}}
```

#### 步骤 2: 在 handleSend 中检测 forceGitHubSearch 标志

**位置**：`Composer.tsx` 中的 `handleSend` 函数

**需要添加的逻辑**：
```tsx
const handleSend = useCallback(async () => {
  if ((!input.trim() && attachedImages.length === 0) || isResponding) return;

  // 如果启用了 GitHub 搜索，添加 /github 前缀
  const finalInput = state.forceGitHubSearch 
    ? `/github ${input.trim()}`
    : input.trim();

  // ... 后续的 sendMessage 调用使用 finalInput
}, [input, isResponding, attachedImages, sendMessage, clearContextRefs, state.forceGitHubSearch]);
```

#### 步骤 3: 优化 useChat 中的 GitHub 搜索逻辑

**位置**：`useChat.ts` 的 `sendMessage` 函数

**当前逻辑**（第 30-57 行）：
- 已经通过 `GITHUB_CMD_PREFIX` 检测 `/github` 前缀
- 已经调用 `sendGitHubSearch` 执行搜索
- 已经处理搜索结果并显示

**需要确认**：
- 确保搜索结果显示格式友好
- 确保错误处理完善

#### 步骤 4（可选）: 添加用户提示

当点击 GitHub 按钮时，如果输入框为空，可以显示提示：
```tsx
if (willEnable && !input.trim()) {
  showToast("请输入项目描述，例如：Python 异步 Web 框架", "info");
}
```

## 技术细节

### 数据流
1. **用户点击 GitHub 按钮** → 切换 `forceGitHubSearch` 状态
2. **用户发送消息** → `handleSend` 检测 `forceGitHubSearch`
3. **添加 `/github` 前缀** → 调用 `sendMessage`
4. **useChat 检测前缀** → 调用 `sendGitHubSearch`
5. **Background 处理搜索** → `handleGitHubSearch` 完整流程
6. **返回搜索结果** → 显示 GitHub 仓库卡片

### 互斥逻辑
已在 `ChatContext.tsx` 中实现：
- `SET_FORCE_SEARCH` 会清除 `forceGitHubSearch`
- `SET_FORCE_GITHUB_SEARCH` 会清除 `forceSearch`

确保两个搜索模式不会同时激活。

## 测试场景

### 场景 1: 有输入内容时点击按钮
1. 输入框输入："Python Web 框架"
2. 点击 GitHub 按钮
3. 预期：自动触发搜索，显示相关 GitHub 项目

### 场景 2: 无输入内容时点击按钮
1. 输入框为空
2. 点击 GitHub 按钮
3. 预期：仅切换 toggle 状态，等待用户输入后发送

### 场景 3: 切换搜索模式
1. 已启用 GitHub 搜索
2. 点击联网搜索按钮
3. 预期：GitHub 搜索自动关闭，切换到联网搜索

### 场景 4: 命令方式触发
1. 输入："/github Python 异步框架"
2. 发送
3. 预期：执行 GitHub 搜索，显示结果

## 文件修改清单

1. **Composer.tsx**
   - 修改 GitHub 按钮的 `onClick` 处理逻辑
   - 修改 `handleSend` 函数检测 `forceGitHubSearch`

2. **useChat.ts**（可能不需要修改）
   - 确认 GitHub 搜索逻辑已完善

3. **ChatContext.tsx**（不需要修改）
   - 互斥逻辑已实现

## 预期效果

用户操作流程：
1. 在输入框输入项目描述（如："Python 异步 Web 框架"）
2. 点击 GitHub 按钮（或直接发送）
3. 助手显示搜索到的 GitHub 项目卡片列表
4. 点击卡片可跳转至项目页面

搜索结果显示格式：
- 仓库名称（带链接）
- 仓库描述
- Star 数
- 编程语言
- 最后更新时间

## 备注

### 现有代码的完整性
- ✅ `sendGitHubSearch` 函数已实现（`messaging.ts`）
- ✅ `handleGitHubSearch` 函数已实现（`githubSearch.ts`）
- ✅ Background Port 监听已设置（`index.ts`）
- ✅ 命令前缀检测已实现（`useChat.ts`）
- ✅ Toggle 状态管理已实现（`ChatContext.tsx`）
- ⚠️ **缺少**：按钮点击后自动触发搜索的逻辑

### 需要补充的环节
只需要将"按钮点击"与"搜索执行"连接起来即可，核心搜索逻辑完全复用现有代码。
