# Madoka 翻译功能解析文档计划

## 目标
编写一份技术文档，解析Madoka浏览器插件中的划词翻译功能实现。

## 已发现的相关文件

1. `src/content/translation-popup.ts` - 翻译弹窗UI组件
2. `src/content/index.ts` - Content Script，处理划词事件和翻译调用
3. `src/background/index.ts` - Background Script，调用翻译API

## 文档结构规划

### 1. 功能概述
- 划词翻译的定位和使用场景
- 功能特点（浮动弹窗、拖拽、固定、复制、问AI等）

### 2. 架构流程
- 完整的数据流转图
- 从选中文本到显示翻译结果的流程

### 3. 前端UI层 (translation-popup.ts)
- TranslationPopup类设计
- 弹窗结构和样式
- 交互功能（拖拽、固定、关闭）
- 内容更新机制

### 4. 事件处理层 (content/index.ts)
- 划词事件监听
- 防抖处理
- 语言对自动检测（中/英）
- 与background的通信

### 5. 翻译API层 (background/index.ts)
- MyMemory Translation API调用
- 超时处理
- 错误处理

### 6. 功能特性详解
- 拖拽定位
- 固定/取消固定
- 复制译文
- 问AI功能
- 重试机制
- ESC键关闭

### 7. 配置常量
- 最大翻译长度限制
- 防抖时间
- 超时时间

### 8. 错误处理
- 扩展上下文失效处理
- 网络超时处理
- API错误处理

## 输出文件
- 文档路径: `.trae/documents/madoka-translation-feature-analysis.md`
