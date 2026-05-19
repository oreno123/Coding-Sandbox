# 修复 API Key 保存卡住问题

## 问题分析

**现象**：点击"保存并开始使用"后一直显示"保存中..."

**根本原因**：

1. **State 更新异步问题**：
   ```typescript
   updateConfig('apiKey', trimmedKey)  // 异步更新 state
   await save()  // save 依赖 config，但 config 还没更新
   ```

2. **useSettings hook 的问题**：
   - `updateConfig` 使用 `setConfig` 更新 state
   - `save` 函数使用 `useCallback` 依赖 `config`
   - 调用 `updateConfig` 后立即调用 `save`，`save` 使用的是旧的 `config`

3. **结果**：
   - `save()` 保存的是旧的 config（没有 apiKey）
   - 但 `setIsSaving(true)` 已经设置
   - 保存完成后没有正确重置 `isSaving`
   - 或者保存失败但没有正确处理错误

## 解决方案

### 方案1：在 ApiKeySetup 中直接调用 saveConfig（推荐）

不通过 `useSettings` hook，直接调用 `saveConfig`：

```typescript
import { saveConfig } from '../../shared/messaging'

const handleSave = async () => {
  // ... 验证 ...
  
  setIsSaving(true)
  
  try {
    const result = await saveConfig({ apiKey: trimmedKey })
    if (result.success) {
      // 保存成功，App.tsx 会检测到 config.apiKey 变化并显示主界面
    } else {
      setError('保存失败，请重试')
      setIsSaving(false)
    }
  } catch (e) {
    setError('保存失败，请重试')
    setIsSaving(false)
  }
}
```

### 方案2：修改 useSettings 添加 saveKeyValue 方法

在 `useSettings` 中添加一个直接保存指定 key-value 的方法：

```typescript
const saveKeyValue = useCallback(async (key: keyof AppConfig, value: unknown) => {
  const newConfig = { ...config, [key]: value }
  setConfig(newConfig)
  // 立即保存新配置
  const result = await saveConfig(newConfig)
  return result
}, [config])
```

### 方案3：使用局部状态保存

在 `handleSave` 中构建完整的 config 对象：

```typescript
const handleSave = async () => {
  // ... 验证 ...
  
  setIsSaving(true)
  
  try {
    // 构建新的 config
    const newConfig = { ...config, apiKey: trimmedKey }
    // 先更新本地 state
    updateConfig('apiKey', trimmedKey)
    // 保存新配置
    const result = await saveConfig(newConfig)
    if (result.success) {
      // 成功
    } else {
      setError('保存失败，请重试')
      setIsSaving(false)
    }
  } catch (e) {
    setError('保存失败，请重试')
    setIsSaving(false)
  }
}
```

## 推荐方案

**方案1** 最简单直接，不依赖 `useSettings` hook 的异步 state 更新。

## 实施步骤

1. 修改 `ApiKeySetup.tsx`，直接导入 `saveConfig`
2. 修改 `handleSave` 直接调用 `saveConfig({ apiKey: trimmedKey })`
3. 移除 `useSettings` hook 的使用
4. 构建测试
