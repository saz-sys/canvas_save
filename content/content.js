// Content script for parent page (gemini.google.com)
// Detects web-preview iframe and relays messages

(function() {
  'use strict';

  console.log('[Canvas Saver] Content script loaded on parent page');

  // Listen for capture request from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Canvas Saver] Received message:', request);

    if (request.action === 'getIframeUrl') {
      const iframe = findCanvasIframe();
      if (iframe && iframe.src) {
        console.log('[Canvas Saver] Found iframe URL:', iframe.src);
        sendResponse({ iframeUrl: iframe.src });
      } else {
        console.log('[Canvas Saver] No iframe found');
        sendResponse({ iframeUrl: null });
      }
    } else if (request.action === 'captureResult') {
      // Forward result to service worker for download
      console.log('[Canvas Saver] Received capture result, forwarding to service worker');
      chrome.runtime.sendMessage({
        action: 'download',
        dataUrl: request.dataUrl
      });
      sendResponse({ status: 'forwarded' });
    }
    return true;
  });

  // Find the web-preview iframe
  function findCanvasIframe() {
    // Try direct selector first
    let iframe = document.querySelector('web-preview iframe');

    // If not found, try searching within shadow DOMs
    if (!iframe) {
      const webPreview = document.querySelector('web-preview');
      if (webPreview && webPreview.shadowRoot) {
        iframe = webPreview.shadowRoot.querySelector('iframe');
      }
    }

    // Try to find any iframe with scf.usercontent.goog
    if (!iframe) {
      const allIframes = document.querySelectorAll('iframe');
      for (const f of allIframes) {
        if (f.src && f.src.includes('scf.usercontent.goog')) {
          iframe = f;
          break;
        }
      }
    }

    return iframe;
  }
})();
