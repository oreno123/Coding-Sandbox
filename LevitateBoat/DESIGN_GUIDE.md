# Levitate Boat 设计指南

## 黑金色主题设计理念

### 配色方案

#### 主色调
- **深黑色** `#0a0a0a` - 主背景色，营造深邃感
- **纯黑色** `#000000` - 侧边栏背景，增强对比
- **金色** `#d4af37` - 主要强调色，象征高端与品质
- **亮金色** `#f4d03f` - 渐变终点，增加活力
- **暗金色** `#b8941f` - 阴影和深色金色元素

#### 辅助色
- **米白色** `#e8e6e3` - 主要文字颜色
- **浅金色** `#c9b896` - 次要文字颜色
- **暗金棕** `#8b7d6b` - 提示文字颜色

### 设计元素

#### 1. 渐变效果
```css
/* 用户消息气泡 */
background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);

/* 发送按钮 */
background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3);

/* 滚动条 */
background: linear-gradient(180deg, rgba(212, 175, 55, 0.4) 0%, rgba(212, 175, 55, 0.2) 100%);
```

#### 2. 光晕效果
```css
/* 背景光晕 */
background: radial-gradient(ellipse at top, rgba(212, 175, 55, 0.05) 0%, #0a0a0a 50%);

/* 活跃对话项光晕 */
box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);

/* 按钮悬停光晕 */
box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
```

#### 3. 边框样式
```css
/* 半透明金色边框 */
border: 1px solid rgba(212, 175, 55, 0.2);

/* 活跃状态强调边框 */
border-left: 3px solid var(--accent-gold);
```

#### 4. 文字渐变
```css
/* 标题文字渐变 */
background: linear-gradient(135deg, #f4d03f 0%, #d4af37 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```

## 侧边栏设计

### 布局规格
- **展开宽度**: 260px
- **折叠宽度**: 50px
- **过渡时间**: 0.3s ease

### 对话列表项
- **高度**: 自适应（padding: 10px 12px）
- **圆角**: 8px
- **间距**: 4px
- **图标**: 18px 表情符号
- **标题**: 13px 字体，500 字重
- **时间**: 11px 字体，灰色

### 交互状态
1. **默认**: 透明背景
2. **悬停**: 金色半透明背景 `rgba(212, 175, 55, 0.08)`
3. **活跃**: 
   - 背景: `rgba(212, 175, 55, 0.15)`
   - 左边框: 3px 金色
   - 光晕效果

## 响应式设计

### 弹窗尺寸
- **宽度**: 720px（包含侧边栏）
- **最小高度**: 480px
- **最大高度**: 600px

### 主内容区
- **弹性布局**: flex: 1
- **最小宽度**: 0（允许收缩）
- **自适应**: 根据侧边栏状态调整

## 动画效果

### 过渡动画
```css
/* 侧边栏折叠 */
transition: width 0.3s ease, margin-left 0.3s ease;

/* 按钮悬停 */
transition: all 0.2s;
transform: translateY(-1px);

/* 主题切换 */
transition: background-color 0.2s ease, color 0.2s ease;
```

### 加载动画
```css
/* 旋转动画 */
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 脉冲动画 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## 使用建议

### 何时使用暗色主题
- 夜间使用，减少眼睛疲劳
- 需要专注的工作环境
- 追求高端视觉体验

### 何时使用侧边栏
- 需要管理多个对话
- 快速切换历史对话
- 查看对话时间线

### 折叠侧边栏的场景
- 需要更大的聊天区域
- 专注于当前对话
- 屏幕空间有限

## 开发注意事项

### CSS 变量命名规范
- `--bg-*`: 背景色
- `--text-*`: 文字色
- `--border-*`: 边框色
- `--accent-*`: 强调色
- `--msg-*`: 消息相关

### 主题切换
使用 `[data-theme="dark"]` 选择器覆盖浅色主题样式

### 性能优化
- 使用 CSS 变量减少重复代码
- 利用 GPU 加速的 transform 属性
- 避免过度使用阴影和渐变

## 未来改进方向

1. **自定义主题**: 允许用户自定义金色色调
2. **更多配色**: 提供黑银色、黑蓝色等变体
3. **侧边栏宽度**: 支持用户调整侧边栏宽度
4. **对话搜索**: 在侧边栏添加搜索功能
5. **对话分组**: 支持文件夹或标签分组
