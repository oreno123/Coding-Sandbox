# 语雀 MCP 服务器部署问题修复计划

## 问题描述

在服务器上部署语雀 MCP 时使用 `mcp-proxy` 出现参数类型错误：
```
TypeError [ERR_INVALID_ARG_TYPE]: The "args" argument must be of type object. Received type string ('dist/index.js')
```

## 问题分析

`mcp-proxy` 的 `--args` 参数需要接收 JSON 数组格式，但用户传递的是普通字符串 `"dist/index.js"`。

## 解决方案

### 方案 1: 修正 args 参数格式（推荐）

将 `--args` 参数改为 JSON 数组格式：

```bash
mcp-proxy \
  --command "node" \
  --args '["dist/index.js"]' \
  --port 3000
```

注意：使用单引号包裹 JSON 数组，防止 shell 转义。

### 方案 2: 使用环境变量方式

如果方案 1 仍然报错，尝试使用环境变量传递参数：

```bash
mcp-proxy \
  --command "node" \
  --args "[\"dist/index.js\"]" \
  --port 3000
```

### 方案 3: 直接运行（不使用 mcp-proxy）

如果语雀 MCP 本身支持 HTTP 模式，可以直接运行：

```bash
# 先检查 yuque-mcp 是否支持 HTTP 模式
node dist/index.js --help

# 或者查看 package.json 中的启动脚本
cat package.json | grep -A 5 '"scripts"'
```

### 方案 4: 使用 npx 运行（如果支持）

```bash
npx yuque-mcp
```

### 方案 5: 检查 mcp-proxy 版本

可能是版本兼容性问题：

```bash
# 查看版本
mcp-proxy --version

# 更新到最新版本
npm install -g mcp-proxy@latest
```

## 验证步骤

1. 首先尝试方案 1 的修正命令
2. 检查端口 3000 是否被占用：`netstat -tlnp | grep 3000`
3. 确认 `dist/index.js` 文件存在：`ls -la dist/`
4. 查看 mcp-proxy 帮助文档：`mcp-proxy --help`

## 预期结果

修复后，语雀 MCP 服务器应该能在 `http://localhost:3000` 上运行，然后可以在 Madoka 扩展中配置：
- URL: `http://your-server-ip:3000/mcp`
- 认证: Bearer Token（语雀 Token）

## 备选方案

如果 mcp-proxy 持续报错，可以考虑：

1. 使用其他 MCP 代理工具，如 `mcp-transport` 或 `supergateway`
2. 修改语雀 MCP 源码，添加原生 HTTP 支持
3. 使用 Smithery 等托管服务
