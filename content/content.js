// Content script for parent page (gemini.google.com)
// Detects web-preview iframe and relays messages

(function() {
  'use strict';

  // Listen for capture request from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getIframeUrl') {
      const iframe = findCanvasIframe();
      if (iframe && iframe.src) {
        sendResponse({ iframeUrl: iframe.src });
      } else {
        sendResponse({ iframeUrl: null });
      }
    } else if (request.action === 'captureResult') {
      // Forward result to service worker for download
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
