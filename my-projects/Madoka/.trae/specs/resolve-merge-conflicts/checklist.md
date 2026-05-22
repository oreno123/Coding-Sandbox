# 合并冲突解决检查清单

## 冲突解决前检查
- [ ] 确认当前在master分支
- [ ] 确认有未完成的合并操作
- [ ] 备份当前工作（如有需要）

## 配置文件冲突解决
- [ ] `.gitignore` 冲突已解决
  - 包含master分支的忽略规则
  - 包含memory分支的忽略规则
- [ ] `package.json` 冲突已解决
  - 所有依赖项完整
  - scripts正确合并
- [ ] `readme.md` 冲突已解决
- [ ] `docs/history-search.md` 冲突已解决

## 核心代码冲突解决
- [ ] `src/manifest.json` 冲突已解决
  - manifest_version正确
  - 所有权限声明完整
  - content_scripts配置正确
  - background配置正确
- [ ] `src/shared/types.ts` 冲突已解决
- [ ] `src/shared/constants.ts` 冲突已解决
- [ ] `src/shared/messaging.ts` 冲突已解决
- [ ] `src/background/api.ts` 冲突已解决
- [ ] `src/background/index.ts` 冲突已解决
  - 翻译API处理保留
  - 记忆系统消息处理保留
- [ ] `src/content/index.ts` 冲突已解决
  - 划词翻译事件监听保留
  - 记忆系统代码保留
- [ ] `src/sidepanel/App.tsx` 冲突已解决
- [ ] `src/sidepanel/context/ChatContext.tsx` 冲突已解决
- [ ] `src/sidepanel/hooks/useChat.ts` 冲突已解决
- [ ] `src/sidepanel/components/InputArea.tsx` 冲突已解决
- [ ] `src/sidepanel/components/Message.tsx` 冲突已解决
- [ ] `src/sidepanel/components/SettingsPanel.tsx` 冲突已解决
- [ ] `src/sidepanel/components/composer/Composer.tsx` 冲突已解决
- [ ] `src/sidepanel/components/layout/Sidebar.tsx` 冲突已解决
- [ ] `src/sidepanel/index.css` 冲突已解决

## 合并完成检查
- [ ] 所有冲突文件已 `git add`
- [ ] 合并提交已完成
- [ ] 无未解决的冲突标记

## 构建验证
- [ ] `npm install` 成功
- [ ] `npm run build` 无错误
- [ ] 无TypeScript类型错误
- [ ] 无ESLint错误

## 功能验证
- [ ] 扩展可以正常加载
- [ ] 划词翻译功能正常
- [ ] 侧边栏可以打开
- [ ] 记忆系统功能正常
- [ ] 设置面板可以访问
- [ ] 无控制台错误
