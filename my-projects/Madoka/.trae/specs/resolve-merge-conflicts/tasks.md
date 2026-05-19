# 解决合并冲突任务列表

## 阶段1：查看冲突详情
- [ ] 查看每个冲突文件的具体冲突内容
- [ ] 分析冲突类型和解决策略

## 阶段2：解决配置文件冲突 (4个文件)
- [ ] 解决 `.gitignore` 冲突
  - 保留master的忽略规则
  - 添加memory分支新增的忽略项
- [ ] 解决 `package.json` 冲突
  - 合并依赖项（保留双方）
  - 合并scripts
- [ ] 解决 `readme.md` 冲突
  - 合并文档内容
- [ ] 解决 `docs/history-search.md` 冲突
  - 保留双方文档

## 阶段3：解决核心代码冲突 (15个文件)
- [ ] 解决 `src/manifest.json` 冲突
  - 合并权限声明
  - 保留所有content_scripts和background配置
- [ ] 解决 `src/shared/types.ts` 冲突
  - 合并类型定义
- [ ] 解决 `src/shared/constants.ts` 冲突
  - 合并常量定义
- [ ] 解决 `src/shared/messaging.ts` 冲突
  - 合并消息类型
- [ ] 解决 `src/background/api.ts` 冲突
  - 保留双方API函数
- [ ] 解决 `src/background/index.ts` 冲突
  - **关键文件**：保留翻译功能 + 添加记忆系统消息处理
- [ ] 解决 `src/content/index.ts` 冲突
  - **关键文件**：保留划词翻译 + 添加记忆系统代码
- [ ] 解决 `src/sidepanel/App.tsx` 冲突
  - 合并路由和组件
- [ ] 解决 `src/sidepanel/context/ChatContext.tsx` 冲突
  - 合并context逻辑
- [ ] 解决 `src/sidepanel/hooks/useChat.ts` 冲突
  - 合并hook逻辑
- [ ] 解决 `src/sidepanel/components/InputArea.tsx` 冲突
  - 合并组件代码
- [ ] 解决 `src/sidepanel/components/Message.tsx` 冲突
  - 合并消息组件
- [ ] 解决 `src/sidepanel/components/SettingsPanel.tsx` 冲突
  - 合并设置面板（添加记忆设置）
- [ ] 解决 `src/sidepanel/components/composer/Composer.tsx` 冲突
  - 合并composer组件
- [ ] 解决 `src/sidepanel/components/layout/Sidebar.tsx` 冲突
  - 合并侧边栏（添加记忆入口）
- [ ] 解决 `src/sidepanel/index.css` 冲突
  - 合并样式定义

## 阶段4：验证
- [ ] 运行 `git add .` 标记所有冲突已解决
- [ ] 运行 `git commit` 完成合并
- [ ] 运行 `npm run build` 验证构建
- [ ] 测试翻译功能
- [ ] 测试记忆系统功能

## 任务依赖
- 阶段2和阶段3可以并行进行
- 阶段4必须在所有冲突解决后进行
