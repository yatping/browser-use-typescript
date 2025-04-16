import * as fs from 'fs';
import * as path from 'path';
import { 
    AIMessage, 
    BaseMessage, 
    HumanMessage, 
    SystemMessage, 
    ToolMessage 
} from "@langchain/core/messages";

// Define a more specific type for MessageContent with text property
interface MessageContentWithText {
    type: string;
    text: string;
}

/**
 * Extract JSON from model output, handling both plain JSON and code-block-wrapped JSON.
 */
export function extractJsonFromModelOutput(content: string): any {
    try {
        // If content is wrapped in code blocks, extract just the JSON part
        if (content.includes('```')) {
            // Find the JSON content between code blocks
            content = content.split('```')[1];
            // Remove language identifier if present (e.g., 'json\n')
            if (content.includes('\n')) {
                content = content.split('\n', 2)[1];
            }
        }
        // Parse the cleaned content
        return JSON.parse(content);
    } catch (e) {
        console.warn(`Failed to parse model output: ${content} ${e}`);
        throw new Error('Could not parse response.');
    }
}

/**
 * Convert input messages to a format that is compatible with the planner model
 */
export function convertInputMessages(
    inputMessages: BaseMessage[], 
    modelName?: string
): BaseMessage[] {
    if (!modelName) {
        return inputMessages;
    }
    
    if (modelName === 'deepseek-reasoner' || modelName.includes('deepseek-r1')) {
        let convertedInputMessages = convertMessagesForNonFunctionCallingModels(inputMessages);
        let mergedInputMessages = mergeSuccessiveMessages(convertedInputMessages, HumanMessage);
        mergedInputMessages = mergeSuccessiveMessages(mergedInputMessages, AIMessage);
        return mergedInputMessages;
    }
    
    return inputMessages;
}

/**
 * Convert messages for non-function-calling models
 */
function convertMessagesForNonFunctionCallingModels(inputMessages: BaseMessage[]): BaseMessage[] {
    const outputMessages: BaseMessage[] = [];
    
    for (const message of inputMessages) {
        if (message instanceof HumanMessage || message instanceof SystemMessage) {
            outputMessages.push(message);
        } else if (message instanceof ToolMessage) {
            outputMessages.push(new HumanMessage(message.content as string));
        } else if (message instanceof AIMessage) {
            // Check if tool_calls is a valid JSON object
            if (message.tool_calls) {
                const toolCalls = JSON.stringify(message.tool_calls);
                outputMessages.push(new AIMessage({
                    content: toolCalls
                }));
            } else {
                outputMessages.push(message);
            }
        } else {
            throw new Error(`Unknown message type: ${typeof message}`);
        }
    }
    
    return outputMessages;
}

/**
 * Some models like deepseek-reasoner don't allow multiple human messages in a row.
 * This function merges them into one.
 */
function mergeSuccessiveMessages(
    messages: BaseMessage[],
    classToMerge: typeof HumanMessage | typeof AIMessage
): BaseMessage[] {
    const mergedMessages: BaseMessage[] = [];
    let streak = 0;
    
    for (const message of messages) {
        if (message instanceof classToMerge) {
            streak += 1;
            if (streak > 1) {
                // Handle content merging based on content type
                const lastMessage = mergedMessages[mergedMessages.length - 1];
                
                // Safe handling of message content
                if (typeof message.content === 'string' && typeof lastMessage.content === 'string') {
                    lastMessage.content += message.content;
                } else if (Array.isArray(message.content) && Array.isArray(lastMessage.content)) {
                    // Safely handle array type content (more complex)
                    // For now, we'll just append the arrays
                    lastMessage.content = [...lastMessage.content, ...message.content];
                }
                // If content types don't match, we just keep both messages
                else {
                    mergedMessages.push(message);
                }
            } else {
                mergedMessages.push(message);
            }
        } else {
            mergedMessages.push(message);
            streak = 0;
        }
    }
    
    return mergedMessages;
}

/**
 * Save conversation history to file.
 */
export function saveConversation(
    inputMessages: BaseMessage[], 
    response: any, 
    target: string, 
    encoding: BufferEncoding = 'utf-8'
): void {
    // Create folders if not exists
    const dirname = path.dirname(target);
    if (dirname) {
        fs.mkdirSync(dirname, { recursive: true });
    }

    const fileContent: string[] = [];
    
    // Add messages
    for (const message of inputMessages) {
        fileContent.push(` ${message.constructor.name} `);
        
        // Handle different content types safely
        if (typeof message.content === 'string') {
            try {
                const content = JSON.parse(message.content);
                fileContent.push(JSON.stringify(content, null, 2));
            } catch (e) {
                fileContent.push(message.content.trim());
            }
        } else if (Array.isArray(message.content)) {
            // Handle array content by converting to string representation
            const contentStr = JSON.stringify(message.content);
            fileContent.push(contentStr);
        }
        
        fileContent.push('');
    }
    
    // Add response
    fileContent.push(' RESPONSE');
    fileContent.push(JSON.stringify(response, null, 2));
    
    // Write to file with correct type for encoding
    fs.writeFileSync(target, fileContent.join('\n'), { encoding });
}

/**
 * Write messages to conversation file
 */
function writeMessagesToFile(fileHandle: fs.WriteStream, messages: BaseMessage[]): void {
    for (const message of messages) {
        fileHandle.write(`${message.constructor.name}\n`);
        
        // Handle different content types safely
        if (typeof message.content === 'string') {
            try {
                const content = JSON.parse(message.content);
                fileHandle.write(JSON.stringify(content, null, 2) + '\n');
            } catch (e) {
                fileHandle.write(message.content.trim() + '\n');
            }
        } else if (Array.isArray(message.content)) {
            // Handle array content by converting to string representation
            const contentStr = JSON.stringify(message.content);
            fileHandle.write(contentStr + '\n');
        }
        
        fileHandle.write('\n');
    }
}

/**
 * Write model response to conversation file
 */
function writeResponseToFile(fileHandle: fs.WriteStream, response: any): void {
    fileHandle.write(' RESPONSE\n');
    fileHandle.write(JSON.stringify(response, null, 2));
}