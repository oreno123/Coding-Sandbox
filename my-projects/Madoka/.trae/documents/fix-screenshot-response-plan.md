# 修复截图功能发送对话后 AI 助手回答不包含图片内容的计划

## 问题描述
当用户使用截图功能发送消息给 AI 后，AI 助手的回答没有包含/引用图片内容。用户期望 AI 能够分析和描述截图中的内容。

## 问题分析

通过代码审查，发现了以下关键流程：

1. **截图附加流程**：
   - 用户在 `Composer.tsx` 中点击截图按钮
   - 截图通过 `handleCaptureScreenshot` 获取并存储在 `attachedImages` 状态中
   - 发送消息时，`attachedImages` 被传递给 `sendMessage`

2. **消息发送流程**：
   - `useChat.ts` 中的 `sendMessage` 调用 `addMessage` 添加用户消息（包含 `images` 字段）
   - 然后通过 `chrome.runtime.sendMessage` 发送消息到 background
   - 消息中包含 `images` 数组（base64 data URLs）

3. **Background 处理流程**：
   - `background/index.ts` 中的 `handleSmartChatRequest` 接收消息
   - 调用 `handleChat`（来自 `api.ts`）构建消息数组
   - `handleChat` 正确地将图片添加到消息内容中（多模态格式）
   - 调用 `callTongyiAPI` 发送给 AI

4. **AI 响应流程**：
   - AI 接收到包含图片的消息
   - AI 应该分析图片并返回描述

## 发现的问题

经过仔细审查代码流程，发现代码逻辑是正确的：
- `Composer.tsx` 正确传递图片
- `useChat.ts` 正确发送图片
- `background/index.ts` 正确处理图片
- `api.ts` 正确构建多模态消息

**但是**，可能存在以下问题：

1. **历史消息传递问题**：在 `useChat.ts` 第 74-78 行，构建 history 时只传递了 `role` 和 `content`，**没有传递 `images` 字段**。这意味着在后续对话中，之前的图片信息会丢失。

2. **AI 模型问题**：可能使用的模型不支持视觉功能，或者配置不正确。

3. **消息格式问题**：需要确认多模态消息格式是否符合通义千问 API 的要求。

## 修复计划

### 任务 1: 修复历史消息中图片信息的传递
- **文件**: `src/sidepanel/hooks/useChat.ts`
- **问题**: 第 74-78 行构建 history 时没有包含 images 字段
- **修复**: 修改 history 构建逻辑，包含 images 字段

### 任务 2: 确认 API 消息格式正确性
- **文件**: `src/background/api.ts`
- **检查**: 确认多模态消息格式符合通义千问 API 要求
- **修复**: 如有问题，调整消息格式

### 任务 3: 测试验证
- 测试截图发送后 AI 是否能正确分析图片
- 测试多轮对话中图片信息的保留

## 实现步骤

1. 首先修复 `useChat.ts` 中 history 构建的问题
2. 检查并确认 `api.ts` 中的消息格式
3. 验证修复效果
