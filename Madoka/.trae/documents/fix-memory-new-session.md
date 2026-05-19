# 修复新会话无法读取记忆的问题

## 问题分析

**用户反馈**：在一个会话中告诉 Madoka 名字，记忆管理中有记录，但新开会话后 Madoka 不知道名字。

**根本原因**：

1. **记忆上下文只在选择板块时构建**（background/index.ts 第814行）
   ```typescript
   if (request.selectedBlocks && request.selectedBlocks.length > 0) {
     // 只有选择了板块才会查询记忆
   }
   ```

2. **新会话默认没有选中任何板块**
   - `selectedBlocks` 默认为空数组
   - 导致 `memoryContext` 为空
   - LLM 无法获取之前的记忆

3. **用户画像虽然被查询，但逻辑在板块选择内部**
   - 没有选中板块时，根本不会查询用户画像

## 解决方案

### 方案1：自动携带用户画像（最小改动，推荐）

无论是否选择板块，都自动查询并携带用户画像。

**修改位置**：`src/background/index.ts`

**修改内容**：
1. 将用户画像查询移到板块选择条件外部
2. 确保每个对话都携带用户画像

### 方案2：默认携带最近记忆

新会话自动携带最近的几条重要记忆（如最近5条），无需用户选择板块。

**修改位置**：`src/background/index.ts`

**修改内容**：
1. 如果没有选择板块，默认查询最近的记忆
2. 限制数量，避免 token 过多

### 方案3：智能推荐板块

根据用户输入内容，自动匹配相关板块的记忆。

**修改位置**：`src/background/index.ts`

**修改内容**：
1. 分析用户输入关键词
2. 自动匹配相关板块
3. 携带匹配板块的记忆

## 建议实施方案

**采用方案1 + 方案2 的组合**：

1. **始终携带用户画像**（方案1）
   - 用户画像包含姓名、身份等核心信息
   - 每个对话都应该知道用户是谁

2. **默认携带最近3条记忆**（方案2）
   - 新会话自动携带最近的记忆
   - 让用户感觉 Madoka "记得" 之前的事
   - 用户选择板块后，再携带选中板块的更多记忆

## 具体修改步骤

### 步骤1：修改记忆上下文构建逻辑

文件：`src/background/index.ts`

将用户画像查询移到板块选择外部：
```typescript
// 始终查询用户画像
let memoryContext = ''
try {
  const profileRes = await memoryGetUserProfile()
  if (profileRes.profile) {
    // ...格式化用户画像
    memoryContext = '- 用户画像: ' + profileItems.slice(0, 5).join('；')
  }
} catch (e) {
  console.warn('[Madoka BG] Failed to load user profile:', e)
}

// 如果选择了板块，再添加板块相关的记忆
if (request.selectedBlocks && request.selectedBlocks.length > 0) {
  // ...查询选中板块的记忆
  memoryContext += '\n' + episodes.map(...).join('\n')
} else {
  // 没有选择板块时，默认携带最近3条记忆
  const recentRes = await memoryQuery({ limit: 3 })
  if (recentRes.episodes && recentRes.episodes.length > 0) {
    memoryContext += '\n' + recentRes.episodes.map(...).join('\n')
  }
}
```

### 步骤2：修改 memoryQuery 支持无板块查询

文件：`src/background/memoryWorker.ts`

确保 `memoryQuery` 在 `blocks` 为空时能返回最近的记忆。

### 步骤3：测试验证

1. 告诉 Madoka 名字
2. 检查记忆是否保存
3. 新开会话
4. 询问名字，验证 Madoka 是否记得

## 预期效果

- 新会话自动知道用户是谁（通过用户画像）
- 新会话能记住最近的对话内容
- 用户选择板块后，能获取更详细的板块记忆
