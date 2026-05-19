# 记忆系统问题修复计划

## 问题一：设置中记忆系统设置保存不了

### 问题分析

**根本原因：返回值结构不匹配**

1. **读取设置问题**
   - `background/index.ts` 中 `memoryGetSettings` handler 返回：`{ success: true, settings }`
   - `SettingsPanel.tsx` 中期望直接得到：`MemorySettings` 对象
   - 结果：`setMemorySettings(settings)` 实际设置的是 `{ success: true, settings: ... }`，而不是真正的 settings 对象

2. **保存设置问题**
   - 保存时传递的是错误结构的 settings 对象
   - 导致保存的数据不正确

### 修复方案

修改 `SettingsPanel.tsx` 中的代码：

**修复读取设置：**
```typescript
// 修改前
const settings = await sendToBackground<MemorySettings>({ action: 'memoryGetSettings' })
setMemorySettings(settings)

// 修改后
const res = await sendToBackground<{ success: boolean; settings: MemorySettings }>({ action: 'memoryGetSettings' })
if (res.success && res.settings) {
  setMemorySettings(res.settings)
}
```

**修复保存设置：**
```typescript
// 修改前
await sendToBackground({ action: 'memorySaveSettings', settings: memorySettings })

// 修改后
const res = await sendToBackground<{ success: boolean }>({ action: 'memorySaveSettings', settings: memorySettings })
// 可选：添加保存成功/失败提示
```

### 修复步骤

1. 修改 `src/sidepanel/components/SettingsPanel.tsx`
   - 修复 `loadMemorySettings` 函数，正确解析返回值
   - 修复 `saveMemorySettings` 函数，添加返回值类型

2. 验证修复
   - 重新构建
   - 测试设置读取和保存
