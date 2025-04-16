/**
 * TypeScript interfaces and classes converted from Python
 */

import { BrowserAction } from "../../controller/types";

// Type definitions to match Python's typing
type Callable = (...args: any[]) => any;

/**
 * Model for a registered action
 */
export class RegisteredAction {
  name: string;
  description: string;
  function: Callable;
  paramModel: any; // Type of BaseModel

  constructor(name: string, description: string, func: Callable, paramModel: any) {
    this.name = name;
    this.description = description;
    this.function = func;
    this.paramModel = paramModel;
  }

  /**
   * Get a description of the action for the prompt
   */
  promptDescription(): string {
    const skipKeys = ['title'];
    let s = `${this.description}: \n`;
    s += '{' + this.name + ': ';
    
    // Get schema properties and filter out skip keys
    const schemaProperties = this.paramModel.schema?.properties || {};
    const filteredProperties = Object.entries(schemaProperties).reduce((acc, [k, v]) => {
      const subProps = Object.entries(v as Record<string, any>)
        .filter(([subK]) => !skipKeys.includes(subK))
        .reduce((subAcc, [subK, subV]) => {
          subAcc[subK] = subV;
          return subAcc;
        }, {} as Record<string, any>);
      
      acc[k] = subProps;
      return acc;
    }, {} as Record<string, any>);
    
    s += JSON.stringify(filteredProperties);
    s += '}';
    return s;
  }
}

/**
 * Base model for dynamically created action models
 */
export class ActionModel {
  [key: string]: any; // This allows dynamic properties

  /**
   * Get the index of the action
   */
  getIndex(): number | null {
    // Get all values from the model excluding unset properties
    const params = Object.values(this.modelDump(true));
    
    if (!params.length) {
      return null;
    }
    
    for (const param of params) {
      if (param !== null && typeof param === 'object' && 'index' in param) {
        return param.index;
      }
    }
    
    return null;
  }

  /**
   * Overwrite the index of the action
   */
  setIndex(index: number): void {
    // Get the action name and params
    const actionData = this.modelDump(true);
    const actionName = Object.keys(actionData)[0];
    const actionParams = this[actionName];

    // Update the index directly on the model
    if (actionParams && 'index' in actionParams) {
      actionParams.index = index;
    }
  }

  /**
   * Dump model data excluding unset properties
   * This is a simplified version of Pydantic's model_dump
   */
  private modelDump(excludeUnset: boolean = false): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const key in this) {
      if (Object.prototype.hasOwnProperty.call(this, key) && typeof this[key] !== 'function') {
        if (!excludeUnset || this[key] !== undefined) {
          result[key] = this[key];
        }
      }
    }
    
    return result;
  }
}

/**
 * Model representing the action registry
 */
export class ActionRegistry {
  actions: Record<string, RegisteredAction> = {};

  /**
   * Get a description of all actions for the prompt
   */
  getPromptDescription(): string {
    return Object.values(this.actions)
      .map(action => action.promptDescription())
      .join('\n');
  }
}

/**
 * Result of an action execution
 */
export interface ActionResult {
  isDone?: boolean;
  success?: boolean;
  extractedContent?: string;
  includeInMemory?: boolean;
  error?: string;
}