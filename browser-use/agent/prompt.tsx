import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ActionResult } from "./types";
import fs from 'fs';
import path from 'path';
import { BrowserState } from "../browser/playwrightBrowser/type";



/**
 * Defines the system prompt for the browser automation agent
 */
export class SystemPrompt {
    defaultActionDescription: string;
    maxActionsPerStep: number;
    promptTemplate: string = '';
    systemMessage: SystemMessage;

    constructor(
        actionDescription: string,
        maxActionsPerStep: number = 10,
        overrideSystemMessage?: string,
        extendSystemMessage?: string
    ) {
        this.defaultActionDescription = actionDescription;
        this.maxActionsPerStep = maxActionsPerStep;
        let prompt = '';

        if (overrideSystemMessage) {
            prompt = overrideSystemMessage;
        } else {
            this.loadPromptTemplate();
            prompt = this.promptTemplate.replace('{max_actions}', this.maxActionsPerStep.toString());
        }

        if (extendSystemMessage) {
            prompt += `\n${extendSystemMessage}`;
        }

        this.systemMessage = new SystemMessage(prompt);
    }

    /**
     * Load the prompt template from the markdown file
     */
    private loadPromptTemplate(): void {
        try {
            // For browser environment, we'll need to handle this differently
            // In Next.js, you might want to import this as a static file
            const promptPath = path.join(process.cwd(), 'app', '_browserService', 'agent', 'system_prompt.md');
            if (fs.existsSync(promptPath)) {
                this.promptTemplate = fs.readFileSync(promptPath, 'utf-8');
            } else {
                throw new Error(`System prompt template not found at ${promptPath}`);
            }
        } catch (e) {
            console.error('Failed to load system prompt template:', e);
            // Fallback to basic prompt if file can't be loaded
            this.promptTemplate = `You are a browser automation agent. You can perform up to {max_actions} actions per step.`;
        }
    }

    /**
     * Get the system message for the agent
     */
    getSystemMessage(): SystemMessage {
        return this.systemMessage;
    }
}

/**
 * Interface for agent step information
 */
export interface AgentStepInfo {
    stepNumber: number;
    maxSteps: number;
}

/**
 * Formats messages for the agent from browser state
 */
export class AgentMessagePrompt {
    state: BrowserState;
    result?: ActionResult[];
    includeAttributes: string[];
    stepInfo?: AgentStepInfo;

    constructor(
        state: BrowserState,
        result?: ActionResult[],
        includeAttributes: string[] = [],
        stepInfo?: AgentStepInfo
    ) {
        this.state = state;
        this.result = result;
        this.includeAttributes = includeAttributes;
        this.stepInfo = stepInfo;
    }

    /**
     * Get a formatted user message containing browser state
     */
    getUserMessage(useVision: boolean = true): HumanMessage {
        const elementsText = this.state.elementTree?.clickableElementsToString(
            this.includeAttributes
        ) || '';

        const hasContentAbove = (this.state.pixels_above || 0) > 0;
        const hasContentBelow = (this.state.pixels_below || 0) > 0;

        let formattedElementsText = '';
        if (elementsText !== '') {
            if (hasContentAbove) {
                formattedElementsText = 
                    `... ${this.state.pixels_above} pixels above - scroll or extract content to see more ...\n${elementsText}`;
            } else {
                formattedElementsText = `[Start of page]\n${elementsText}`;
            }
            
            if (hasContentBelow) {
                formattedElementsText = 
                    `${formattedElementsText}\n... ${this.state.pixels_below} pixels below - scroll or extract content to see more ...`;
            } else {
                formattedElementsText = `${formattedElementsText}\n[End of page]`;
            }
        } else {
            formattedElementsText = 'empty page';
        }

        let stepInfoDescription = '';
        if (this.stepInfo) {
            stepInfoDescription = `Current step: ${this.stepInfo.stepNumber + 1}/${this.stepInfo.maxSteps}`;
        }
        
        const timeStr = new Date().toLocaleString();
        stepInfoDescription += `\nCurrent date and time: ${timeStr}`;

        let stateDescription = `
[Task history memory ends]
[Current state starts here]
The following is one-time information - if you need to remember it write it to memory:
Current url: ${this.state.url || ''}
Available tabs:
${this.state.tab || ''}
Interactive elements from top layer of the current page inside the viewport:
${formattedElementsText}
${stepInfoDescription}
`;

        if (this.result && this.result.length > 0) {
            this.result.forEach((result, i) => {
                if (result.extracted_content) {
                    stateDescription += `\nAction result ${i + 1}/${this.result!.length}: ${result.extracted_content}`;
                }
                if (result.error) {
                    // Only use last line of error
                    const error = result.error.split('\n').pop() || '';
                    stateDescription += `\nAction error ${i + 1}/${this.result!.length}: ...${error}`;
                }
            });
        }

        if (this.state.screenshot && useVision) {
            // Format message for vision model
            return new HumanMessage({
                content: [
                    { type: 'text', text: stateDescription },
                    {
                        type: 'image_url',
                        image_url: { url: `data:image/png;base64,${this.state.screenshot}` }
                    }
                ]
            });
        }

        return new HumanMessage(stateDescription);
    }
}

/**
 * Specialized system prompt for planning agent
 */
export class PlannerPrompt extends SystemPrompt {
    getSystemMessage(): SystemMessage {
        return new SystemMessage(
            `You are a planning agent that helps break down tasks into smaller steps and reason about the current state.
Your role is to:
1. Analyze the current state and history
2. Evaluate progress towards the ultimate goal
3. Identify potential challenges or roadblocks
4. Suggest the next high-level steps to take

Inside your messages, there will be AI messages from different agents with different formats.

Your output format should be always a JSON object with the following fields:
{
    "state_analysis": "Brief analysis of the current state and what has been done so far",
    "progress_evaluation": "Evaluation of progress towards the ultimate goal (as percentage and description)",
    "challenges": "List any potential challenges or roadblocks",
    "next_steps": "List 2-3 concrete next steps to take",
    "reasoning": "Explain your reasoning for the suggested next steps"
}

Ignore the other AI messages output structures.

Keep your responses concise and focused on actionable insights.`
        );
    }
}