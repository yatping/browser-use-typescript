/**
 * TypeScript interfaces converted from Python classes
 */

// Action Input Models
export interface SearchGoogleAction {
  query: string;
}

export interface GoToUrlAction {
  url: string;
}

export interface ClickElementAction {
  index: number;
  xpath?: string; // Optional[str] in Python
}

export interface InputTextAction {
  index: number;
  text: string;
  xpath?: string; // Optional[str] in Python
}

export interface DoneAction {
  text: string;
  success: boolean;
}

export interface SwitchTabAction {
  page_id: number;
}

export interface OpenTabAction {
  url: string;
}

export interface ScrollAction {
  amount?: number; // Optional[int] in Python
}

export interface SendKeysAction {
  keys: string;
}

export interface ExtractPageContentAction {
  value: string;
}

// NoParamsAction in Python discards all inputs
// In TypeScript, we can use an empty interface with Record<string, any>
export interface NoParamsAction {
  [key: string]: any; // This allows any properties but they'll be ignored in implementation
}

// Union type for all possible actions
export type BrowserAction = 
  | SearchGoogleAction
  | GoToUrlAction
  | ClickElementAction
  | InputTextAction
  | DoneAction
  | SwitchTabAction
  | OpenTabAction
  | ScrollAction
  | SendKeysAction
  | ExtractPageContentAction
  | NoParamsAction;

// Action type discriminator
export enum ActionType {
  SEARCH_GOOGLE = "SEARCH_GOOGLE",
  GO_TO_URL = "GO_TO_URL",
  CLICK_ELEMENT = "CLICK_ELEMENT",
  INPUT_TEXT = "INPUT_TEXT",
  DONE = "DONE",
  SWITCH_TAB = "SWITCH_TAB",
  OPEN_TAB = "OPEN_TAB",
  SCROLL = "SCROLL",
  SEND_KEYS = "SEND_KEYS",
  EXTRACT_PAGE_CONTENT = "EXTRACT_PAGE_CONTENT",
  NO_PARAMS = "NO_PARAMS"
}

// Action with type for discriminated union
export interface ActionWithType<T extends BrowserAction> {
  type: ActionType;
  payload: T;
}

// Helper type for all possible actions with their types
export type TypedBrowserAction = 
  | ActionWithType<SearchGoogleAction>
  | ActionWithType<GoToUrlAction>
  | ActionWithType<ClickElementAction>
  | ActionWithType<InputTextAction>
  | ActionWithType<DoneAction>
  | ActionWithType<SwitchTabAction>
  | ActionWithType<OpenTabAction>
  | ActionWithType<ScrollAction>
  | ActionWithType<SendKeysAction>
  | ActionWithType<ExtractPageContentAction>
  | ActionWithType<NoParamsAction>;