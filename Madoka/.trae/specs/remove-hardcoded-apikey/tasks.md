# Tasks

## Task 1: 移除硬编码 API Key
- [ ] 打开 `src/shared/types.ts`
- [ ] 找到第 62 行的硬编码 API Key
- [ ] 将 `apiKey: 'sk-b8570d1d70dd4968afad113dc334a254'` 改为 `apiKey: ''`

**Dependencies**: None

## Task 2: 创建 API Key 设置组件
- [ ] 创建 `src/sidepanel/components/ApiKeySetup.tsx` 文件
- [ ] 设计 API Key 输入界面（输入框、保存按钮、帮助链接）
- [ ] 实现 API Key 格式验证（以 sk- 开头）
- [ ] 实现保存功能，调用 `updateConfig('apiKey', value)`
- [ ] 添加"如何获取 API Key"的帮助说明

**Dependencies**: None

**代码示例**:
```typescript
import { useState } from 'react'
import { useChatContext } from '../context/ChatContext'

export function ApiKeySetup() {
  const { config, updateConfig } = useChatContext()
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')

  const handleSave = () => {
    if (!apiKey.trim().startsWith('sk-')) {
      setError('API Key 格式不正确，应以 sk- 开头')
      return
    }
    updateConfig('apiKey', apiKey.trim())
  }

  return (
    <div className="api-key-setup">
      <h2>欢迎使用 Madoka</h2>
      <p>请输入您的通义千问 API Key 以开始使用</p>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-..."
      />
      {error && <div className="error">{error}</div>}
      <button onClick={handleSave}>保存并开始使用</button>
      <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank">
        如何获取 API Key？
      </a>
    </div>
  )
}
```

## Task 3: 修改 App.tsx 添加首次使用检测
- [ ] 打开 `src/sidepanel/App.tsx`
- [ ] 从 `useChatContext` 解构 `config`
- [ ] 添加条件渲染：如果 `config.apiKey` 为空，显示 `ApiKeySetup` 组件
- [ ] 否则显示正常界面

**Dependencies**: Task 2

**代码示例**:
```typescript
function AppContent() {
  const { sidebarOpen, config } = useChatContext()

  // 首次使用，未配置 API Key
  if (!config.apiKey) {
    return <ApiKeySetup />
  }

  return (
    // 正常界面
  )
}
```

## Task 4: 在 API 调用前添加检查
- [ ] 打开 `src/background/api.ts`
- [ ] 在 `handleChat` 函数开头检查 `config.apiKey`
- [ ] 如果为空，抛出错误"请先配置 API Key"
- [ ] 在 `streamChat` 函数同样添加检查

**Dependencies**: Task 1

**代码示例**:
```typescript
export async function handleChat(...) {
  if (!config.apiKey) {
    throw new Error('请先配置 API Key，在设置中填写您的通义千问 API Key')
  }
  // 原有逻辑
}
```

## Task 5: 构建和测试
- [ ] 运行 `npm run build` 确保无 TypeScript 错误
- [ ] 清除浏览器存储中的配置（模拟首次使用）
- [ ] 重新加载扩展，验证显示 API Key 设置界面
- [ ] 输入无效 API Key，验证错误提示
- [ ] 输入有效 API Key，验证保存后进入主界面
- [ ] 验证后续使用不再提示

**Dependencies**: Task 1, Task 2, Task 3, Task 4

# Task Dependencies

```
Task 3 depends on Task 2
Task 5 depends on Task 1, Task 2, Task 3, Task 4
```

# Parallelizable Work

- Task 1, Task 2, Task 4 可以并行执行
