import { Action, ActionResult, ActionResponse } from './types/actions';

interface TaskRequest {
  action: string;
  input: string;
  tabId: number;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((
  request: TaskRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; response?: ActionResult; error?: string }) => void
) => {
  if (request.action === 'executeTask') {
    handleTask(request.input, request.tabId)
      .then(response => {
        sendResponse({ success: true, response });
      })
      .catch(error => {
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      });
    return true; // Will respond asynchronously
  }
});

async function handleTask(input: string, tabId: number): Promise<ActionResult> {
  try {
    // TODO: Send input to agent and get actions
    // For now, we'll just demonstrate the communication flow
    const action: Action = {
      type: 'click',
      selector: '#example-button'
    };

    // Execute the action in the content script
    const result = await executeActionInTab(tabId, action);
    
    // TODO: Send result back to agent for next action
    return result;
  } catch (error) {
    throw new Error(`Failed to handle task: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function executeActionInTab(tabId: number, action: Action): Promise<ActionResult> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'executeAction',
      actionData: action
    }, (response: ActionResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response.success && response.result) {
        resolve(response.result);
      } else {
        reject(new Error(response.error || 'Unknown error'));
      }
    });
  });
} 