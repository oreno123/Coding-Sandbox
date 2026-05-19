# Checklist

## 移除硬编码 API Key

- [ ] `src/shared/types.ts` 中的 apiKey 默认为空字符串
- [ ] 无其他硬编码 API Key

## API Key 设置组件

- [ ] ApiKeySetup.tsx 组件正常渲染
- [ ] API Key 输入框可以输入
- [ ] 格式验证正常工作（以 sk- 开头）
- [ ] 保存功能正常
- [ ] 帮助链接正确

## 首次使用检测

- [ ] App.tsx 检查 config.apiKey
- [ ] 未配置时显示 ApiKeySetup
- [ ] 已配置时显示主界面

## API 调用检查

- [ ] handleChat 检查 API Key
- [ ] streamChat 检查 API Key
- [ ] 无 API Key 时显示正确错误

## 构建和测试

- [ ] 无 TypeScript 编译错误
- [ ] 首次使用显示 API Key 设置界面
- [ ] 输入有效 API Key 后进入主界面
- [ ] 后续使用不再提示
