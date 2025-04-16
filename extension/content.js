// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'executeAction') {
    try {
      executeAction(request.actionData)
        .then(result => {
          sendResponse({ success: true, result });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Will respond asynchronously
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
});

async function executeAction(actionData) {
  // This function will be expanded to handle different types of actions
  switch (actionData.type) {
    case 'click':
      return await clickElement(actionData.selector);
    case 'type':
      return await typeText(actionData.selector, actionData.text);
    case 'getText':
      return await getElementText(actionData.selector);
    default:
      throw new Error(`Unknown action type: ${actionData.type}`);
  }
}

async function clickElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  element.click();
  return { message: `Clicked element: ${selector}` };
}

async function typeText(selector, text) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  element.value = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  return { message: `Typed text into element: ${selector}` };
}

async function getElementText(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return { text: element.textContent };
} 