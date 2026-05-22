# Debug React Error #310 教学

## 错误信息解读

**错误代码**: Minified React error #310
**完整信息**: "Rendered more hooks than during the previous render"

**通俗解释**:
React 的 Hooks（如 useState, useEffect）必须在每次渲染时以**完全相同的顺序**被调用。这个错误意味着某次渲染时调用的 Hooks 数量比上一次多。

## 常见原因

### 原因 1: 在条件语句中使用 Hook

**错误代码示例**:
```typescript
if (someCondition) {
  const [state, setState] = useState(0)  // ❌ 错误！Hook 在条件中
}
```

**正确做法**:
```typescript
const [state, setState] = useState(0)  // ✅ Hook 在顶层

if (someCondition) {
  // 使用 state
}
```

### 原因 2: 在循环中使用 Hook

**错误代码示例**:
```typescript
items.map((item, index) => {
  const [state, setState] = useState(0)  // ❌ 错误！Hook 在循环中
})
```

### 原因 3: 早期 return 导致 Hook 被跳过

**错误代码示例**:
```typescript
function Component() {
  if (!data) return null  // ❌ 早期 return
  
  const [state, setState] = useState(0)  // 有时会被跳过
  // ...
}
```

## Debug 步骤

### 步骤 1: 定位问题文件

查看浏览器控制台的错误堆栈，找到出错的文件和行号。

### 步骤 2: 检查 useEffect 的位置

在我们的 SettingsPanel.tsx 中，检查：
1. useEffect 是否在函数组件的顶层？
2. useEffect 是否在条件语句之后？
3. 是否有多个 useEffect，它们的顺序是否一致？

### 步骤 3: 检查代码结构

**正确的 Hooks 调用顺序**:
```typescript
function Component() {
  // 1. 所有 useState
  const [state1, setState1] = useState()
  const [state2, setState2] = useState()
  
  // 2. 所有 useEffect
  useEffect(() => {}, [])
  useEffect(() => {}, [])
  
  // 3. 其他逻辑
  const handleClick = () => {}
  
  // 4. 条件渲染（如果有）
  if (loading) return <Loading />
  
  // 5. JSX
  return <div>...</div>
}
```

## 检查我们的代码

请检查 SettingsPanel.tsx 中的以下内容：

1. **useEffect 的位置** - 是否在函数顶层？
2. **是否有条件语句在 useEffect 之前**？
3. **所有 Hooks 的调用顺序**是否一致？

## 修复方法

如果发现问题，通常的修复方法是：

1. **把 Hook 移到函数最顶部**，确保在任何条件语句之前
2. **确保每次渲染都调用相同数量的 Hooks**
3. **不要在循环、条件或嵌套函数中调用 Hooks**

## 下一步

请检查 SettingsPanel.tsx 文件，特别关注：
1. useEffect 的位置
2. 是否有 return 语句在 useEffect 之前
3. 截图或告诉我 useEffect 前后的代码

我们一起找出问题所在！
