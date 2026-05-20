// popup.js - 处理用户交互

// 获取按钮元素
const captureRawBtn = document.getElementById('captureRawBtn');
const captureMergedBtn = document.getElementById('captureMergedBtn');
const captureLLMBtn = document.getElementById('captureLLMBtn');
const captureHumanBtn = document.getElementById('captureHumanBtn');
const statusDiv = document.getElementById('status');

// 禁用所有按钮
function disableButtons() {
  captureRawBtn.disabled = true;
  captureMergedBtn.disabled = true;
  captureLLMBtn.disabled = true;
  captureHumanBtn.disabled = true;
}

// 启用所有按钮
function enableButtons() {
  captureRawBtn.disabled = false;
  captureMergedBtn.disabled = false;
  captureLLMBtn.disabled = false;
  captureHumanBtn.disabled = false;
}

// 更新状态显示
function updateStatus(type, message) {
  statusDiv.className = `status ${type}`;
  statusDiv.textContent = message;
}

// 重置按钮状态
function resetButtons() {
  captureRawBtn.querySelector('.action-title').textContent = 'Download Raw Trees';
  captureMergedBtn.querySelector('.action-title').textContent = 'Download Merged Tree';
  captureLLMBtn.querySelector('.action-title').textContent = 'Download LLM Output';
  captureHumanBtn.querySelector('.action-title').textContent = 'Download Human Readable';
}

// 处理下载原始三棵树
captureRawBtn.addEventListener('click', async () => {
  disableButtons();
  captureRawBtn.querySelector('.action-title').textContent = '⏳ Capturing...';
  
  updateStatus('loading', '📥 Capturing raw trees from current page...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'captureAllTrees'
    });

    if (response.success) {
      const meta = response.data.metadata;
      updateStatus('success', 
        `✅ Raw trees captured successfully!\n` +
        `⏱️ Time: ${meta.capture_time_ms}ms\n` +
        `📄 Documents: ${response.data.snapshot?.documents?.length || 0}`
      );
      
      setTimeout(() => {
        window.close();
      }, 3000);
    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    console.error('Capture failed:', error);
    updateStatus('error', `❌ Failed: ${error.message}`);
    enableButtons();
    resetButtons();
  }
});

// 处理下载合并后的树
captureMergedBtn.addEventListener('click', async () => {
  disableButtons();
  captureMergedBtn.querySelector('.action-title').textContent = '⏳ Merging...';
  
  updateStatus('loading', '🔗 Capturing and merging trees...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'captureMergedTree'
    });

    if (response.success) {
      const meta = response.data.metadata;
      updateStatus('success', 
        `✅ Merged tree created successfully!\n` +
        `⏱️ Fetch: ${meta.tree_fetch_time_ms}ms | Merge: ${meta.merge_time_ms}ms\n` +
        `📊 Snapshot: ${meta.snapshot_entries} | AX: ${meta.ax_tree_entries} entries`
      );
      
      setTimeout(() => {
        window.close();
      }, 3000);
    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    console.error('Merge failed:', error);
    updateStatus('error', `❌ Failed: ${error.message}`);
    enableButtons();
    resetButtons();
  }
});

// 处理下载 LLM Representation
captureLLMBtn.addEventListener('click', async () => {
  disableButtons();
  captureLLMBtn.querySelector('.action-title').textContent = '⏳ Serializing...';
  
  updateStatus('loading', '🤖 Capturing, merging, and serializing for LLM...\nThis includes: filtering, paint order, bbox clipping...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'captureLLMRepresentation'
    });

    if (response.success) {
      const meta = response.data.metadata;
      const stats = meta.stats;
      const timing = meta.timing;
      
      updateStatus('success', 
        `✅ LLM Representation generated!\n` +
        `⏱️ Total: ${timing.total_ms}ms (Fetch: ${timing.fetch_trees_ms}ms)\n` +
        `📊 Nodes: ${stats.total_nodes} → ${stats.interactive_elements} interactive\n` +
        `📝 Output: ${stats.llm_text_lines} lines (${(stats.llm_text_length / 1024).toFixed(1)} KB)`
      );
      
      setTimeout(() => {
        window.close();
      }, 4000);
    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    console.error('LLM serialization failed:', error);
    updateStatus('error', `❌ Failed: ${error.message}`);
    enableButtons();
    resetButtons();
  }
});

// 处理下载人类可读格式
captureHumanBtn.addEventListener('click', async () => {
  disableButtons();
  captureHumanBtn.querySelector('.action-title').textContent = '⏳ Generating...';
  
  updateStatus('loading', '👁️ Generating human-readable Markdown format...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'captureHumanReadable'
    });

    if (response.success) {
      const meta = response.data.metadata;
      const stats = meta.stats;
      
      updateStatus('success', 
        `✅ Human-readable format generated!\n` +
        `📊 Interactive elements: ${stats.interactive_elements}\n` +
        `📝 Markdown: ${stats.markdown_lines} lines (${(stats.markdown_length / 1024).toFixed(1)} KB)`
      );
      
      setTimeout(() => {
        window.close();
      }, 3000);
    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    console.error('Human readable generation failed:', error);
    updateStatus('error', `❌ Failed: ${error.message}`);
    enableButtons();
    resetButtons();
  }
});
