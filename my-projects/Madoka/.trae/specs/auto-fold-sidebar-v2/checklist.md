# Checklist

## MessageList 组件

- [ ] 容器 div 有 onClick={toggleSidebar}

## Message 组件

- [ ] motion.div 移除了 onClick={(e) => e.stopPropagation()}
- [ ] 消息内容 div 添加了 onClick={(e) => e.stopPropagation()}

## 功能测试

- [ ] 点击空白区域收起侧边栏
- [ ] 点击对话框气泡收起侧边栏
- [ ] 点击消息内容不触发收起

## 构建

- [ ] 无 TypeScript 错误
