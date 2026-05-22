/**
 * Background Service Worker
 * 处理插件级别的事件和消息
 */

// 监听图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    console.log('✅ 侧边栏已打开');
  } catch (error) {
    console.error('❌ 打开侧边栏失败:', error);
  }
});

// 监听标签页变化
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log(`📄 标签页已切换: ${activeInfo.tabId}`);
});

// 监听内容脚本安装
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎯 Anlo 插件已安装');
  } else if (details.reason === 'update') {
    console.log('🔄 Anlo 插件已更新');
  }
});

// 配置侧边栏行为
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
  console.error('❌ 配置侧边栏失败:', error);
});

console.log('🎯 Anlo 后台服务已启动');

export {};

