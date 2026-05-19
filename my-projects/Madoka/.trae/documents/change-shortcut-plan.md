# 更换划词翻译快捷键

## 问题
Ctrl+T 是浏览器打开新标签页的快捷键，会冲突。

## 可选方案

### 方案1：使用 Alt+T
- Alt+T 通常不会与浏览器默认快捷键冲突
- 容易记忆（T 代表 Translate）

### 方案2：使用 Shift+T
- Shift+T 是浏览器重新打开关闭的标签页，也会冲突

### 方案3：使用组合键如 Ctrl+Shift+T
- 更安全，不容易冲突
- 但操作稍复杂

### 方案4：使用其他字母如 Ctrl+M
- M 代表 Madoka 或 Translate
- 不容易冲突

## 推荐方案

**方案1：Alt+T**
- 简单易记
- 不会与浏览器默认快捷键冲突
- 单手即可操作

## 实施步骤

修改 `src/content/index.ts` 中的快捷键监听：

```typescript
// 从
if ((e.ctrlKey || e.metaKey) && e.key === 't')

// 改为
if (e.altKey && e.key === 't')
```

同时更新提示信息：
```typescript
console.log('[Madoka Content] 划词翻译已启用，按 Alt+T 可切换')
```
