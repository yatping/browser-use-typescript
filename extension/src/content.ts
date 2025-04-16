import { Action, ActionResult, ActionResponse } from './types/actions';

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((
  request: { action: string; actionData: Action },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ActionResponse) => void
) => {
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
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
});

async function executeAction(actionData: Action): Promise<ActionResult> {
  switch (actionData.type) {
    case 'click':
      return await clickElement(actionData.selector);
    case 'type':
      if (!actionData.text) {
        throw new Error('Text is required for type action');
      }
      return await typeText(actionData.selector, actionData.text);
    case 'getText':
      return await getElementText(actionData.selector);
    default:
      throw new Error(`Unknown action type: ${actionData.type}`);
  }
}

async function clickElement(selector: string): Promise<ActionResult> {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  // Cast to HTMLElement which has the click() method
  (element as HTMLElement).click();
  return { message: `Clicked element: ${selector}` };
}

async function typeText(selector: string, text: string): Promise<ActionResult> {
  const element = document.querySelector(selector) as HTMLInputElement;
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  element.value = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  return { message: `Typed text into element: ${selector}` };
}

async function getElementText(selector: string): Promise<ActionResult> {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return { text: element.textContent || '' };
} 