# 语雀增强导出 (Yuque Enhanced Export)

一键导出语雀文档到 Obsidian，自动下载并替换视频链接。

## ✨ 功能特性

- 🚀 **一键导出**：自动化语雀的导出流程，无需手动操作
- 🎥 **视频处理**：自动识别文档中的视频卡片，下载视频文件并替换占位符
- 📁 **直接保存**：使用 File System Access API 直接保存到 Obsidian 仓库
- 🔄 **完整迁移**：Markdown 文档 + 视频文件 + 目录结构一次性完成
- 📊 **详细日志**：每个步骤都有详细的日志输出，方便排查问题
- 🛡️ **容错机制**：单个视频下载失败不影响其他视频和整体导出流程
- 📡 **跨域下载**：通过 Background Script 绕过 CORS 限制，支持阿里云 OSS、淘宝 CDN 等视频源
- 📦 **大文件支持**：使用 Port 分块传输，突破 Chrome 64MiB 消息大小限制，支持任意大小视频

## 🎯 解决的问题

语雀的原生导出功能存在以下问题：

1. **视频丢失**：导出的 Markdown 中视频显示为占位符 `[此处为语雀卡片，点击链接查看](about:blank#xxx)`
2. **手动下载**：需要手动下载视频文件
3. **链接替换**：需要手动替换 Markdown 中的视频占位符
4. **重复操作**：每次导出都需要重复上述步骤

本插件自动完成整个流程，让导出变得简单。

## 📦 安装方法

### 方法一：开发者模式安装（推荐）

1. 下载本项目代码
   ```bash
   git clone https://github.com/your-repo/yuque-enhanced-export.git
   cd yuque-enhanced-export
   ```

2. 打开 Chrome 浏览器，进入扩展管理页面
   - 访问 `chrome://extensions/`
   - 或点击右上角 ⋮ → 更多工具 → 扩展程序

3. 启用「开发者模式」（右上角开关）

4. 点击「加载已解压的扩展程序」

5. 选择项目文件夹

### 方法二：Chrome Web Store（待上线）

暂未发布到商店。

## 🚀 使用方法

### 1. 首次使用：设置 Obsidian 仓库

1. 打开任意语雀文档页面
2. 页面标题旁会出现两个按钮：
   - 🟠 **设置 Obsidian 仓库**
   - 🔵 **一键导出到 Obsidian**
3. 点击「设置 Obsidian 仓库」
4. 在弹出的文件选择器中选择你的 Obsidian 仓库文件夹
5. 授予读写权限

> 💡 **提示**：仓库路径会保存在浏览器中，下次使用无需重新设置

### 2. 导出文档

1. 打开要导出的语雀文档
2. 点击「一键导出到 Obsidian」按钮
3. 等待自动执行以下步骤：
   - ✅ 触发语雀导出菜单
   - ✅ 选择 Markdown 格式
   - ✅ 监听浏览器下载
   - ✅ 提取文档中的视频链接
   - ✅ 下载所有视频文件
   - ✅ 替换 Markdown 中的视频占位符
   - ✅ 保存到 Obsidian 仓库
4. 看到「导出完成」提示

### 3. 查看结果

在你的 Obsidian 仓库中会看到：

```
你的仓库/
├── 文档标题.md          # Markdown 文件
└── videos/              # 视频文件夹
    ├── SB2px.mp4
    ├── f78vB.mp4
    └── ...
```

Markdown 中的视频占位符已被替换为：
```markdown
![video](videos/SB2px.mp4)
```

## 🔧 技术实现

### 核心技术

- **File System Access API**：直接访问本地文件系统，无需下载管理
- **Chrome Downloads API**：监听浏览器下载事件
- **DOM 自动化**：模拟用户操作，自动化导出流程
- **Port 分块传输**：通过 `chrome.runtime.connect()` 建立长连接，将视频数据分块（4MB/块）传输，突破消息大小限制
- **Background Script 代理下载**：在 Background Service Worker 中执行 fetch 请求，绕过 Content Script 的 CORS 限制

### 工作流程

```
用户点击导出按钮
        ↓
1. 查找左侧目录中选中的文档
        ↓
2. 模拟鼠标悬停，显示操作按钮
        ↓
3. 点击"三个点"按钮
        ↓
4. 点击"导出..."菜单项
        ↓
5. 选择 Markdown 格式
        ↓
6. 点击"导出"按钮
        ↓
7. Background Script 监听浏览器下载
        ↓
8. 等待下载完成
        ↓
9. 获取下载文件的 URL
        ↓
10. 从 URL 读取 Markdown 内容
        ↓
11. 扫描 DOM 收集视频卡片
        ↓
12. 替换 Markdown 中的视频占位符
        ↓
13. 保存 Markdown 到 Obsidian
        ↓
14. 逐个下载视频文件（通过 Background Script 代理，绕过 CORS）
        ↓
15. 通过 Port 分块传输视频数据（4MB/块，Base64 编码）
        ↓
16. Content Script 接收并拼装视频文件
        ↓
17. 保存视频到 videos/ 目录（单个失败不中断流程）
        ↓
✅ 完成（汇总报告成功/失败数量）
```

### 关键挑战与解决方案

| 挑战 | 解决方案 |
|------|----------|
| 语雀的"导出"按钮需要鼠标悬停才显示 | 模拟 `mouseenter` 事件显示按钮 |
| 语雀触发浏览器直接下载，页面无下载链接 | 使用 Downloads API 监听下载事件 |
| Content Script 无法直接访问 Downloads API | 通过消息传递与 Background Script 通信 |
| 视频 URL 带认证参数，有时效性 | 立即下载，不延迟处理 |
| File System Access API 权限持久化 | 使用 IndexedDB 保存文件句柄 |
| 视频托管在第三方 CDN（阿里云 OSS / 淘宝），Content Script 受 CORS 限制 | 通过 Background Script 代理下载，配合 `host_permissions` 声明跨域权限 |
| Chrome 消息传递有 64MiB 大小限制，大视频无法通过 `sendResponse` 返回 | 使用 `chrome.runtime.connect()` Port 长连接分块传输（4MB/块，Base64 编码） |
| 单个视频下载失败导致整个导出流程中断 | 为每个视频下载添加 try/catch 容错，失败后继续处理剩余视频 |

## 🐛 常见问题

### Q1: 点击导出按钮后没有反应？

**可能原因：**
- 未设置 Obsidian 仓库
- 权限已过期

**解决方法：**
1. 检查是否已点击「设置 Obsidian 仓库」
2. 如果已设置，点击「重置 Obsidian 仓库」重新设置
3. 确保授予了读写权限

### Q2: 提示"未找到语雀的导出菜单按钮"？

**可能原因：**
- 页面未完全加载
- 左侧目录未显示
- 文档权限不足

**解决方法：**
1. 刷新页面后重试
2. 确保左侧目录可见
3. 确认当前账号有导出权限

### Q3: 导出的文档只有几行，内容不完整？

**可能原因：**
- 误抓取了错误的下载链接
- 下载的是 ZIP 文件但插件未处理

**解决方法：**
1. 检查控制台日志，查看下载的 URL
2. 如果是 ZIP 文件，暂时需要手动解压

### Q4: 视频没有下载？

**可能原因：**
- 视频链接已过期（OSS 签名 URL 有时效限制）
- 网络问题
- CDN 服务器临时故障

**解决方法：**
1. **刷新语雀页面**重新获取新的签名 URL，然后再次导出
2. 查看控制台日志，确认是否找到视频
3. 检查 `[Download]` 和 `[Background]` 标签的日志输出
4. 注意：单个视频下载失败不会影响其他视频，失败的视频会在导出完成后汇总提示

### Q6: 提示"Download failed"或视频下载失败？

**可能原因：**
- 视频 OSS 签名过期（`AccessDenied` 错误）
- CDN 连接被关闭（`ERR_CONNECTION_CLOSED`）

**解决方法：**
1. 刷新语雀页面，让页面重新生成带有效签名的视频 URL
2. 重新点击导出按钮
3. 如果某个视频持续失败，可能是 CDN 服务端问题，稍后重试

### Q5: 提示"语雀导出为ZIP格式"？

**当前限制：**
- 插件暂不支持自动解压 ZIP 文件

**临时方案：**
1. 手动解压下载的 ZIP 文件
2. 将 Markdown 文件拖入浏览器页面处理

## 📊 调试信息

插件提供了详细的控制台日志，按 `F12` 打开开发者工具查看：

### 日志标签说明

- `[Main]` - 主导出流程
- `[Export]` - 语雀自动导出
- `[Download]` - 视频下载（分块传输进度）
- `[Background]` - Background Script（视频代理下载、分块发送）
- `[Video]` - 视频收集
- `[Replace]` - 内容替换
- `[Save]` - 文件保存
- `[Wait]` - 元素等待

### 成功示例

```
[Main] 开始导出到Obsidian流程
[Export] 开始自动导出流程
[Export] ✓ 找到选中的文档项
[Export] ✓ 找到三个点按钮
[Export] ✓ 找到导出菜单项
[Export] ✓ 找到Markdown选项
[Export] ✓ 找到导出确认按钮
[Download] ✓ 收到下载完成通知: 庄永琪.md
[Video] ✓ 收集完成，共 5 个有效视频
[Replace] ✓ 替换完成，共替换 5/5 个占位符
[Save] ✓ 文件已保存: 庄永琪.md
[Download] 接收元数据: 12.34MB, 4 个分块
[Download] 分块 1/4 已接收 (4.00MB)
[Download] 分块 2/4 已接收 (4.00MB)
[Download] 分块 3/4 已接收 (4.00MB)
[Download] 分块 4/4 已接收 (0.34MB)
[Download] ✓ 所有分块接收完毕，总大小: 12.34MB
[Download] ✓ 下载完成: SB2px.mp4, 大小: 12.34MB, 耗时: 2340ms
[Main] ✓✓✓ 导出完成！总耗时: 15.6秒
[Main] 视频: 5/5 成功
```

## 🛠️ 开发说明

### 项目结构

```
gilGAMEsh/
├── manifest.json        # 扩展配置
├── background.js        # Background Service Worker
├── content.js          # Content Script（主要逻辑）
├── icons/              # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # 本文档
```

### 开发环境

- Chrome 浏览器 88+
- 支持 File System Access API
- 支持 Manifest V3

### 本地开发

1. 修改代码后，在扩展管理页面点击刷新图标
2. 打开控制台查看日志
3. 重新加载语雀页面测试

### 添加新功能

1. **修改 content.js**：主要业务逻辑
2. **修改 background.js**：下载监听等后台任务
3. **更新 manifest.json**：如需新权限

## 📝 TODO

- [ ] 支持 ZIP 文件自动解压
- [ ] 支持批量导出（整个知识库）
- [ ] 支持自定义视频链接格式
- [ ] 支持导出历史记录
- [ ] 添加配置页面
- [ ] 支持其他格式（PDF、Word）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 👨‍💻 作者

[Your Name]

## 🙏 致谢

- 感谢语雀团队提供优秀的文档平台
- 感谢 Obsidian 社区的支持

---

**⭐ 如果觉得有用，请给个 Star！**
