/**
 * TypeScript implementation of the Registry service
 */

import { ActionRegistry, RegisteredAction, ActionResult } from './types';

/**
 * Registry for browser actions
 * Manages the registration and execution of browser actions
 */
export class Registry<Context> {
  private registry: ActionRegistry;
  private excludeActions: string[];

  /**
   * Create a new Registry
   * @param excludeActions List of action names to exclude from registration
   */
  constructor(excludeActions: string[] = []) {
    this.registry = new ActionRegistry();
    this.excludeActions = excludeActions;
  }

  /**
   * Register an action with the registry
   * @param description Description of the action
   * @param paramModel Model for the action parameters
   * @returns Decorator function that registers the action
   */
  action(description: string, paramModel?: any) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const actionName = propertyKey;
      
      // Skip registration if action is in exclude list
      if (this.excludeActions.includes(actionName)) {
        return descriptor;
      }
      
      // Register the action
      this.registry.actions[actionName] = new RegisteredAction(
        actionName,
        description,
        descriptor.value,
        paramModel
      );
      
      return descriptor;
    };
  }

  /**
   * Execute an action by name with parameters
   * @param actionName Name of the action to execute
   * @param params Parameters for the action
   * @param context Context for the action
   * @returns Result of the action
   */
  async executeAction(
    actionName: string, 
    params: any, 
    context?: Context
  ): Promise<ActionResult> {
    // Check if action exists
    if (!(actionName in this.registry.actions)) {
      return {
        error: `Action ${actionName} not found in registry`,
        success: false
      };
    }

    const action = this.registry.actions[actionName];
    
    try {
      // Execute the action with parameters and context
      if (context) {
        return await action.function(params, context);
      } else {
        return await action.function(params);
      }
    } catch (error) {
      return {
        error: `Error executing action ${actionName}: ${error}`,
        success: false
      };
    }
  }

  /**
   * Get a description of all registered actions for the prompt
   * @returns Description of all actions
   */
  getPromptDescription(): string {
    return this.registry.getPromptDescription();
  }

  /**
   * Get all registered actions
   * @returns Map of action names to registered actions
   */
  getActions(): Record<string, RegisteredAction> {
    return this.registry.actions;
  }

  /**
   * Check if an action is registered
   * @param actionName Name of the action to check
   * @returns True if the action is registered
   */
  hasAction(actionName: string): boolean {
    return actionName in this.registry.actions;
  }
}