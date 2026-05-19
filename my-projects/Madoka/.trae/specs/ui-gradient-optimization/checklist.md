# UI渐变优化检查清单

## 数据层检查
- [x] theme.ts中Light主题包含accentPrimaryRgb和accentSecondaryRgb
- [x] theme.ts中Dark主题包含accentPrimaryRgb和accentSecondaryRgb
- [x] theme.ts中Cyber主题包含accentPrimaryRgb和accentSecondaryRgb
- [x] theme.ts中Neon主题包含accentPrimaryRgb和accentSecondaryRgb

## CSS样式检查
- [x] index.css包含gradient-flow动画关键帧
- [x] index.css包含pulse-glow动画关键帧
- [x] index.css包含prefers-reduced-motion媒体查询

## Welcome组件检查
- [x] Welcome.tsx Logo使用渐变背景(from-accent-primary to-accent-secondary)
- [x] Welcome.tsx Logo有彩色box-shadow光晕
- [x] Welcome.tsx Logo悬停时阴影增强并scale(1.05)

## App组件检查
- [x] App.tsx主容器背景使用边缘晕染渐变
- [x] App.tsx QuickPrompt按钮悬停时有光泽效果
- [x] App.tsx QuickPrompt按钮悬停时边框变为accent-primary/40

## ThemeToggle组件检查
- [x] ThemeToggleSwitch选中状态轨道使用渐变+彩色光晕
- [x] ThemeToggleSwitch未选中状态轨道使用微渐变
- [x] ThemeSelector选中项使用渐变背景+内阴影

## SettingsPanel组件检查
- [x] 搜索引擎Tab选中状态使用渐变+阴影
- [x] 保存按钮使用渐变背景并应用gradient-flow类
- [x] Toggle开关选中状态使用渐变+彩色光晕
- [x] Toggle开关未选中状态使用微渐变

## 无障碍检查
- [x] 开启prefers-reduced-motion后所有动画停止
- [x] 动画停止后回退到静态渐变

## 视觉一致性检查
- [x] Light主题渐变流向蓝→靛，效果清新专业
- [x] Dark主题渐变流向亮蓝→亮靛，深邃有亮点
- [x] Cyber主题渐变流向粉→青，赛博朋克撞色
- [x] Neon主题渐变流向亮蓝→紫，霓虹灯管效果
