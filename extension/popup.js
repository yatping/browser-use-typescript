document.addEventListener('DOMContentLoaded', function() {
  const userInput = document.getElementById('userInput');
  const submitBtn = document.getElementById('submitBtn');
  const status = document.getElementById('status');

  submitBtn.addEventListener('click', async () => {
    const input = userInput.value.trim();
    if (!input) {
      showStatus('Please enter what you want to do', 'error');
      return;
    }

    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'executeTask',
        input: input,
        tabId: tab.id
      }, response => {
        if (response.success) {
          showStatus('Task started successfully', 'success');
        } else {
          showStatus('Error: ' + response.error, 'error');
        }
      });
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    }
  });

  function showStatus(message, type) {
    status.textContent = message;
    status.className = type;
  }
}); 