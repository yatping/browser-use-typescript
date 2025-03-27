import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { BrowserContext } from "../browser/playwrightBrowser/browserContext";
import { ClickElementAction,
    DoneAction,
    GoToUrlAction,
    InputTextAction,
    NoParamsAction,
    OpenTabAction,
    ScrollAction,
    SearchGoogleAction,
    SendKeysAction,
    SwitchTabAction,
    ExtractPageContentAction
 } from "./types";
import { Registry } from "./registry/service";
import { ActionResult } from "./registry/types";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";

/**
 * Controller class for browser automation
 * Manages the registration and execution of browser actions
 */
export class Controller<Context> {
    registry: Registry<Context>;

    /**
     * Create a new Controller
     * @param excludeActions List of action names to exclude from registration
     * @param outputModel Optional output model for the done action
     */
    constructor(excludeActions: string[] = [], outputModel: any = null) {
        this.registry = new Registry<Context>(excludeActions);
        this.registerDefaultActions(outputModel);
    }

    /**
     * Register all default browser actions
     * @param outputModel Optional output model for the done action
     */
    private registerDefaultActions(outputModel: any): void {
        // Register the done action based on the output model
        if (outputModel !== null) {
            // Create a new model that extends the output model with success parameter
            class ExtendedOutputModel {
                success: boolean = true;
                data: any;

                constructor(data: any) {
                    this.data = data;
                }
            }

            // Register the done action with the extended output model
            this.registry.action(
                'Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached'
            )(this, 'done', {
                value: async (params: any): Promise<ActionResult> => {
                    // Exclude success from the output JSON since it's an internal parameter
                    const outputDict = params.data;

                    // Enums are not serializable, convert to string
                    for (const [key, value] of Object.entries(outputDict)) {
                        if (value && typeof value === 'object' && 'value' in value) {
                            outputDict[key] = value.value;
                        }
                    }

                    return {
                        isDone: true,
                        success: params.success,
                        extractedContent: JSON.stringify(outputDict)
                    };
                }
            });
        } else {
            // Register the done action with the DoneAction model
            this.registry.action(
                'Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached'
            )(this, 'done', {
                value: async (params: DoneAction): Promise<ActionResult> => {
                    return {
                        isDone: true,
                        success: params.success,
                        extractedContent: params.text
                    };
                }
            });
        }

        // Basic Navigation Actions
        this.registry.action(
            'Search the query in Google in the current tab, the query should be a search query like humans search in Google, concrete and not vague or super long. More the single most important items.'
        )(this, 'searchGoogle', {
            value: async (params: SearchGoogleAction, browser: BrowserContext): Promise<ActionResult> => {
                const page = await browser.get_current_page();
                await page.goto(`https://www.google.com/search?q=${params.query}&udm=14`);
                await page.waitForLoadState();
                const msg = `🔍 Searched for "${params.query}" in Google`;
                console.info(msg);
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        this.registry.action(
            'Navigate to URL in the current tab'
        )(this, 'goToUrl', {
            value: async (params: GoToUrlAction, browser: BrowserContext): Promise<ActionResult> => {
                const page = await browser.get_current_page();
                await page.goto(params.url);
                await page.waitForLoadState();
                const msg = `🔗 Navigated to ${params.url}`;
                console.info(msg);
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        this.registry.action(
            'Go back'
        )(this, 'goBack', {
            value: async (_: NoParamsAction, browser: BrowserContext): Promise<ActionResult> => {
                await browser.go_back();
                const msg = '🔙 Navigated back';
                console.info(msg);
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        // Wait for x seconds
        this.registry.action(
            'Wait for x seconds default 3'
        )(this, 'wait', {
            value: async (seconds: number = 3): Promise<ActionResult> => {
                const msg = `🕒 Waiting for ${seconds} seconds`;
                console.info(msg);
                await new Promise(resolve => setTimeout(resolve, seconds * 1000));
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        // Element Interaction Actions
        this.registry.action(
            'Click element'
        )(this, 'clickElement', {
            value: async (params: ClickElementAction, browser: BrowserContext): Promise<ActionResult> => {
                const session = await browser.get_session();

                const selectorMap = await browser.get_selector_map();
                if (!(params.index in selectorMap)) {
                    throw new Error(`Element with index ${params.index} does not exist - retry or use alternative actions`);
                }

                const elementNode = await browser.get_dom_element_by_index(params.index);
                const initialPages = session.context.pages.length;

                // Check if element has file uploader
                if (await browser.is_file_uploader(elementNode)) {
                    const msg = `Index ${params.index} - has an element which opens file upload dialog. To upload files please use a specific function to upload files`;
                    console.info(msg);
                    return {
                        extractedContent: msg,
                        includeInMemory: true
                    };
                }

                let msg = null;

                try {
                    const downloadPath = await browser._click_element_node(elementNode);
                    if (downloadPath) {
                        msg = `💾 Downloaded file to ${downloadPath}`;
                    } else {
                        msg = `🖱️ Clicked button with index ${params.index}: ${elementNode.getAllTextTillNextClickableElement(2)}`;
                    }

                    console.info(msg);
                    console.debug(`Element xpath: ${elementNode.xpath}`);
                    
                    if (session.context.pages.length > initialPages) {
                        const newTabMsg = 'New tab opened - switching to it';
                        msg += ` - ${newTabMsg}`;
                        console.info(newTabMsg);
                        await browser.swtch_to_tab(-1);
                    }
                    
                    return {
                        extractedContent: msg,
                        includeInMemory: true
                    };
                } catch (e) {
                    console.warn(`Element not clickable with index ${params.index} - most likely the page changed`);
                    return {
                        error: String(e)
                    };
                }
            }
        });

        this.registry.action(
            'Input text into a input interactive element'
        )(this, 'inputText', {
            value: async (params: InputTextAction, browser: BrowserContext, hasSensitiveData: boolean = false): Promise<ActionResult> => {
                const selectorMap = await browser.get_selector_map();
                if (!(params.index in selectorMap)) {
                    throw new Error(`Element index ${params.index} does not exist - retry or use alternative actions`);
                }

                const elementNode = await browser.get_dom_element_by_index(params.index);
                await browser._input_text_element_node(elementNode, params.text);
                
                let msg;
                if (!hasSensitiveData) {
                    msg = `⌨️ Input ${params.text} into index ${params.index}`;
                } else {
                    msg = `⌨️ Input sensitive data into index ${params.index}`;
                }
                
                console.info(msg);
                console.debug(`Element xpath: ${elementNode.xpath}`);
                
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        // Save PDF
        this.registry.action(
            'Save the current page as a PDF file'
        )(this, 'savePdf', {
            value: async (browser: BrowserContext): Promise<ActionResult> => {
                const page = await browser.get_current_page();
                const shortUrl = page.url().replace(/^https?:\/\/(?:www\.)?|\/$/g, '');
                const slug = shortUrl.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
                const sanitizedFilename = `${slug}.pdf`;

                await page.emulateMedia({ media: 'screen' });
                await page.pdf({ path: sanitizedFilename, format: 'A4', printBackground: false });
                
                const msg = `Saving page with URL ${page.url()} as PDF to ./${sanitizedFilename}`;
                console.info(msg);
                
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        // Tab Management Actions
        this.registry.action(
            'Switch tab'
        )(this, 'switchTab', {
            value: async (params: SwitchTabAction, browser: BrowserContext): Promise<ActionResult> => {
                await browser.swtch_to_tab(params.page_id);
                // Wait for tab to be ready
                const page = await browser.get_current_page();
                await page.waitForLoadState();
                
                const msg = `🔄 Switched to tab ${params.page_id}`;
                console.info(msg);
                
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        this.registry.action(
            'Open url in new tab'
        )(this, 'openTab', {
            value: async (params: OpenTabAction, browser: BrowserContext): Promise<ActionResult> => {
                await browser.create_new_tab(params.url);
                
                const msg = `🔗 Opened new tab with ${params.url}`;
                console.info(msg);
                
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        // Content Actions
        this.registry.action(
            'Extract page content to retrieve specific information from the page, e.g. all company names, a specifc description, all information about, links with companies in structured format or simply links'
        )(this, 'extractContent', {
            value: async (goal: string, browser: BrowserContext, pageExtractionLlm: BaseChatModel): Promise<ActionResult> => {
                const page = await browser.get_current_page();
                
                // Assuming a markdownify function exists or is imported
                const markdownify = require('markdownify');
                const content = markdownify.markdownify(await page.content());

                const prompt = 'Your task is to extract the content of the page. You will be given a page and a goal and you should extract all relevant information around this goal from the page. If the goal is vague, summarize the page. Respond in json format. Extraction goal: {goal}, Page: {page}';
                const template = new PromptTemplate({
                    inputVariables: ['goal', 'page'],
                    template: prompt
                });
                
                try {
                    const formattedPrompt = await template.format({ goal, page: content }) as BaseLanguageModelInput;
                    const output = await pageExtractionLlm.invoke(formattedPrompt);
                    const msg = `📄 Extracted from page\n: ${output.content}\n`;
                    console.info(msg);
                    
                    return {
                        extractedContent: msg,
                        includeInMemory: true
                    };
                } catch (e) {
                    console.debug(`Error extracting content: ${e}`);
                    const msg = `📄 Extracted from page\n: ${content}\n`;
                    console.info(msg);
                    
                    return {
                        extractedContent: msg
                    };
                }
            }
        });

        // Scroll Actions
        this.registry.action(
            'Scroll down the page by pixel amount - if no amount is specified, scroll down one page'
        )(this, 'scrollDown', {
            value: async (params: ScrollAction, browser: BrowserContext): Promise<ActionResult> => {
                const page = await browser.get_current_page();
                
                if (params.amount !== null && params.amount !== undefined) {
                    await page.evaluate(`window.scrollBy(0, ${params.amount});`);
                } else {
                    await page.evaluate('window.scrollBy(0, window.innerHeight);');
                }

                const amount = params.amount !== null && params.amount !== undefined ? `${params.amount} pixels` : 'one page';
                const msg = `🔍 Scrolled down the page by ${amount}`;
                console.info(msg);
                
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        this.registry.action(
            'Scroll up the page by pixel amount - if no amount is specified, scroll up one page'
        )(this, 'scrollUp', {
            value: async (params: ScrollAction, browser: BrowserContext): Promise<ActionResult> => {
                const page = await browser.get_current_page();
                
                if (params.amount !== null && params.amount !== undefined) {
                    await page.evaluate(`window.scrollBy(0, -${params.amount});`);
                } else {
                    await page.evaluate('window.scrollBy(0, -window.innerHeight);');
                }

                const amount = params.amount !== null && params.amount !== undefined ? `${params.amount} pixels` : 'one page';
                const msg = `🔍 Scrolled up the page by ${amount}`;
                console.info(msg);
                
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        // Send Keys
        this.registry.action(
            'Send strings of special keys like Escape,Backspace, Insert, PageDown, Delete, Enter, Shortcuts such as `Control+o`, `Control+Shift+T` are supported as well. This gets used in keyboard.press.'
        )(this, 'sendKeys', {
            value: async (params: SendKeysAction, browser: BrowserContext): Promise<ActionResult> => {
                const page = await browser.get_current_page();

                try {
                    await page.keyboard.press(params.keys);
                } catch (e) {
                    if (String(e).includes('Unknown key')) {
                        // Loop over the keys and try to send each one
                        for (const key of params.keys) {
                            try {
                                await page.keyboard.press(key);
                            } catch (keyError) {
                                console.debug(`Error sending key ${key}: ${String(keyError)}`);
                                throw keyError;
                            }
                        }
                    } else {
                        throw e;
                    }
                }
                
                const msg = `⌨️ Sent keys: ${params.keys}`;
                console.info(msg);
                
                return {
                    extractedContent: msg,
                    includeInMemory: true
                };
            }
        });

        // Scroll to Text
        this.registry.action(
            'If you dont find something which you want to interact with, scroll to it'
        )(this, 'scrollToText', {
            value: async (text: string, browser: BrowserContext): Promise<ActionResult> => {
                const page = await browser.get_current_page();
                
                try {
                    // Try different locator strategies
                    const locators = [
                        page.getByText(text, { exact: false }),
                        page.locator(`text=${text}`),
                        page.locator(`//*[contains(text(), '${text}')]`)
                    ];

                    for (const locator of locators) {
                        try {
                            // First check if element exists and is visible
                            if (await locator.count() > 0 && await locator.first().isVisible()) {
                                await locator.first().scrollIntoViewIfNeeded();
                                await new Promise(resolve => setTimeout(resolve, 500)); // Wait for scroll to complete
                                
                                const msg = `🔍 Scrolled to text: ${text}`;
                                console.info(msg);
                                
                                return {
                                    extractedContent: msg,
                                    includeInMemory: true
                                };
                            }
                        } catch (locatorError) {
                            console.debug(`Locator attempt failed: ${String(locatorError)}`);
                            continue;
                        }
                    }

                    const msg = `Text '${text}' not found or not visible on page`;
                    console.info(msg);
                    
                    return {
                        extractedContent: msg,
                        includeInMemory: true
                    };
                } catch (e) {
                    const msg = `Failed to scroll to text '${text}': ${String(e)}`;
                    console.error(msg);
                    
                    return {
                        error: msg,
                        includeInMemory: true
                    };
                }
            }
        });
    }

    /**
     * Decorator for registering custom actions
     * @param description Describe what the function does
     */
    action(description: string, ...args: any[]): any {
        return this.registry.action(description, ...args);
    }

    /**
     * Execute an action
     * @param action The action to execute
     * @param browserContext The browser context
     * @param pageExtractionLlm Optional LLM for page extraction
     * @param sensitiveData Optional sensitive data
     * @param availableFilePaths Optional available file paths
     * @param context Optional context
     */
    async act(
        action: any,
        browserContext: BrowserContext,
        pageExtractionLlm?: BaseChatModel,
        sensitiveData?: Record<string, string>,
        availableFilePaths?: string[],
        context?: Context
    ): Promise<ActionResult> {
        try {
            for (const [actionName, params] of Object.entries(action)) {
                if (params !== null && params !== undefined) {
                    // Create a context object with all required parameters
                    const contextObj = {
                        browser: browserContext,
                        pageExtractionLlm,
                        sensitiveData,
                        availableFilePaths,
                        userContext: context
                    };

                    // Pass the parameters as needed by the registry's executeAction method
                    const result = await this.registry.executeAction(
                        actionName,
                        params,
                        contextObj as unknown as Context
                    );

                    if (typeof result === 'string') {
                        return { extractedContent: result };
                    } else if (result && typeof result === 'object') {
                        return result as ActionResult;
                    } else if (result === null || result === undefined) {
                        return {};
                    } else {
                        throw new Error(`Invalid action result type: ${typeof result} of ${result}`);
                    }
                }
            }
            return {};
        } catch (e) {
            throw e;
        }
    }
}