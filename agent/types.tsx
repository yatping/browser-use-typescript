import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BrowserStateHistory } from "../browser/playwrightBrowser/type";
import { ActionModel } from "../controller/registry/types";
import { HashedDomElement, HistoryTreeProcessor } from "../domHIstory/historyTypes";
import { DOMElementNode } from "../domTypes/domClass";
import { SelectorMap } from "../domTypes/domClass";
import { randomUUID } from "crypto";
import * as fs from 'fs';
import * as path from 'path';
import { MessageManagerState } from "./message_manager/types";

// Define the ToolCallingMethod as a literal type
type ToolCallingMethod = 'function_calling' | 'json_mode' | 'raw' | 'auto';

// Define interfaces for our custom types
interface DOMHistoryElement {
    // Define properties based on your implementation
}



class AgentSettings {
    use_vision: boolean = true;
    use_vision_for_planner: boolean = false;
    save_conversation_path: string | undefined = undefined;
    save_conversation_path_encoding: string | undefined = 'utf-8';
    max_failures: number = 3;
    retry_delay: number = 10;
    max_input_tokens: number = 128000;
    validate_output: boolean = false;
    message_context: string | undefined = undefined;
    generate_gif: boolean | string = false;
    available_file_paths: string[] | undefined = undefined;
    override_system_message: string | undefined = undefined;
    extend_system_message: string | undefined = undefined;
    include_attributes: string[] = [
        'title',
        'type',
        'name',
        'role',
        'tabindex',
        'aria-label',
        'placeholder',
        'value',
        'alt',
        'aria-expanded',
    ];
    max_actions_per_step: number = 10;
    tool_calling_method: ToolCallingMethod | undefined = 'auto';
    page_extraction_llm: BaseChatModel | undefined = undefined;
    planner_llm: BaseChatModel | undefined = undefined;
    planner_interval: number = 1;
    constructor(params:any){
        this.use_vision = params.use_vision;
        this.use_vision_for_planner = params.use_vision_for_planner;
        this.save_conversation_path = params.save_conversation_path;
        this.save_conversation_path_encoding = params.save_conversation_path_encoding;
        this.max_failures = params.max_failures;
        this.retry_delay = params.retry_delay;
        this.max_input_tokens = params.max_input_tokens;
        this.validate_output = params.validate_output;
        this.message_context = params.message_context;
        this.generate_gif = params.generate_gif;
        this.available_file_paths = params.available_file_paths;
        this.override_system_message = params.override_system_message;
        this.extend_system_message = params.extend_system_message;
        this.include_attributes = params.include_attributes;
        this.max_actions_per_step = params.max_actions_per_step;
        this.tool_calling_method = params.tool_calling_method;
        this.page_extraction_llm = params.page_extraction_llm;
        this.planner_llm = params.planner_llm;
        this.planner_interval = params.planner_interval;
    }
}

class AgentState {
    agent_id: string = randomUUID();
    n_steps: number = 1;
    consecutive_failures: number = 0;
    last_result?: ActionResult[] | null = null;
    history: AgentHistoryList = new AgentHistoryList();
    last_plan: string | null = null;
    paused: boolean = false;
    stopped: boolean = false;
    message_manager_state: MessageManagerState = new MessageManagerState();
}

class AgentStepInfo {
    step_number: number;
    max_steps: number;

    constructor(step_number: number, max_steps: number) {
        this.step_number = step_number;
        this.max_steps = max_steps;
    }

    is_last_step(): boolean {
        return this.step_number >= this.max_steps - 1;
    }
}

class ActionResult {
    is_done: boolean = false;
    success: boolean | null = null;
    extracted_content: string | null = null;
    error: string | null = null;
    include_in_memory: boolean = false;

    // Helper methods for serialization
    toJSON() {
        const result: any = {};
        if (this.is_done !== undefined) result.is_done = this.is_done;
        if (this.success !== undefined) result.success = this.success;
        if (this.extracted_content !== undefined) result.extracted_content = this.extracted_content;
        if (this.error !== undefined) result.error = this.error;
        result.include_in_memory = this.include_in_memory;
        return result;
    }
}

class StepMetadata {
    step_start_time: number;
    step_end_time: number;
    input_tokens: number;
    step_number: number;

    constructor(step_start_time: number, step_end_time: number, input_tokens: number, step_number: number) {
        this.step_start_time = step_start_time;
        this.step_end_time = step_end_time;
        this.input_tokens = input_tokens;
        this.step_number = step_number;
    }

    get duration_seconds(): number {
        return this.step_end_time - this.step_start_time;
    }

    // Helper method for serialization
    toJSON() {
        return {
            step_start_time: this.step_start_time,
            step_end_time: this.step_end_time,
            input_tokens: this.input_tokens,
            step_number: this.step_number
        };
    }
}

class AgentBrain {
    evaluation_previous_goal: string;
    memory: string;
    next_goal: string;

    constructor(evaluation_previous_goal: string = "", memory: string = "", next_goal: string = "") {
        this.evaluation_previous_goal = evaluation_previous_goal;
        this.memory = memory;
        this.next_goal = next_goal;
    }

    // Helper method for serialization
    toJSON() {
        return {
            evaluation_previous_goal: this.evaluation_previous_goal,
            memory: this.memory,
            next_goal: this.next_goal
        };
    }
}

class AgentOutput {
    current_state: AgentBrain;
    action: ActionModel[];

    constructor(current_state: AgentBrain, action: ActionModel[]) {
        this.current_state = current_state;
        this.action = action;
    }

    // Static method for extending with custom actions
    static withCustomActions<T extends ActionModel>(output: AgentOutput, customActionType: new() => T): AgentOutput {
        return output; // Simplified version - in a real implementation this would create an extended model
    }

    // Helper method for serialization
    toJSON() {
        return {
            current_state: this.current_state.toJSON(),
            action: this.action.map(a => a.toJSON ? a.toJSON() : a)
        };
    }
}

class AgentHistory {
    model_output: AgentOutput | null;
    result: ActionResult[];
    state: BrowserStateHistory;
    metadata: StepMetadata | null;

    constructor(model_output: AgentOutput | null = null, result: ActionResult[] = [], state: BrowserStateHistory, metadata: StepMetadata | null = null) {
        this.model_output = model_output;
        this.result = result;
        this.state = state;
        this.metadata = metadata;
    }

    // Helper method to get interacted elements
    static getInteractedElement(model_output: AgentOutput, selector_map: SelectorMap): (DOMHistoryElement | null)[] {
        const elements: (DOMHistoryElement | null)[] = [];
        
        for (const action of model_output.action) {
            const index = "get_index" in action ? (action as any).get_index() : null;
            
            if (index !== null && index in selector_map) {
                const el: DOMElementNode = selector_map[index];
                elements.push(HistoryTreeProcessor.convertDomElementToHistoryElement(el));
            } else {
                elements.push(null);
            }
        }
        
        return elements;
    }

    // Helper method for serialization
    toJSON() {
        // Handle action serialization
        let model_output_dump = null;
        if (this.model_output) {
            model_output_dump = this.model_output.toJSON();
        }

        return {
            model_output: model_output_dump,
            result: this.result.map(r => r.toJSON()),
            state: this.state.toDict() ?JSON.parse(this.state.toDict().toString()) : this.state,
            metadata: this.metadata ? this.metadata.toJSON() : null
        };
    }
}

class AgentHistoryList {
    history: AgentHistory[] = [];

    constructor(history: AgentHistory[] = []) {
        this.history = history;
    }

    totalDurationSeconds(): number {
        let total = 0;
        for (const h of this.history) {
            if (h.metadata) {
                total += h.metadata.duration_seconds;
            }
        }
        return total;
    }

    totalInputTokens(): number {
        let total = 0;
        for (const h of this.history) {
            if (h.metadata) {
                total += h.metadata.input_tokens;
            }
        }
        return total;
    }

    inputTokenUsage(): number[] {
        return this.history
            .filter(h => h.metadata)
            .map(h => h.metadata!.input_tokens);
    }

    toString(): string {
        return `AgentHistoryList(all_results=${JSON.stringify(this.actionResults())}, all_model_outputs=${JSON.stringify(this.modelActions())})`;
    }

    saveToFile(filepath: string): void {
        try {
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
            const data = JSON.stringify(this.toJSON(), null, 2);
            fs.writeFileSync(filepath, data, 'utf-8');
        } catch (e) {
            throw e;
        }
    }

    toJSON() {
        return {
            history: this.history.map(h => h.toJSON())
        };
    }

    static loadFromFile(filepath: string, outputModel: typeof AgentOutput): AgentHistoryList {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        
        // Process the data to convert it to our model objects
        for (const h of data.history) {
            if (h.model_output) {
                if (typeof h.model_output === 'object') {
                    // In a real implementation, we would validate and convert this properly
                    // But for simplicity, we're just setting it directly
                } else {
                    h.model_output = null;
                }
            }
            
            if (!h.state.interacted_element) {
                h.state.interacted_element = null;
            }
        }
        
        // In a real implementation, we would validate the data structure here
        return new AgentHistoryList(data.history);
    }

    lastAction(): any {
        if (this.history.length > 0 && this.history[this.history.length - 1].model_output) {
            const lastOutput = this.history[this.history.length - 1].model_output!;
            if (lastOutput.action.length > 0) {
                const lastAction = lastOutput.action[lastOutput.action.length - 1];
                return lastAction.toJSON ? lastAction.toJSON() : lastAction;
            }
        }
        return null;
    }

    errors(): (string | null)[] {
        const errors: (string | null)[] = [];
        
        for (const h of this.history) {
            const stepErrors = h.result
                .filter(r => r.error)
                .map(r => r.error);
            
            // Each step can have only one error
            errors.push(stepErrors.length > 0 ? stepErrors[0] : null);
        }
        
        return errors;
    }

    finalResult(): string | null {
        if (this.history.length > 0 && this.history[this.history.length - 1].result.length > 0) {
            const lastResult = this.history[this.history.length - 1].result[this.history[this.history.length - 1].result.length - 1];
            return lastResult.extracted_content;
        }
        return null;
    }

    isDone(): boolean {
        if (this.history.length > 0 && this.history[this.history.length - 1].result.length > 0) {
            const lastResult = this.history[this.history.length - 1].result[this.history[this.history.length - 1].result.length - 1];
            return lastResult.is_done === true;
        }
        return false;
    }

    isSuccessful(): boolean | null {
        if (this.history.length > 0 && this.history[this.history.length - 1].result.length > 0) {
            const lastResult = this.history[this.history.length - 1].result[this.history[this.history.length - 1].result.length - 1];
            if (lastResult.is_done === true) {
                return lastResult.success;
            }
        }
        return null;
    }

    hasErrors(): boolean {
        return this.errors().some(error => error !== null);
    }

    urls(): (string | null)[] {
        return this.history.map(h => h.state.url || null);
    }

    screenshots(): (string | null)[] {
        return this.history.map(h => h.state.screenshot || null);
    }

    actionNames(): string[] {
        const actionNames: string[] = [];
        
        for (const action of this.modelActions()) {
            const keys = Object.keys(action);
            if (keys.length > 0) {
                actionNames.push(keys[0]);
            }
        }
        
        return actionNames;
    }

    modelThoughts(): AgentBrain[] {
        return this.history
            .filter(h => h.model_output !== null)
            .map(h => h.model_output!.current_state);
    }

    modelOutputs(): AgentOutput[] {
        return this.history
            .filter(h => h.model_output !== null)
            .map(h => h.model_output!);
    }

    modelActions(): any[] {
        const outputs: any[] = [];
        
        for (const h of this.history) {
            if (h.model_output) {
                for (let i = 0; i < h.model_output.action.length; i++) {
                    const action = h.model_output.action[i];
                    const interactedElement = h.state.interacted_element?.[i];
                    
                    const output = action.toJSON ? action.toJSON() : { ...action };
                    output.interacted_element = interactedElement;
                    outputs.push(output);
                }
            }
        }
        
        return outputs;
    }

    actionResults(): ActionResult[] {
        const results: ActionResult[] = [];
        
        for (const h of this.history) {
            results.push(...h.result.filter(r => r));
        }
        
        return results;
    }

    extractedContent(): string[] {
        const content: string[] = [];
        
        for (const h of this.history) {
            for (const r of h.result) {
                if (r.extracted_content) {
                    content.push(r.extracted_content);
                }
            }
        }
        
        return content;
    }

    modelActionsFiltered(include: string[] = []): any[] {
        const outputs = this.modelActions();
        const result: any[] = [];
        
        for (const output of outputs) {
            const keys = Object.keys(output);
            
            for (const includeItem of include) {
                if (keys.length > 0 && includeItem === keys[0]) {
                    result.push(output);
                }
            }
        }
        
        return result;
    }

    numberOfSteps(): number {
        return this.history.length;
    }
}

class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

class RateLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RateLimitError';
    }
}

class AgentError {
    static VALIDATION_ERROR = 'Invalid model output format. Please follow the correct schema.';
    static RATE_LIMIT_ERROR = 'Rate limit reached. Waiting before retry.';
    static NO_VALID_ACTION = 'No valid action found';

    static formatError(error: Error, includeTrace: boolean = false): string {
        if (error instanceof ValidationError) {
            return `${AgentError.VALIDATION_ERROR}\nDetails: ${error.message}`;
        }
        
        if (error instanceof RateLimitError) {
            return AgentError.RATE_LIMIT_ERROR;
        }
        
        if (includeTrace) {
            return `${error.message}\nStacktrace:\n${error.stack || ''}`;
        }
        
        return error.message;
    }
}

// Export the classes and interfaces for use in other files
export {
    AgentSettings,
    AgentState,
    AgentStepInfo,
    ActionResult,
    StepMetadata,
    AgentBrain,
    AgentOutput,
    AgentHistory,
    AgentHistoryList,
    AgentError,
    ValidationError,
    RateLimitError, type MessageManagerState,
    type DOMHistoryElement
};
export type { ToolCallingMethod };
