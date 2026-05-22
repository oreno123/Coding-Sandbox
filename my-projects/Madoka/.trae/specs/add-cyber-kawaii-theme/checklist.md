# Checklist

## CSS 变量

- [x] 添加了 `[data-theme="cyber"]` 选择器
- [x] 背景色系正确定义 (`#1A0B2E`, `#2D1B4E`)
- [x] 文字色系正确定义 (`#F0F0FF`)
- [x] 强调色系正确定义 (`#FF4D8D`, `#00F0FF`)
- [x] 装饰色正确定义 (`#FFD93D`)
- [x] 霓虹阴影变量正确定义
- [x] 毛玻璃效果变量正确定义
- [x] 消息气泡颜色适配 Cyber 主题

## Tailwind 配置

- [x] cyber 色系添加到 colors 配置
- [x] 霓虹阴影添加到 boxShadow 配置
- [x] 配置语法正确无误

## 类型定义

- [x] 主题类型扩展为 `'light' | 'dark' | 'cyber'`
- [x] 所有使用主题类型的地方已更新

## 设置面板

- [x] Cyber 主题选项添加到选择器
- [x] 主题切换逻辑支持三种主题
- [x] 主题偏好保存到本地存储

## Cyber 专属样式

- [x] `.cyber-glass-panel` 样式类定义正确
- [x] `.cyber-btn-primary` 样式类定义正确
- [x] `.cyber-tech-border` 样式类定义正确
- [x] 样式类只在 Cyber 主题下生效

## 功能验证

- [x] `npm run build` 无编译错误
- [x] Light → Dark 切换正常
- [x] Dark → Cyber 切换正常
- [x] Cyber → Light 切换正常
- [x] 背景色正确显示
- [x] 霓虹发光效果正常
- [x] 毛玻璃效果正常
- [x] 刷新页面后主题保持
