// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'executeTask') {
    handleTask(request.input, request.tabId)
      .then(response => {
        sendResponse({ success: true, response });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  }
});

async function handleTask(input, tabId) {
  try {
    // TODO: Send input to agent and get actions
    // For now, we'll just demonstrate the communication flow
    const action = {
      type: 'click',
      selector: '#example-button'
    };

    // Execute the action in the content script
    const result = await executeActionInTab(tabId, action);
    
    // TODO: Send result back to agent for next action
    return result;
  } catch (error) {
    throw new Error(`Failed to handle task: ${error.message}`);
  }
}

async function executeActionInTab(tabId, action) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'executeAction',
      actionData: action
    }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response.success) {
        resolve(response.result);
      } else {
        reject(new Error(response.error));
      }
    });
  });
} 