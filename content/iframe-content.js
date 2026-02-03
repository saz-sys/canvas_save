// Content script for iframe (*.scf.usercontent.goog)
// Executes html2canvas to capture full content including scrollable areas

(function() {
  'use strict';

  console.log('[Canvas Saver] iframe-content.js loaded in:', window.location.href);

  // Listen for capture request from parent
  window.addEventListener('message', async (event) => {
    console.log('[Canvas Saver] iframe received message:', event.data);
    if (event.data && event.data.type === 'CAPTURE_REQUEST') {
      console.log('[Canvas Saver] Starting capture...');
      try {
        await captureFullContent();
      } catch (error) {
        console.error('[Canvas Saver] Capture error:', error);
        parent.postMessage({
          type: 'CAPTURE_ERROR',
          error: error.message || 'Unknown error during capture'
        }, '*');
      }
    }
  });

  async function captureFullContent() {
    console.log('[Canvas Saver] html2canvas available:', typeof html2canvas !== 'undefined');

    // Check if html2canvas is available
    if (typeof html2canvas === 'undefined') {
      throw new Error('html2canvas library not loaded');
    }

    // Get full document dimensions (including scroll areas)
    const docElement = document.documentElement;
    const body = document.body;

    const fullWidth = Math.max(
      docElement.scrollWidth,
      docElement.offsetWidth,
      docElement.clientWidth,
      body ? body.scrollWidth : 0,
      body ? body.offsetWidth : 0
    );

    const fullHeight = Math.max(
      docElement.scrollHeight,
      docElement.offsetHeight,
      docElement.clientHeight,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    );

    console.log('[Canvas Saver] Capture dimensions:', fullWidth, 'x', fullHeight);

    // Capture using html2canvas with full dimensions
    console.log('[Canvas Saver] Calling html2canvas...');
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
      logging: true,  // Enable html2canvas logging
      imageTimeout: 15000,
      removeContainer: true
    });

    console.log('[Canvas Saver] html2canvas completed, canvas size:', canvas.width, 'x', canvas.height);

    // Convert to data URL and send to parent
    const dataUrl = canvas.toDataURL('image/png');
    console.log('[Canvas Saver] DataURL length:', dataUrl.length);

    console.log('[Canvas Saver] Sending CAPTURE_RESULT to parent');
    parent.postMessage({
      type: 'CAPTURE_RESULT',
      dataUrl: dataUrl
    }, '*');
  }
})();
