# Checklist

- [x] MessageItem 类型定义支持 mime_type 和 meta_data
- [x] ResourceInfo 类型定义包含 file_name, file_format, url, id, content, type
- [x] Composer.tsx handleSend 构建消息数组
- [x] 上下文引用消息使用 mime_type: "context/reference"
- [x] 用户输入消息使用 mime_type: "text/plain"
- [x] handleSelectContext 不再修改输入框内容
- [x] useChat hook sendMessage 支持消息数组
- [x] background 处理 sendMessages action
- [x] 正确提取上下文引用消息
- [x] 系统提示词正确附加上下文内容
- [x] 用户消息保持纯净
- [x] 构建无错误
