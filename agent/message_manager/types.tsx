import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

/**
 * Metadata for a message
 */
class MessageMetadata {
    tokens: number = 0;
}

/**
 * A message with its metadata
 */
class ManagedMessage {
    message: BaseMessage;
    metadata: MessageMetadata;

    constructor(message: BaseMessage, metadata: MessageMetadata = new MessageMetadata()) {
        this.message = message;
        this.metadata = metadata;
    }

    /**
     * Returns the JSON representation of the model.
     * Serializes the message property before encoding the overall object.
     */
    toJSON() {
        const data: any = {
            message: this.message,
            metadata: this.metadata
        };

        // Handle serialization of the message using langchain's serialization if available
        if (this.message.toJSON) {
            data.message = this.message.toJSON();
        }

        return data;
    }

    /**
     * Create a ManagedMessage from JSON data
     */
    static fromJSON(data: any): ManagedMessage {
        let message: BaseMessage;

        // Handle different message types
        if (data.message._type === "human") {
            message = new HumanMessage(data.message.content);
        } else if (data.message._type === "ai") {
            message = new AIMessage({
                content: data.message.content,
                tool_calls: data.message.tool_calls
            });
        } else if (data.message._type === "system") {
            message = new SystemMessage(data.message.content);
        } else if (data.message._type === "tool") {
            message = new ToolMessage({
                content: data.message.content,
                tool_call_id: data.message.tool_call_id
            });
        } else {
            // Default case
            message = new HumanMessage(data.message.content);
        }

        return new ManagedMessage(
            message,
            new MessageMetadata()
        );
    }
}

/**
 * History of messages with metadata
 */
class MessageHistory {
    messages: ManagedMessage[] = [];
    current_tokens: number = 0;

    /**
     * Add message with metadata to history
     */
    addMessage(message: BaseMessage, metadata: MessageMetadata, position?: number): void {
        const managedMessage = new ManagedMessage(message, metadata);
        
        if (position === undefined) {
            this.messages.push(managedMessage);
        } else {
            this.messages.splice(position, 0, managedMessage);
        }
        
        this.current_tokens += metadata.tokens;
    }

    /**
     * Add model output as AI message
     */
    addModelOutput(output: any): void {
        const toolCalls = [
            {
                name: 'AgentOutput',
                args: output,
                id: '1',
                type: 'tool_call' as const,
            }
        ];

        const msg = new AIMessage({
            content: '',
            tool_calls: toolCalls,
        });
        
        this.addMessage(msg, new MessageMetadata()); // Estimate tokens for tool calls

        // Empty tool response
        const toolMessage = new ToolMessage({
            content: '',
            tool_call_id: '1'
        });
        
        this.addMessage(toolMessage, new MessageMetadata()); // Estimate tokens for empty response
    }

    /**
     * Get all messages
     */
    getMessages(): BaseMessage[] {
        return this.messages.map(m => m.message);
    }

    /**
     * Get total tokens in history
     */
    getTotalTokens(): number {
        return this.current_tokens;
    }

    /**
     * Remove oldest non-system message
     */
    removeOldestMessage(): void {
        for (let i = 0; i < this.messages.length; i++) {
            if (!(this.messages[i].message instanceof SystemMessage)) {
                this.current_tokens -= this.messages[i].metadata.tokens;
                this.messages.splice(i, 1);
                break;
            }
        }
    }

    /**
     * Remove last state message from history
     */
    removeLastStateMessage(): void {
        if (this.messages.length > 2 && this.messages[this.messages.length - 1].message instanceof HumanMessage) {
            this.current_tokens -= this.messages[this.messages.length - 1].metadata.tokens;
            this.messages.pop();
        }
    }
}

/**
 * Holds the state for MessageManager
 */
class MessageManagerState {
    history: MessageHistory = new MessageHistory();
    tool_id: number = 1;
}

export {
    MessageMetadata,
    ManagedMessage,
    MessageHistory,
    MessageManagerState
};