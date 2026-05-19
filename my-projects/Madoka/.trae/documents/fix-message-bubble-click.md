# 修复对话框气泡点击收起问题

## 问题分析

当前代码结构：
```
MessageList (onClick={toggleSidebar})
  └── motion.div (消息列表容器)
       └── Message (onClick={() => toggleSidebar?.()})
            ├── 搜索结果区域
            ├── GitHub卡片区域  
            └── 消息内容div (onClick={(e) => e.stopPropagation()})
                 └── 消息文字
```

问题：
- 点击消息内容div时，事件被阻止冒泡，不会触发Message的onClick
- 但Message组件的motion.div上有onClick，应该能触发

可能的原因：
1. 消息内容div覆盖了大部分区域，用户点击时实际点在了内容上
2. 事件冒泡被阻止后，motion.div的onClick确实不会触发

## 解决方案

需要在消息内容div的父级（即对话框气泡）处理点击事件，而不是在motion.div上。

### 修改方案

将 `onClick={() => toggleSidebar?.()}` 从 motion.div 移到消息内容div的父级容器上，或者调整事件处理逻辑。

实际上，应该让消息内容div不阻止冒泡，而是在内部的具体内容（如文字、按钮）上阻止。

但更简单的方法是：移除消息内容div上的阻止冒泡，改为在renderContent内部的元素上阻止。

### 推荐方案

移除消息内容div上的 `onClick={(e) => e.stopPropagation()}`，改为：
- 在markdown-content或文字元素上阻止冒泡
- 或者在链接、按钮等交互元素上阻止

但这样改动较大。

### 简单方案

直接在Message组件的motion.div上保留onClick，但确保它能被触发。

检查是否是因为消息内容div的阻止冒泡导致motion.div的onClick不触发。

实际上，事件冒泡是从子到父的：
1. 点击消息内容div
2. 消息内容div阻止冒泡
3. 事件不会传递到motion.div
4. 所以motion.div的onClick不会触发

**结论**：需要将toggleSidebar调用放在消息内容div上，但要排除内部交互元素。

## 实现方案

修改Message.tsx：

```typescript
// 消息内容div不再阻止冒泡，改为在内部处理
<div
  className={...}
  onClick={(e) => {
    // 如果点击的是链接或按钮，不触发收起
    if (e.target instanceof HTMLAnchorElement || 
        e.target instanceof HTMLButtonElement) {
      return
    }
    toggleSidebar?.()
  }}
>
  {renderContent()}
</div>
```

或者更简单：移除消息内容div的阻止冒泡，让motion.div的onClick生效。

但这样点击消息内容也会触发收起，可能不是用户想要的。

## 最终方案

用户想要：
- 点击对话框气泡（非内容区域）→ 收起
- 点击消息内容 → 不收起

但消息内容div占据了气泡的大部分区域。

解决方案：
1. 在motion.div上保留onClick
2. 在消息内容div上阻止冒泡
3. 在搜索结果、GitHub卡片上也阻止冒泡
4. 这样只有点击气泡的空白区域（padding等）才会触发收起

或者：
1. 移除消息内容div的阻止冒泡
2. 在renderContent内部的markdown链接、按钮上阻止冒泡

推荐第二种方案，但改动较大。

## 简单修复

暂时移除消息内容div的阻止冒泡，让点击对话框任何位置都能收起：

```typescript
// 移除这一行
// onClick={(e) => e.stopPropagation()}
```

然后观察效果，如果需要再细化。
