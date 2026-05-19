# Checklist

## 组件实现
- [x] ConversationSelector 组件已创建并实现日期分组功能
- [x] ConversationSelector 支持当前对话高亮
- [x] ConversationSelector 支持删除对话
- [x] ConversationSelector 显示空状态提示

## Context 修改
- [x] ChatContext 中 sidebarOpen 状态已移除
- [x] toggleSidebar 方法已移除
- [x] 相关类型定义已更新

## Composer 修改
- [x] Composer 底部工具栏左侧有新对话按钮
- [x] 新对话按钮旁有对话选择器按钮
- [x] ConversationSelector 下拉组件正确集成
- [x] 设置页面入口按钮已添加

## App.tsx 重构
- [x] Sidebar 组件引用已移除
- [x] sidebarOpen 相关条件渲染已移除
- [x] header 组件已简化
- [x] 设置页面和记忆页面正常显示

## 代码清理
- [x] Sidebar.tsx 已删除
- [x] sidebar 目录下无用组件已删除
- [x] CSS 中侧边栏相关样式已清理

## 功能验证
- [x] 构建成功无编译错误
- [x] 新对话创建功能正常
- [x] 对话切换功能正常
- [x] 设置页面入口和返回功能正常
