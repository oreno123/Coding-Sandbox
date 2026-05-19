# UI 简化与联网搜索提示优化

## 需求分析

用户有三个需求：
1. **移除设置中的 API 配置** - 不再在设置中显示 Tongyi API Key 和 Model 选择
2. **取消 Agent 模式切换** - 移除模式切换功能，只保留 Chat 模式
3. **联网搜索状态提示** - 在使用联网搜索功能时显示正在联网的提示

## 实现步骤

### Step 1: 移除设置面板中的 API 配置区域

**文件**: `src/sidepanel/components/SettingsPanel.tsx`

移除以下内容：
- "API Configuration" 整个 section（第 207-265 行）
  - Tongyi API Key 输入框
  - Model 选择下拉框
  - GitHub Token 输入框

### Step 2: 移除 Agent 模式切换功能

**文件**: `src/sidepanel/components/composer/Composer.tsx`

修改内容：
1. 移除 `modeSwitcherOpen` 状态和 `modeSwitcherRef`
2. 移除 `handleModeChange` 函数
3. 移除 `setMode` 从 useChatContext 的解构
4. 移除整个模式切换器 UI（第 421-471 行）：
   - `composer-mode-switcher` div
   - 模式切换按钮和下拉菜单
5. 移除 `ModeIcon`, `ChevronIcon`, `CheckIcon` 图标组件（如果不再使用）

**文件**: `src/sidepanel/context/ChatContext.tsx`

修改内容：
1. 移除 `AppMode` 类型中的 `'agent'`，只保留 `'chat'`
2. 移除 `setMode` 方法
3. 移除 Agent 相关的状态和方法（如果确认不再需要）

**文件**: `src/sidepanel/App.tsx`

修改内容：
1. 移除 Agent 模式相关的条件渲染
2. 移除 `agent` 相关的解构和使用
3. 移除 `AgentWelcome` 组件
4. 移除 `ActionPlan` 组件的引用

### Step 3: 添加联网搜索状态提示

**文件**: `src/sidepanel/components/composer/Composer.tsx`

修改内容：
1. 在网络搜索按钮上添加状态指示
2. 当 `searchStatus` 有值时，显示一个动态指示器（如脉冲点或加载动画）
3. 可以考虑：
   - 按钮变为高亮状态
   - 显示一个小圆点动画
   - 或者显示一个小的加载 spinner

**文件**: `src/sidepanel/index.css`

添加样式：
- 联网搜索激活状态的样式
- 脉冲动画效果

### Step 4: 构建验证

- 运行 `npm run build` 确保无编译错误
- 测试功能是否正常

## 详细代码修改

### SettingsPanel.tsx 修改

移除整个 API Configuration section，保留：
- Appearance section（主题设置）
- Search Settings section（搜索引擎设置）
- Memory Settings section（记忆系统设置）

### Composer.tsx 修改

1. 移除模式切换器相关代码
2. 修改网络搜索按钮，添加状态指示：

```tsx
{/* 网络搜索按钮 */}
<button
  className={`composer-tool-btn ${searchStatus ? 'searching' : ''}`}
  onClick={() => {
    setInput(input + '/search ')
    textareaRef.current?.focus()
  }}
  title={searchStatus || "Web search"}
  type="button"
>
  <GlobeIcon />
  {searchStatus && <span className="search-indicator" />}
</button>
```

### CSS 新增样式

```css
.composer-tool-btn.searching {
  color: var(--accent-primary);
  background: rgba(var(--accent-primary-rgb), 0.1);
}

.search-indicator {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  background: var(--accent-primary);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
```
