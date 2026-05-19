# 记忆系统测试指南

本文档描述如何检测记忆系统是否正常工作。

---

## 一、环境准备

### 1.1 加载扩展
1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择项目的 `dist` 目录

### 1.2 打开开发者工具
- 点击扩展图标打开侧边栏
- 右键侧边栏 → 检查，打开 DevTools

---

## 二、基础功能测试

### 2.1 测试 IndexedDB 是否正常初始化

在 DevTools Console 中执行：

```javascript
// 检查 IndexedDB 中是否创建了 MadokaMemory 数据库
indexedDB.databases().then(dbs => {
  const madokaDb = dbs.find(db => db.name === 'MadokaMemory');
  console.log('MadokaMemory 数据库:', madokaDb ? '✅ 存在' : '❌ 不存在');
});
```

预期结果：显示 `MadokaMemory 数据库: ✅ 存在`

### 2.2 测试记忆设置读写

```javascript
// 获取当前记忆设置
chrome.runtime.sendMessage({ action: 'memoryGetSettings' }, (res) => {
  console.log('记忆设置:', res);
  console.log('enabled:', res.enabled ? '✅ 启用' : '❌ 禁用');
  console.log('userProfileEnabled:', res.userProfileEnabled ? '✅ 启用' : '❌ 禁用');
  console.log('obsidianSyncEnabled:', res.obsidianSyncEnabled ? '✅ 启用' : '❌ 禁用');
});
```

预期结果：返回包含 `enabled`, `userProfileEnabled`, `obsidianSyncEnabled` 等字段的对象

### 2.3 测试添加记忆

```javascript
// 添加一条测试记忆
chrome.runtime.sendMessage({
  action: 'memoryAddEpisode',
  payload: {
    conversationId: 'test-conv-' + Date.now(),
    userContent: '我喜欢编程，正在学习 TypeScript',
    assistantContent: '很高兴认识你！我会记住你喜欢编程和学习 TypeScript。',
    tags: {
      shouldPersist: true,
      summary: '用户喜欢编程，学习 TypeScript',
      topics: ['编程', 'TypeScript'],
      memoryType: 'long',
      block: '技术学习'
    }
  }
}, (res) => {
  console.log('添加记忆结果:', res);
  console.log('uid:', res.uid ? '✅ ' + res.uid : '❌ 无 uid');
});
```

预期结果：返回 `{ uid: 'ep-xxx-xxx' }` 格式的对象

### 2.4 测试获取所有记忆

```javascript
// 获取所有记忆
chrome.runtime.sendMessage({ action: 'memoryGetAll' }, (res) => {
  console.log('记忆总数:', res.episodes?.length ?? 0);
  if (res.episodes?.length > 0) {
    console.log('最新记忆:', res.episodes[0]);
  }
});
```

预期结果：返回 `{ episodes: [...] }` 数组

### 2.5 测试记忆查询

```javascript
// 查询记忆
chrome.runtime.sendMessage({
  action: 'memoryQuery',
  blocks: ['技术学习'],
  limit: 5
}, (res) => {
  console.log('查询结果:', res.episodes?.length ?? 0, '条');
});
```

预期结果：返回匹配的记忆数组

### 2.6 测试删除记忆

```javascript
// 先获取一条记忆的 uid
chrome.runtime.sendMessage({ action: 'memoryGetAll' }, (res) => {
  if (res.episodes?.length > 0) {
    const uid = res.episodes[0].uid;
    chrome.runtime.sendMessage({ action: 'memoryDelete', uid }, (delRes) => {
      console.log('删除结果:', delRes.success ? '✅ 成功' : '❌ 失败');
    });
  }
});
```

---

## 三、用户画像测试

### 3.1 获取用户画像

```javascript
chrome.runtime.sendMessage({ action: 'memoryGetUserProfile' }, (res) => {
  console.log('用户画像:', res.profile);
  if (res.profile) {
    console.log('最后更新:', new Date(res.profile.updatedAt).toLocaleString());
  }
});
```

### 3.2 保存用户画像

```javascript
chrome.runtime.sendMessage({
  action: 'memorySaveUserProfile',
  profile: {
    updatedAt: Date.now(),
    基本信息: { 身份: ['开发者'] },
    喜欢什么: { 喜欢的内容: ['编程', '技术文章'] }
  }
}, (res) => {
  console.log('保存画像:', res.success ? '✅ 成功' : '❌ 失败');
});
```

---

## 四、清理功能测试

### 4.1 获取清理日志

```javascript
chrome.runtime.sendMessage({ action: 'memoryGetCleanupLogs', limit: 10 }, (res) => {
  console.log('清理日志:', res.logs);
});
```

### 4.2 手动执行清理

```javascript
chrome.runtime.sendMessage({ action: 'memoryRunCleanup' }, (res) => {
  console.log('清理结果: 删除', res.deleted, '条记忆');
  console.log('被删除的 uid:', res.uids);
});
```

---

## 五、UI 入口测试

### 5.1 侧边栏记忆按钮
1. 打开扩展侧边栏
2. 点击左上角菜单图标展开侧边栏
3. 检查底部是否有「记忆管理」按钮

### 5.2 设置页面记忆选项
1. 点击侧边栏底部「Settings」按钮
2. 滚动到底部
3. 检查是否有「记忆系统」区块，包含：
   - 启用记忆开关
   - 用户画像开关
   - Obsidian 同步开关
   - 保存记忆设置按钮

### 5.3 记忆管理页面
1. 点击侧边栏「记忆管理」按钮
2. 检查是否显示记忆列表或「暂无记忆」提示
3. 切换到「人物画像」标签页

---

## 六、完整功能链测试

### 6.1 对话触发记忆保存

1. 确保设置中「启用记忆」已开启
2. 在对话中发送一条包含个人信息的消息，如：
   > "我叫小明，今年25岁，是一名前端工程师，喜欢用 React"
3. 查看控制台是否有记忆相关日志
4. 进入「记忆管理」页面，检查是否有新记忆

### 6.2 记忆权重衰减测试

```javascript
// 检查记忆权重计算
chrome.runtime.sendMessage({ action: 'memoryGetAll' }, (res) => {
  res.episodes?.forEach(ep => {
    const daysSinceAccess = (Date.now() - ep.lastAccessed) / (1000 * 60 * 60 * 24);
    console.log(`记忆 ${ep.uid.slice(0, 15)}... 权重=${ep.weight.toFixed(3)} 距上次访问=${daysSinceAccess.toFixed(1)}天`);
  });
});
```

---

## 七、常见问题排查

### 7.1 记忆不保存
- 检查设置中「启用记忆」是否开启
- 检查 IndexedDB 是否正常创建
- 查看 Console 是否有错误日志

### 7.2 画像不更新
- 检查设置中「用户画像」是否开启
- 确认对话中有可提取的个人信息

### 7.3 Obsidian 同步失败
- 检查设置中「Obsidian 同步」是否开启
- 确认已授予文件系统访问权限
- 查看 Console 中的同步错误信息

---

## 八、自动化测试脚本

将以下脚本粘贴到 Console 一次性执行所有基础测试：

```javascript
(async function testMemorySystem() {
  console.log('========== 记忆系统测试开始 ==========');
  
  // 1. 测试数据库
  const dbs = await indexedDB.databases();
  const dbExists = dbs.some(db => db.name === 'MadokaMemory');
  console.log('1. IndexedDB:', dbExists ? '✅' : '❌');
  
  // 2. 测试设置
  const settings = await new Promise(r => chrome.runtime.sendMessage({ action: 'memoryGetSettings' }, r));
  console.log('2. 记忆设置:', settings.enabled !== undefined ? '✅' : '❌', settings);
  
  // 3. 测试添加记忆
  const addRes = await new Promise(r => chrome.runtime.sendMessage({
    action: 'memoryAddEpisode',
    payload: {
      conversationId: 'test-' + Date.now(),
      userContent: '测试内容',
      assistantContent: '测试回复',
      tags: { shouldPersist: true, summary: '测试记忆' }
    }
  }, r));
  console.log('3. 添加记忆:', addRes.uid ? '✅' : '❌', addRes.uid);
  
  // 4. 测试获取记忆
  const allRes = await new Promise(r => chrome.runtime.sendMessage({ action: 'memoryGetAll' }, r));
  console.log('4. 获取记忆:', allRes.episodes ? '✅' : '❌', '共', allRes.episodes?.length, '条');
  
  // 5. 测试用户画像
  const profileRes = await new Promise(r => chrome.runtime.sendMessage({ action: 'memoryGetUserProfile' }, r));
  console.log('5. 用户画像:', profileRes.profile !== undefined ? '✅' : '❌');
  
  // 6. 测试清理日志
  const logsRes = await new Promise(r => chrome.runtime.sendMessage({ action: 'memoryGetCleanupLogs', limit: 5 }, r));
  console.log('6. 清理日志:', logsRes.logs ? '✅' : '❌', '共', logsRes.logs?.length, '条');
  
  console.log('========== 记忆系统测试完成 ==========');
})();
```

预期输出：
```
========== 记忆系统测试开始 ==========
1. IndexedDB: ✅
2. 记忆设置: ✅ {enabled: true, userProfileEnabled: true, ...}
3. 添加记忆: ✅ ep-xxx-xxx
4. 获取记忆: ✅ 共 N 条
5. 用户画像: ✅
6. 清理日志: ✅ 共 N 条
========== 记忆系统测试完成 ==========
```

---

## 九、测试清单汇总

| 测试项 | 测试方法 | 预期结果 |
|--------|----------|----------|
| IndexedDB 初始化 | `indexedDB.databases()` | 存在 MadokaMemory |
| 记忆设置读取 | `memoryGetSettings` | 返回设置对象 |
| 添加记忆 | `memoryAddEpisode` | 返回 uid |
| 获取记忆列表 | `memoryGetAll` | 返回 episodes 数组 |
| 查询记忆 | `memoryQuery` | 返回匹配结果 |
| 删除记忆 | `memoryDelete` | success: true |
| 用户画像读取 | `memoryGetUserProfile` | 返回 profile |
| 用户画像保存 | `memorySaveUserProfile` | success: true |
| 清理日志 | `memoryGetCleanupLogs` | 返回 logs 数组 |
| 手动清理 | `memoryRunCleanup` | 返回 deleted 数量 |
| 侧边栏记忆按钮 | UI 检查 | 显示「记忆管理」按钮 |
| 设置页记忆选项 | UI 检查 | 显示记忆系统设置区块 |
| 记忆管理页面 | UI 检查 | 显示记忆列表/画像 |
