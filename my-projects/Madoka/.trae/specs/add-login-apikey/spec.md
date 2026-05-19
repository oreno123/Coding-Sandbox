# 添加登录页面和 API Key 设置 Spec

## Why

首次使用 Madoka 时，用户需要提供通义千问的 API Key 才能正常使用 AI 功能。需要一个登录/设置页面来引导用户完成初始化配置。

## What Changes

- **新增登录页面组件**：首次使用时显示，要求输入 API Key
- **API Key 存储**：安全存储到 Chrome 存储中
- **首次使用检测**：检查是否已配置 API Key
- **设置页面入口**：允许用户后续修改 API Key
- **API Key 验证**：可选的验证功能确保 Key 有效

## Impact

- Affected specs: 用户初始化流程、设置系统
- Affected code:
  - `src/sidepanel/components/LoginPage.tsx` - 新建
  - `src/sidepanel/App.tsx` - 添加首次使用检测
  - `src/background/config.ts` - API Key 存储和读取
  - `src/sidepanel/components/SettingsPanel.tsx` - 添加 API Key 设置项

## ADDED Requirements

### Requirement: 登录页面组件

The system SHALL provide a login page for first-time users to configure their API Key.

#### Scenario: First-time user opens extension
- **GIVEN** 用户首次安装并打开扩展
- **WHEN** 没有配置 API Key
- **THEN** 显示登录页面，要求输入通义千问 API Key
- **AND** 提供 API Key 获取方式的链接/说明

#### Scenario: User enters API Key
- **GIVEN** 用户在登录页面
- **WHEN** 输入有效的 API Key 并点击保存
- **THEN** 保存 API Key 到 Chrome 存储
- **AND** 跳转到主界面

#### Scenario: Invalid API Key
- **GIVEN** 用户输入了 API Key
- **WHEN** API Key 格式不正确或验证失败
- **THEN** 显示错误提示
- **AND** 不允许进入主界面

### Requirement: API Key 存储和管理

The system SHALL securely store and manage the API Key.

#### Scenario: Store API Key
- **GIVEN** 用户输入了 API Key
- **WHEN** 点击保存
- **THEN** 使用 Chrome storage.sync 或 storage.local 存储
- **AND** 标记已配置状态

#### Scenario: Retrieve API Key
- **GIVEN** 扩展需要调用 AI API
- **WHEN** 发送请求时
- **THEN** 从存储中读取 API Key
- **AND** 添加到请求头中

#### Scenario: Update API Key
- **GIVEN** 用户在设置页面
- **WHEN** 修改 API Key 并保存
- **THEN** 更新存储的 API Key
- **AND** 立即生效

### Requirement: 首次使用检测

The system SHALL detect if the user has configured the API Key.

#### Scenario: Check configuration on startup
- **GIVEN** 用户打开侧边栏
- **WHEN** 初始化时
- **THEN** 检查是否已配置 API Key
- **AND** 如未配置，显示登录页面
- **AND** 如已配置，显示主界面

### Requirement: 设置页面集成

The system SHALL allow users to view and modify API Key in settings.

#### Scenario: View current API Key
- **GIVEN** 用户在设置页面
- **WHEN** 查看 API 设置部分
- **THEN** 显示当前 API Key（部分隐藏，如 sk-xxx...xxx）
- **AND** 提供显示/隐藏按钮

#### Scenario: Change API Key
- **GIVEN** 用户在设置页面
- **WHEN** 输入新的 API Key 并保存
- **THEN** 更新存储
- **AND** 显示保存成功提示

## MODIFIED Requirements

### Requirement: API Request Authentication

**Current**: API Key 从 config.ts 的常量读取

**Modified**: API Key 从 Chrome storage 动态读取

## REMOVED Requirements

None
