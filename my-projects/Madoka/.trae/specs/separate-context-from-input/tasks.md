# Tasks

- [x] Task 1: 添加消息类型定义
  - [x] SubTask 1.1: 在 types.ts 中添加 MessageItem 类型，支持 mime_type 和 meta_data
  - [x] SubTask 1.2: 添加 ResourceInfo 类型定义

- [x] Task 2: 修改 Composer.tsx 消息构建逻辑
  - [x] SubTask 2.1: 修改 handleSend 构建消息数组
  - [x] SubTask 2.2: 上下文引用使用 mime_type: "context/reference"
  - [x] SubTask 2.3: 用户输入使用 mime_type: "text/plain"
  - [x] SubTask 2.4: 简化 handleSelectContext，不再修改输入框内容

- [x] Task 3: 修改 useChat hook 支持消息数组
  - [x] SubTask 3.1: 修改 sendMessage 函数签名支持消息数组
  - [x] SubTask 3.2: 将消息数组发送到 background

- [x] Task 4: 修改 background 处理消息数组
  - [x] SubTask 4.1: 添加 sendMessages action 处理
  - [x] SubTask 4.2: 提取上下文引用消息
  - [x] SubTask 4.3: 构建系统提示词附加内容
  - [x] SubTask 4.4: 发送纯净用户消息到 AI

# Task Dependencies
- Task 1 是前置任务
- Task 2 和 Task 3 可以并行
- Task 4 需要在 Task 2 和 Task 3 完成后执行
