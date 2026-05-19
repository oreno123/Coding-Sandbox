# 更换千问 API Key 计划

## 任务概述
将通义千问的默认 API Key 从 `sk-d04eac4a9768419ba8960efe0e3f78ab` 更换为 `sk-231cde1ada9a4e939768d616105e64ce`

## 需要修改的文件

### 1. src/shared/types.ts
- **位置**: 第 95 行
- **当前值**: `apiKey: "sk-d04eac4a9768419ba8960efe0e3f78ab"`
- **新值**: `apiKey: "sk-231cde1ada9a4e939768d616105e64ce"`

## 实施步骤
1. 修改 `src/shared/types.ts` 中的 `DEFAULT_CONFIG.apiKey` 默认值

## 验证
- 修改后确保新的 API Key 格式正确（以 `sk-` 开头）
- 确保文件语法正确，无编译错误
