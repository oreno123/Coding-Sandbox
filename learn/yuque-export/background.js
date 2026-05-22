/**
 * Background Service Worker
 * Minimal implementation for Yuque Enhanced Export
 * Main logic is in content.js using File System Access API
 */

// Handle installation/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Yuque Enhanced Export: Extension installed");
  } else if (details.reason === "update") {
    console.log("Yuque Enhanced Export: Extension updated");
  }
});

// Store download monitoring state
let downloadMonitor = null;

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Received message:", request.action);

  // Start monitoring downloads
  if (request.action === "startDownloadMonitor") {
    console.log("[Background] Starting download monitor...");

    // Remove existing listener if any
    if (downloadMonitor) {
      chrome.downloads.onCreated.removeListener(downloadMonitor);
    }

    // Create new monitor
    downloadMonitor = (downloadItem) => {
      console.log("[Background] Download detected:", downloadItem.filename);

      // Check if it's a Yuque export file
      const filename = downloadItem.filename.toLowerCase();
      if (
        filename.endsWith(".zip") ||
        filename.endsWith(".md") ||
        downloadItem.url.includes("yuque.com") ||
        downloadItem.url.includes("aliyuncs.com")
      ) {
        console.log(
          "[Background] Yuque export file detected, notifying content script",
        );

        // Wait for download to complete
        waitForDownloadComplete(downloadItem.id)
          .then((completedItem) => {
            // Notify content script
            chrome.tabs.sendMessage(sender.tab.id, {
              action: "downloadComplete",
              download: completedItem,
            });
          })
          .catch((error) => {
            chrome.tabs.sendMessage(sender.tab.id, {
              action: "downloadError",
              error: error.message,
            });
          });

        // Remove listener after detecting the file
        chrome.downloads.onCreated.removeListener(downloadMonitor);
        downloadMonitor = null;
      }
    };

    chrome.downloads.onCreated.addListener(downloadMonitor);
    sendResponse({ success: true });
    return true;
  }

  // Stop monitoring downloads
  if (request.action === "stopDownloadMonitor") {
    console.log("[Background] Stopping download monitor");
    if (downloadMonitor) {
      chrome.downloads.onCreated.removeListener(downloadMonitor);
      downloadMonitor = null;
    }
    sendResponse({ success: true });
    return true;
  }

  // Response for video URLs request
  if (request.action === "getVideoUrls") {
    sendResponse({ success: true });
    return true;
  }

  // Response for downloadVideo (actual transfer happens via Port)
  if (request.action === "downloadVideo") {
    sendResponse({ success: true });
    return true;
  }
});

// Handle video download via Port connection (chunked transfer, no size limit)
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "videoDownload") return;

  port.onMessage.addListener(async (msg) => {
    if (msg.action !== "downloadVideo") return;

    const url = msg.url;
    console.log(
      "[Background] Downloading video via Port:",
      url.substring(0, 100) + "...",
    );

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const totalSize = uint8Array.length;
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
      const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

      console.log(
        `[Background] ✓ Video downloaded: ${sizeMB}MB, sending in ${totalChunks} chunks...`,
      );

      // Send metadata first
      port.postMessage({
        type: "meta",
        totalSize: totalSize,
        totalChunks: totalChunks,
        mimeType: blob.type,
      });

      // Send data in chunks (Base64 encoded for safe transfer)
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunk = uint8Array.slice(start, end);

        // Convert chunk to Base64 string for safe message passing
        let binary = "";
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
        const base64Chunk = btoa(binary);

        port.postMessage({
          type: "chunk",
          index: i,
          data: base64Chunk,
        });
      }

      // Signal completion
      port.postMessage({ type: "done" });
      console.log(`[Background] ✓ All ${totalChunks} chunks sent`);
    } catch (error) {
      console.error("[Background] ✗ Download failed:", error);
      port.postMessage({
        type: "error",
        error: error.message,
      });
    }
  });
});

// Helper function to wait for download completion
function waitForDownloadComplete(downloadId) {
  return new Promise((resolve, reject) => {
    console.log("[Background] Waiting for download to complete:", downloadId);

    const checkInterval = setInterval(() => {
      chrome.downloads.search({ id: downloadId }, (results) => {
        if (results.length === 0) {
          clearInterval(checkInterval);
          reject(new Error("Download not found"));
          return;
        }

        const download = results[0];
        console.log(
          `[Background] Download progress: ${download.bytesReceived}/${download.totalBytes}, state: ${download.state}`,
        );

        if (download.state === "complete") {
          clearInterval(checkInterval);
          console.log("[Background] Download complete:", download.filename);
          resolve(download);
        } else if (download.state === "interrupted") {
          clearInterval(checkInterval);
          reject(new Error("Download interrupted: " + download.error));
        }
      });
    }, 500);

    // 60 second timeout
    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error("Download timeout after 60 seconds"));
    }, 60000);
  });
}
