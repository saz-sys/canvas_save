// Content script for iframe (*.scf.usercontent.goog)
// Executes html2canvas to capture full content including scrollable areas

(function() {
  'use strict';

  // Listen for capture request from parent
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'CAPTURE_REQUEST') {
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

    // Capture using html2canvas with full dimensions
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

    // Convert to data URL and send to parent
    const dataUrl = canvas.toDataURL('image/png');

    parent.postMessage({
      type: 'CAPTURE_RESULT',
      dataUrl: dataUrl
    }, '*');
  }
})();
