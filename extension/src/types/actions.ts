export interface Action {
  type: 'click' | 'type' | 'getText';
  selector: string;
  text?: string;
}

export interface ActionResult {
  message?: string;
  text?: string;
}

export interface ActionResponse {
  success: boolean;
  result?: ActionResult;
  error?: string;
} 