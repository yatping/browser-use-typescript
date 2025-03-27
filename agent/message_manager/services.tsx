import { 
    SystemMessage, 
    HumanMessage, 
    BaseMessage 
} from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { MessageHistory, MessageManagerState, MessageMetadata } from "./types";
import { convertInputMessages, extractJsonFromModelOutput } from "./utils";
import { AgentOutput } from "../types";

/**
 * Settings for the MessageManager
 */
class MessageManagerSettings {
    maxTokens: number = 12000;
    numChatTurnsToKeep: number = 10;
    keepSystemMessageFirst: boolean = true;
    excludeKeysForInnerTools: string[] = [];
    saveChatHistory: boolean = false;
    messagesFolder: string = "";
    defaultModelName: string = "";
    
    constructor(init?: Partial<MessageManagerSettings>) {
        Object.assign(this, init);
    }
}

/**
 * Manages message history, settings, and handles interactions between agent state and outputs
 */
class MessageManager {
    task: string;
    systemMessage: SystemMessage;
    settings: MessageManagerSettings;
    state: MessageManagerState;
    
    constructor(
        task: string, 
        systemMessage: SystemMessage, 
        settings: MessageManagerSettings = new MessageManagerSettings()
    ) {
        this.task = task;
        this.systemMessage = systemMessage;
        this.settings = settings;
        this.state = new MessageManagerState();
        
        // Add system message
        this.state.history.addMessage(
            systemMessage, 
            new MessageMetadata()
        );
    }
    
    /**
     * Get current history
     */
    getHistory(): MessageHistory {
        return this.state.history;
    }
    
    /**
     * Add user request to history
     */
    addUserRequest(content: string, metadata: MessageMetadata = new MessageMetadata()): void {
        const message = new HumanMessage(content);
        this.state.history.addMessage(message, metadata);
    }
    
    /**
     * Add agent output to history
     */
    addAgentOutput(output: AgentOutput): void {
        this.state.history.addModelOutput(output);
    }
    
    /**
     * Before calling a model, we need to ensure that we're not exceeding the token limit
     */
    truncateHistory(): void {
        while (
            this.state.history.getTotalTokens() > this.settings.maxTokens && 
            this.state.history.messages.length > 1
        ) {
            this.state.history.removeOldestMessage();
        }
    }
    
    /**
     * Prepare messages for the model call
     */
    prepareMessagesForModel(model: BaseChatModel): BaseMessage[] {
        this.truncateHistory();
        
        // Get model name safely from model instance or use default
        const modelName = this.getModelName(model);
        
        // Convert messages to format compatible with the model
        return convertInputMessages(
            this.state.history.getMessages(),
            modelName || this.settings.defaultModelName
        );
    }
    
    /**
     * Safely get the model name from a BaseChatModel instance
     */
    private getModelName(model: BaseChatModel): string | undefined {
        // Try to access model name from the model object
        // BaseChatModel might have _llm or _modelName or other ways to access the name
        if (!model) return undefined;
        
        // Try different possible properties for model name
        if ('modelName' in model) {
            return (model as any).modelName;
        }
        
        if ('_modelName' in model) {
            return (model as any)._modelName;
        }
        
        if ('_llm' in model && 'model_name' in (model as any)._llm) {
            return (model as any)._llm.model_name;
        }
        
        // If we can't find the model name, return undefined and use default
        return undefined;
    }
    
    /**
     * Generate the JSON input for planning models
     */
    generateModelInput(config: Record<string, any> = {}): Record<string, any> {
        if (config) {
            this.filterSensitiveData(config);
        }
        
        return {
            task: this.task,
            ...config
        };
    }
    
    /**
     * Filter sensitive data from configuration
     */
    filterSensitiveData(config: Record<string, any>): void {
        if (this.settings.excludeKeysForInnerTools.length > 0) {
            for (const key of this.settings.excludeKeysForInnerTools) {
                if (key in config) {
                    delete config[key];
                }
            }
        }
    }
    
    /**
     * Parse model output to extract the JSON response
     */
    parseModelOutput(content: string): any {
        try {
            return extractJsonFromModelOutput(content);
        } catch (error) {
            console.error("Failed to parse model output:", error);
            throw new Error("Failed to parse model output");
        }
    }
}

export {
    MessageManagerSettings,
    MessageManager
};