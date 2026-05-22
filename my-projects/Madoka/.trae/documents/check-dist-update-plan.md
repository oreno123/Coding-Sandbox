# 检查 dist 目录更新状态

## 检查目标

验证 `dist/assets/sidepanel-*.css` 文件是否包含最新的样式修改。

## 检查步骤

### 步骤1：查找生成的 CSS 文件

```bash
ls -la dist/assets/sidepanel-*.css
```

### 步骤2：检查 CSS 文件内容

查找 `.chat-area` 类的定义：

```bash
grep -A 10 "\.chat-area" dist/assets/sidepanel-*.css
```

### 步骤3：验证内容

**预期结果**：
- 应该包含 `.chat-area` 类
- 不应该包含 `max-width:800px` 或 `max-width: 800px`
- 不应该包含 `margin:0 auto` 或 `margin: 0 auto`

**如果看到以下内容，说明已更新**：
```css
.chat-area{display:flex;flex-direction:column;width:100%;height:100%;padding:0 16px}
```

**如果看到以下内容，说明未更新**：
```css
.chat-area{display:flex;flex-direction:column;max-width:800px;width:100%;margin:0 auto;height:100%;padding:0 16px}
```

## 如果 dist 未更新

### 可能原因

1. 构建未成功
2. 构建缓存问题
3. 文件路径错误

### 解决方案

1. **重新构建**
   ```bash
   npm run build
   ```

2. **清除缓存后构建**
   ```bash
   rm -rf dist
   npm run build
   ```

3. **检查构建输出**
   确认构建命令输出中包含 `dist/assets/sidepanel-*.css` 文件

## 验证命令

运行以下命令快速验证：

```bash
# 检查文件是否存在
ls dist/assets/sidepanel-*.css

# 检查是否包含 max-width（如果不输出内容，说明已移除）
grep "max-width:800px" dist/assets/sidepanel-*.css || echo "已移除 max-width 限制 ✓"

# 检查是否包含 margin:0 auto（如果不输出内容，说明已移除）
grep "margin:0 auto" dist/assets/sidepanel-*.css || echo "已移除 margin 居中 ✓"
```
