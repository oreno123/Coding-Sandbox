# Tasks

## Task 1: 创建 API Key 存储管理模块
- [ ] 在 `src/shared/apiKeyStorage.ts` 创建存储管理模块
- [ ] 实现 `saveApiKey(key: string)` 函数，保存到 Chrome storage
- [ ] 实现 `getApiKey()` 函数，从 Chrome storage 读取
- [ ] 实现 `hasApiKey()` 函数，检查是否已配置
- [ ] 实现 `clearApiKey()` 函数，清除存储的 Key

**Dependencies**: None

## Task 2: 创建登录页面组件
- [ ] 创建 `src/sidepanel/components/LoginPage.tsx` 组件
- [ ] 设计登录页面 UI（输入框、保存按钮、帮助链接）
- [ ] 实现 API Key 输入和验证
- [ ] 添加"如何获取 API Key"的帮助说明
- [ ] 保存成功后跳转到主界面

**Dependencies**: Task 1

## Task 3: 修改 App.tsx 添加首次使用检测
- [ ] 在 App.tsx 中添加 API Key 检查逻辑
- [ ] 使用 useEffect 在初始化时检查 `hasApiKey()`
- [ ] 如未配置，显示 LoginPage 组件
- [ ] 如已配置，显示正常界面
- [ ] 添加加载状态处理

**Dependencies**: Task 1, Task 2

## Task 4: 在 SettingsPanel 添加 API Key 设置
- [ ] 在 SettingsPanel 中添加"API 设置"区块
- [ ] 显示当前 API Key（部分隐藏）
- [ ] 添加显示/隐藏切换按钮
- [ ] 添加修改 API Key 的输入框
- [ ] 添加保存按钮和成功提示

**Dependencies**: Task 1

## Task 5: 修改 API 调用逻辑使用动态 API Key
- [ ] 修改 `src/background/api.ts` 中的 API Key 获取方式
- [ ] 从 Chrome storage 动态读取 API Key
- [ ] 确保 API 调用时正确添加 Authorization 头
- [ ] 处理 API Key 无效的错误情况

**Dependencies**: Task 1

## Task 6: 构建和验证
- [ ] 运行 `npm run build` 确保无 TypeScript 错误
- [ ] 测试首次使用流程（清除 storage 后重新加载）
- [ ] 测试登录页面输入和保存
- [ ] 测试设置页面修改 API Key
- [ ] 验证 API 调用使用正确的 Key

**Dependencies**: Task 1, Task 2, Task 3, Task 4, Task 5

# Task Dependencies

```
Task 2 depends on Task 1
Task 3 depends on Task 1, Task 2
Task 4 depends on Task 1
Task 5 depends on Task 1
Task 6 depends on Task 1, Task 2, Task 3, Task 4, Task 5
```

# Parallelizable Work

- Task 1, Task 2, Task 4 可以并行执行
