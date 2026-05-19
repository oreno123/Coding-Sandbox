# 解决合并冲突规格文档

## 背景
已将memory分支合并到master分支，出现19个文件的合并冲突，需要系统性地解决。

## 冲突文件列表

### 配置文件 (4个)
- `.gitignore`
- `package.json`
- `readme.md`
- `docs/history-search.md`

### 核心代码文件 (15个)
- `src/background/api.ts`
- `src/background/index.ts`
- `src/content/index.ts`
- `src/manifest.json`
- `src/shared/constants.ts`
- `src/shared/messaging.ts`
- `src/shared/types.ts`
- `src/sidepanel/App.tsx`
- `src/sidepanel/components/InputArea.tsx`
- `src/sidepanel/components/Message.tsx`
- `src/sidepanel/components/SettingsPanel.tsx`
- `src/sidepanel/components/composer/Composer.tsx`
- `src/sidepanel/components/layout/Sidebar.tsx`
- `src/sidepanel/context/ChatContext.tsx`
- `src/sidepanel/hooks/useChat.ts`
- `src/sidepanel/index.css`

## 解决策略

### 原则
1. **memory分支优先**：memory分支包含记忆系统功能，是主要新增功能
2. **保留翻译功能**：master分支的划词翻译功能必须保留
3. **整合而非替换**：两个分支的功能都要保留，进行代码整合

### 冲突解决方法

#### 类型A：配置文件
- 采用**双方合并**策略
- 保留master的配置项
- 添加memory分支新增的配置项

#### 类型B：background/index.ts
- 保留翻译API处理逻辑
- 添加记忆系统消息处理

#### 类型C：content/index.ts
- 保留划词翻译事件监听
- 添加记忆系统相关代码

#### 类型D：UI组件
- 保留master的UI结构
- 添加memory分支的记忆相关UI

#### 类型E：manifest.json
- 合并权限配置
- 保留所有必要的权限声明

## 验收标准
- [ ] 所有19个冲突文件解决完毕
- [ ] 项目可以成功构建
- [ ] 翻译功能正常工作
- [ ] 记忆系统功能正常工作
- [ ] 无运行时错误
