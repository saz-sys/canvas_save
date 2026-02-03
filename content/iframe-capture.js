// This script is injected into the iframe to capture content
// It will be executed via chrome.scripting.executeScript

(async function() {
  'use strict';

  console.log('[Canvas Saver] Capture script injected into iframe');

  try {
    // Load html2canvas dynamically
    if (typeof html2canvas === 'undefined') {
      console.log('[Canvas Saver] Loading html2canvas...');
      await loadHtml2Canvas();
    }

    console.log('[Canvas Saver] html2canvas ready, starting capture...');

    // Get full document dimensions
    const docElement = document.documentElement;
    const body = document.body;

    const fullWidth = Math.max(
      docElement.scrollWidth || 0,
      docElement.offsetWidth || 0,
      docElement.clientWidth || 0,
      body ? body.scrollWidth : 0,
      body ? body.offsetWidth : 0
    );

    const fullHeight = Math.max(
      docElement.scrollHeight || 0,
      docElement.offsetHeight || 0,
      docElement.clientHeight || 0,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    );

    console.log('[Canvas Saver] Capture dimensions:', fullWidth, 'x', fullHeight);

    // Capture using html2canvas
    const canvas = await html2canvas(docElement, {
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: fullWidth,
      windowHeight: fullHeight,
      width: fullWidth,
      height: fullHeight,
      x: 0,
      y: 0,
      logging: true,
      imageTimeout: 15000,
      removeContainer: true
    });

    console.log('[Canvas Saver] Capture complete, canvas size:', canvas.width, 'x', canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    console.log('[Canvas Saver] DataURL length:', dataUrl.length);

    // Return the result
    return { success: true, dataUrl: dataUrl };

  } catch (error) {
    console.error('[Canvas Saver] Capture error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }

  async function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => {
        console.log('[Canvas Saver] html2canvas loaded from CDN');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load html2canvas'));
      document.head.appendChild(script);
    });
  }
})();
