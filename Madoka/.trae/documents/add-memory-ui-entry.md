# 添加记忆系统 UI 入口

## 问题描述
记忆系统已合并到 master 分支，但缺少 UI 入口：
1. Sidebar 中没有"记忆"按钮
2. SettingsPanel 中没有记忆相关设置

## 需要添加的内容

### 1. Sidebar 添加"记忆"按钮
在 Sidebar.tsx 的 Footer 区域，Settings 按钮上方添加"记忆"按钮：

**修改文件**: `src/sidepanel/components/layout/Sidebar.tsx`

**添加内容**:
```tsx
{/* Footer */}
<div className="p-3 border-t border-[var(--border-primary)]">
  {/* 记忆入口 */}
  <button
    onClick={() => setView('memory')}
    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    记忆
  </button>
  
  {/* Settings 入口 */}
  <button
    onClick={() => setView('settings')}
    ...
  >
    Settings
  </button>
</div>
```

### 2. SettingsPanel 添加记忆设置
在 SettingsPanel.tsx 中添加记忆相关设置：

**修改文件**: `src/sidepanel/components/SettingsPanel.tsx`

**添加内容**:
- 记忆功能开关
- Obsidian 同步开关
- 用户画像开关
- Obsidian 目录选择按钮

### 3. 验证构建
运行 `npm run build` 确保修复后构建成功

## 预期结果
- Sidebar 底部显示"记忆"按钮
- 点击后进入记忆总览页面
- 设置页面包含记忆相关选项
