# 修复 chrome.alarms.create 错误

## 问题描述
错误信息：`Uncaught TypeError: Cannot read properties of undefined (reading 'create')`
错误位置：`assets/index.ts-D15N9SiT.js:163`（对应 `src/background/index.ts:1748`）

## 根本原因
`chrome.alarms.create()` 在模块顶层被直接调用，但 `chrome.alarms` 在某些情况下可能是 `undefined`：
- 热重载（HMR）时
- 在非扩展上下文执行时
- Service Worker 未完全初始化时

## 修复方案

### 步骤 1：添加安全检查
在调用 `chrome.alarms.create()` 之前添加安全检查：

**修改文件**: `src/background/index.ts`

**修改内容**:
```typescript
// 修改前（第 1747-1748 行）：
// Memory cleanup alarm (daily)
chrome.alarms.create('memoryCleanup', { periodInMinutes: 24 * 60 })

// 修改后：
// Memory cleanup alarm (daily)
if (chrome.alarms) {
  chrome.alarms.create('memoryCleanup', { periodInMinutes: 24 * 60 })
}
```

### 步骤 2：添加 onAlarm 监听器安全检查
```typescript
// 修改前：
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'memoryCleanup') {
    memoryRunCleanup().catch((e) => console.warn('[Madoka] Memory cleanup alarm failed:', e))
  }
})

// 修改后：
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'memoryCleanup') {
      memoryRunCleanup().catch((e) => console.warn('[Madoka] Memory cleanup alarm failed:', e))
    }
  })
}
```

### 步骤 3：验证构建
运行 `npm run build` 确保修复后构建成功

## 预期结果
- 扩展启动时不再抛出 TypeError
- 记忆清理定时任务正常工作
- 构建成功
