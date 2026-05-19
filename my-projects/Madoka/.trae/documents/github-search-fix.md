# GitHub 按钮交互方案修正计划

## 当前问题

当前实现中，点击 GitHub 按钮后会：
1. 切换 `forceGitHubSearch` 状态
2. **立即自动触发搜索**（如果输入框不为空）

## 用户期望的正确行为

点击 GitHub 按钮应该：
1. **只切换 toggle 状态**
2. **不自动触发搜索**
3. 等待用户点击发送按钮后才发送消息并执行搜索

## 修改方案

### 步骤 1: 修改 GitHub 按钮的 onClick 处理逻辑

**位置**: `Composer.tsx` 第 579-600 行

**当前代码**:
```tsx
onClick={async () => {
  const willEnable = !state.forceGitHubSearch;
  dispatch({
    type: "SET_FORCE_GITHUB_SEARCH",
    payload: willEnable,
  });
  
  // 如果启用 GitHub 搜索且输入框不为空，立即触发搜索
  if (willEnable && input.trim()) {
    const newInput = `/github ${input.trim()}`;
    setInput(newInput);
    setTimeout(() => {
      handleSend();
    }, 0);
  } else if (willEnable && !input.trim()) {
    showToast("请输入项目描述，例如：Python 异步 Web 框架", "info");
  }
  
  textareaRef.current?.focus();
}}
```

**修改为**:
```tsx
onClick={() => {
  dispatch({
    type: "SET_FORCE_GITHUB_SEARCH",
    payload: !state.forceGitHubSearch,
  });
  textareaRef.current?.focus();
}}
```

### 步骤 2: 保持 handleSend 函数的逻辑

`handleSend` 函数已经正确实现了检测 `forceGitHubSearch` 并添加 `/github` 前缀的逻辑：

```tsx
// 如果启用了 GitHub 搜索，自动添加 /github 前缀
const finalInput = state.forceGitHubSearch && input.trim()
  ? `/github ${input.trim()}`
  : input.trim();
```

这部分逻辑**保持不变**。

### 步骤 3: 移除不必要的提示

由于不再自动触发搜索，当输入框为空时点击 GitHub 按钮也不需要显示提示，因为用户可能只是想先启用这个功能，稍后再输入内容。

## 修改后的用户交互流程

### 场景 1: 启用 GitHub 搜索并发送消息
1. 用户输入："Python 异步 Web 框架"
2. 用户点击 GitHub 按钮 → toggle 状态变为 `active`
3. 用户点击发送按钮 → 自动添加 `/github` 前缀并执行搜索

### 场景 2: 仅启用 GitHub 搜索（暂不发送）
1. 用户输入："Python 异步 Web 框架"
2. 用户点击 GitHub 按钮 → toggle 状态变为 `active`
3. 用户可以继续编辑输入内容
4. 用户点击发送按钮 → 执行 GitHub 搜索

### 场景 3: 禁用 GitHub 搜索
1. 用户已启用 GitHub 搜索
2. 用户再次点击 GitHub 按钮 → toggle 状态变为 `inactive`
3. 用户点击发送按钮 → 执行普通对话（不搜索）

### 场景 4: 切换搜索模式
1. 用户已启用 GitHub 搜索
2. 用户点击联网搜索按钮 → GitHub 搜索自动禁用，联网搜索启用
3. 用户点击发送按钮 → 执行联网搜索

## 修改文件清单

1. **Composer.tsx**
   - 简化 GitHub 按钮的 `onClick` 处理逻辑
   - 移除自动触发搜索的代码
   - 移除不必要的 toast 提示

## 预期效果

- GitHub 按钮作为**功能开关**，而不是**触发按钮**
- 用户有完全的控制权，可以决定何时发送
- 与联网搜索按钮的行为保持一致
- 符合用户的直觉操作习惯

## 技术说明

### 为什么这样设计更合理？

1. **一致性**: 与联网搜索按钮行为一致（只切换状态，不自动发送）
2. **可控性**: 用户可以预览输入内容，确认后再发送
3. **灵活性**: 用户可以先启用功能，再编辑内容，最后发送
4. **容错性**: 避免误触导致不必要的 API 调用

### 已有的正确逻辑

`handleSend` 函数中的检测逻辑已经正确实现：
```tsx
const finalInput = state.forceGitHubSearch && input.trim()
  ? `/github ${input.trim()}`
  : input.trim();
```

这确保了：
- 只有当 `forceGitHubSearch` 为 `true` 时才添加前缀
- 只有当输入不为空时才添加前缀
- 发送时自动处理，用户无需手动输入 `/github`
