# Checklist

## API Key 存储管理

- [ ] `saveApiKey()` 函数正常工作，保存到 Chrome storage
- [ ] `getApiKey()` 函数正常工作，从 Chrome storage 读取
- [ ] `hasApiKey()` 函数正确返回是否已配置
- [ ] `clearApiKey()` 函数正常工作
- [ ] 存储使用 `chrome.storage.local` 或 `chrome.storage.sync`

## 登录页面组件

- [ ] LoginPage 组件正常渲染
- [ ] API Key 输入框可以输入文本
- [ ] 保存按钮可以点击
- [ ] 输入验证正常工作（非空检查）
- [ ] 保存成功后跳转到主界面
- [ ] 帮助链接指向正确的 API Key 获取页面

## 首次使用检测

- [ ] App.tsx 初始化时检查 API Key
- [ ] 未配置时显示登录页面
- [ ] 已配置时显示主界面
- [ ] 加载状态处理正确

## 设置页面集成

- [ ] SettingsPanel 显示 API 设置区块
- [ ] 当前 API Key 部分隐藏显示（如 sk-xxx...xxx）
- [ ] 显示/隐藏切换按钮正常工作
- [ ] 修改 API Key 功能正常
- [ ] 保存成功提示显示

## API 调用逻辑

- [ ] API 调用从 Chrome storage 读取 API Key
- [ ] Authorization 头正确添加
- [ ] API Key 无效时显示正确错误

## 代码质量

- [ ] 无 TypeScript 编译错误
- [ ] 无 ESLint 错误
- [ ] 代码符合项目风格

## 功能测试

- [ ] 首次安装扩展，显示登录页面
- [ ] 输入 API Key 后保存成功
- [ ] 重新打开扩展，直接进入主界面
- [ ] 在设置页面可以修改 API Key
- [ ] AI 对话功能使用正确的 API Key
