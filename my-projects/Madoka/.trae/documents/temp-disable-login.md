# 临时取消登录页面功能

## 需求
暂时取消登录页面功能，直接使用指定的 API Key。

## 修改方案

### 方案1：恢复硬编码 API Key（推荐）
将 `src/shared/types.ts` 中的默认 API Key 设置为指定值。

```typescript
export const DEFAULT_CONFIG: AppConfig = {
  apiKey: 'sk-d04eac4a9768419ba8960efe0e3f78ab',
  // ... 其他配置
}
```

### 方案2：修改 App.tsx 跳过检查
注释掉 App.tsx 中的 API Key 检查逻辑，直接显示主界面。

```typescript
function AppContent() {
  // const { config, loading } = useSettings()
  
  // 暂时跳过 API Key 检查
  // if (!config.apiKey) {
  //   return <ApiKeySetup />
  // }
  
  return (
    // 正常界面
  )
}
```

## 推荐方案

采用**方案1**，简单直接，恢复原来的行为。

## 实施步骤

1. 修改 `src/shared/types.ts`，将 `apiKey` 默认值改为指定值
2. （可选）保留 ApiKeySetup 组件代码，方便以后重新启用
3. 构建测试

## 回滚方案

需要重新启用登录功能时：
1. 将 `apiKey` 默认值改回空字符串 `''`
2. 确保 App.tsx 中的检查逻辑正常
