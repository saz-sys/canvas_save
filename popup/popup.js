// Popup script for user interaction

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  const statusText = statusEl.querySelector('.status-text');

  let isCapturing = false;

  // Update status display
  function setStatus(state, message) {
    statusEl.className = 'status ' + state;
    statusText.textContent = message;
  }

  // Check if current tab is Gemini
  async function checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) {
        setStatus('error', 'タブを取得できません');
        saveBtn.disabled = true;
        return;
      }

      if (!tab.url.includes('gemini.google.com')) {
        setStatus('error', 'Gemini ページではありません');
        saveBtn.disabled = true;
        return;
      }

      setStatus('ready', '準備完了');
      saveBtn.disabled = false;

    } catch (error) {
      console.error('[Canvas Saver] Error:', error);
      setStatus('error', 'エラーが発生しました');
      saveBtn.disabled = true;
    }
  }

  // Handle save button click
  saveBtn.addEventListener('click', async () => {
    if (isCapturing) return;

    isCapturing = true;
    saveBtn.disabled = true;
    setStatus('capturing', 'キャプチャ中...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('タブを取得できません');
      }

      // Execute in all frames, the script will check if it's the right frame
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: captureInIframe,
        world: 'MAIN'
      });

      // Find the successful result from the canvas iframe
      let captureResult = null;
      for (const result of results) {
        if (result.result && result.result.success && result.result.dataUrl) {
          captureResult = result.result;
          break;
        }
      }

      if (captureResult) {
        // Send to service worker for download
        chrome.runtime.sendMessage({
          action: 'download',
          dataUrl: captureResult.dataUrl
        });
        setStatus('success', '保存しました');
        setTimeout(() => window.close(), 1500);
      } else {
        // Check for errors
        const errors = results
          .filter(r => r.result && r.result.error)
          .map(r => r.result.error);

        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        } else {
          throw new Error('Canvas が見つかりませんでした');
        }
      }

    } catch (error) {
      console.error('[Canvas Saver] Error:', error);
      setStatus('error', error.message || 'キャプチャに失敗しました');
      isCapturing = false;
      saveBtn.disabled = false;
    }
  });

  // This function will be injected into all frames
  function captureInIframe() {
    const currentUrl = window.location.href;

    // Only capture in scf.usercontent.goog frames
    if (!currentUrl.includes('scf.usercontent.goog')) {
      return { skip: true };
    }

    // Return a promise-like structure for async operation
    return new Promise(async (resolve) => {
      try {
        // Load html2canvas if not available
        if (typeof html2canvas === 'undefined') {
          await new Promise((res, rej) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = res;
            script.onerror = () => rej(new Error('Failed to load html2canvas'));
            document.head.appendChild(script);
          });
        }

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

        const dataUrl = canvas.toDataURL('image/png');
        resolve({ success: true, dataUrl: dataUrl });

      } catch (error) {
        console.error('[Canvas Saver] Error in iframe:', error);
        resolve({ success: false, error: error.message || 'Unknown error' });
      }
    });
  }

  // Initialize
  checkCurrentTab();
});
