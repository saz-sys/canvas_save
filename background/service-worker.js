// Service worker for handling downloads

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    downloadImage(request.dataUrl);
    sendResponse({ status: 'downloading' });
  } else if (request.action === 'captureError') {
    // Forward error to popup if it's listening
    chrome.runtime.sendMessage({
      action: 'captureError',
      error: request.error
    }).catch(() => {
      // Popup might be closed, ignore error
    });
  }
  return true;
});

function downloadImage(dataUrl) {
  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, -5); // Remove milliseconds and Z

  const filename = `gemini_canvas_${timestamp}.png`;

  // Download the image
  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false // Auto-save without dialog
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Download failed:', chrome.runtime.lastError);
      chrome.runtime.sendMessage({
        action: 'downloadError',
        error: chrome.runtime.lastError.message
      }).catch(() => {});
    } else {
      chrome.runtime.sendMessage({
        action: 'downloadSuccess',
        downloadId: downloadId,
        filename: filename
      }).catch(() => {});
    }
  });
}
