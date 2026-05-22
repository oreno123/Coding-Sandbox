/**
 * Madoka PDF Viewer - Screenshot Handler
 * 与普通网页 content script 的 region-selector 逻辑一致
 * 监听 showRegionSelector / cropScreenshot 消息，执行区域选择与裁剪
 */

(function () {
  'use strict';

  function showRegionSelector() {
    return new Promise(function (resolve, reject) {
      var overlay = document.createElement('div');
      overlay.id = 'madoka-region-selector-overlay';
      overlay.style.cssText =
        'position: fixed; inset: 0; z-index: 2147483647; cursor: crosshair; background: rgba(0,0,0,0.35); user-select: none;';

      var hint = document.createElement('div');
      hint.textContent = '拖拽选择截图区域，左键松开后右键确认 / Esc 取消';
      hint.style.cssText =
        'position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-family: system-ui, -apple-system, sans-serif; z-index: 2147483648; pointer-events: none;';

      var selectionBox = document.createElement('div');
      selectionBox.style.cssText =
        'position: fixed; border: 2px solid #3b82f6; background: rgba(59, 130, 246, 0.15); pointer-events: none; z-index: 2147483647; display: none;';

      overlay.appendChild(hint);
      overlay.appendChild(selectionBox);
      document.body.appendChild(overlay);

      var startX = 0;
      var startY = 0;
      var isSelecting = false;

      function finish() {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') {
          finish();
          reject(new Error('用户取消'));
        }
      }

      function tryConfirm() {
        var rect = selectionBox.getBoundingClientRect();
        if (rect.width > 2 && rect.height > 2) {
          finish();
          resolve({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          });
        }
      }

      overlay.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
      });

      overlay.addEventListener('mousemove', function (e) {
        if (!isSelecting) return;
        var x = Math.min(startX, e.clientX);
        var y = Math.min(startY, e.clientY);
        var w = Math.abs(e.clientX - startX);
        var h = Math.abs(e.clientY - startY);
        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = w + 'px';
        selectionBox.style.height = h + 'px';
      });

      var selectionDone = false;

      overlay.addEventListener('mouseup', function () {
        if (!isSelecting) return;
        isSelecting = false;
        var rect = selectionBox.getBoundingClientRect();
        if (rect.width > 2 && rect.height > 2) {
          selectionDone = true;
          hint.textContent = '右键确认 / Esc 取消';
        }
      });

      overlay.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (selectionDone) tryConfirm();
      });

      document.addEventListener('keydown', onKeyDown);
    });
  }

  function cropScreenshot(dataUrl, rect) {
    return new Promise(function (resolve, reject) {
      var scale = window.devicePixelRatio || 1;
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = rect.width * scale;
        canvas.height = rect.height * scale;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 Canvas 上下文'));
          return;
        }
        ctx.drawImage(
          img,
          rect.left * scale,
          rect.top * scale,
          rect.width * scale,
          rect.height * scale,
          0,
          0,
          rect.width * scale,
          rect.height * scale
        );
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = function () {
        reject(new Error('图片加载失败'));
      };
      img.src = dataUrl;
    });
  }

  chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
    if (request.action === 'showRegionSelector') {
      showRegionSelector()
        .then(function (rect) {
          chrome.runtime.sendMessage({ action: 'regionSelected', rect: rect });
        })
        .catch(function (e) {
          chrome.runtime.sendMessage({
            action: 'regionSelectorCancelled',
            error: e.message,
          });
        });
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'cropScreenshot') {
      cropScreenshot(request.dataUrl, request.rect)
        .then(function (dataUrl) {
          chrome.runtime.sendMessage({ action: 'croppedScreenshot', dataUrl: dataUrl });
        })
        .catch(function (e) {
          chrome.runtime.sendMessage({
            action: 'croppedScreenshotError',
            error: e.message,
          });
        });
      sendResponse({ success: true });
      return true;
    }

    return false;
  });
})();
