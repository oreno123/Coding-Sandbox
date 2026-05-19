# 移除 Content Script 模块加载超时警告

## 问题分析

在 `src/content/index.ts` 中，有两个等待函数 `waitForReader()` 和 `waitForActionParser()`：

```typescript
// 等待 Reader 模块加载
function waitForReader(): Promise<void> {
  return new Promise((resolve) => {
    const checkReader = () => {
      if ((window as unknown as { MadokaReader?: typeof MadokaReader }).MadokaReader) {
        resolve()
      } else {
        setTimeout(checkReader, 100)
      }
    }
    checkReader()

    setTimeout(() => {
      console.warn('[Madoka Content] Reader 模块加载超时')  // <-- 这行报错
      resolve()
    }, 5000)
  })
}
```

**问题原因**：
- `MadokaReader` 和 `MadokaActionParser` 是通过 ES Module `import` 直接导入的
- 它们**不会**被挂载到 `window` 对象上
- 因此检查 `window.MadokaReader` 永远返回 `false`
- 5秒超时后打印警告信息，但实际上模块已经可用

## 解决方案

**移除不必要的等待逻辑**，因为：
1. `MadokaReader` 已通过 `import { MadokaReader } from './reader'` 导入
2. `MadokaActionParser` 已通过 `import { MadokaActionParser } from './action-parser'` 导入
3. ES Module 导入是同步的，模块在代码执行时已可用

## 实现步骤

### Step 1: 移除 `waitForReader()` 函数
- 删除第 28-44 行的 `waitForReader` 函数定义

### Step 2: 移除 `waitForActionParser()` 函数
- 删除第 47-63 行的 `waitForActionParser` 函数定义

### Step 3: 移除函数调用
- 移除 `readPage` 处理中的 `await waitForReader()` 调用（第 72 行）
- 移除 `readHTML` 处理中的 `await waitForReader()` 调用（第 122 行）
- 移除 `extractActionSpace` 处理中的 `await waitForActionParser()` 调用（第 169 行）
- 移除 `executeAction` 处理中的 `await waitForActionParser()` 调用（第 198 行）

### Step 4: 简化条件判断
- 移除检查 `window.MadokaReader` 的条件判断，直接使用导入的 `MadokaReader`
- 移除检查 `window.MadokaActionParser` 的条件判断，直接使用导入的 `MadokaActionParser`

### Step 5: 简化 init() 函数
- 移除 `await waitForReader()` 和 `await waitForActionParser()` 调用
- 移除相关的 "模块已就绪" 日志

### Step 6: 构建验证
- 运行 `npm run build` 确保无编译错误
