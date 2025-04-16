import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, BaseMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Browser } from "../../browser/playwrightBrowser/browserService";
import { BrowserContext } from "../../browser/playwrightBrowser/browserContext";
import { Controller } from "../../controller/controllerContext";
import { 
  ActionResult,
  AgentError,
  AgentHistory,
  AgentHistoryList,
  AgentOutput,
  AgentSettings,
  AgentState,
  AgentStepInfo,
  StepMetadata,
  ToolCallingMethod
} from "../types";
import { BrowserState,BrowserStateHistory } from "../../browser/playwrightBrowser/type";
import { MessageManager, MessageManagerSettings } from "../message_manager/services";
import { SystemPrompt } from "../prompt";
import { ActionModel } from "../../controller/registry/types";

// Type for the callback functions
type NewStepCallback = 
  | ((browserState: BrowserState, agentOutput: AgentOutput, step: number) => void)
  | ((browserState: BrowserState, agentOutput: AgentOutput, step: number) => Promise<void>)
  | null;

type DoneCallback = 
  | ((agentHistoryList: AgentHistoryList) => Promise<void>)
  | ((agentHistoryList: AgentHistoryList) => void)
  | null;

type ExternalAgentStatusCallback = (() => Promise<boolean>) | null;

// Generic type to match Python's implementation
export class Agent<Context = any> {
  // Core components
  task: string;
  llm: BaseChatModel;
  controller: Controller<Context>;
  sensitive_data: Record<string, string> | null;
  
  // Settings
  settings: AgentSettings;
  
  // State
  state: AgentState;
  
  // Models and Actions
  available_actions: string;
  tool_calling_method: ToolCallingMethod;
  initial_actions: any[] | null;
  chat_model_library?: string;
  model_name?: string;
  browser_use_version?: string;
  browser_use_source?: string;
  
  // Message Management
  private _message_manager: MessageManager;
  
  // Browser
  browser: Browser | null;
  browser_context: BrowserContext | null;
  injected_browser: boolean;
  injected_browser_context: boolean;
  
  // Callbacks
  register_new_step_callback: NewStepCallback;
  register_done_callback: DoneCallback;
  register_external_agent_status_raise_error_callback: ExternalAgentStatusCallback;
  
  // Context
  context: Context | null;
  
  // Telemetry
  telemetry: any; // Replace with actual ProductTelemetry when implemented
  
  /**
   * Agent constructor 
   * Equivalent to Python's __init__ method
   */
  constructor(
    task: string,
    llm: BaseChatModel,
    // Optional parameters
    browser: Browser | null = null,
    browser_context: BrowserContext | null = null,
    controller: Controller<Context> = new Controller<Context>(),
    // Initial agent run parameters
    sensitive_data: Record<string, string> | null = null,
    initial_actions: Array<Record<string, Record<string, any>>> | null = null,
    // Cloud Callbacks
    register_new_step_callback: NewStepCallback = null,
    register_done_callback: DoneCallback = null,
    register_external_agent_status_raise_error_callback: ExternalAgentStatusCallback = null,
    // Agent settings
    use_vision: boolean = true,
    use_vision_for_planner: boolean = false,
    save_conversation_path?: string | null,
    save_conversation_path_encoding?: string | null,
    max_failures: number = 3,
    retry_delay: number = 10,
    override_system_message?: string | null,
    extend_system_message?: string | null,
    max_input_tokens: number = 128000,
    validate_output: boolean = false,
    message_context?: string | null,
    generate_gif: boolean | string = false,
    available_file_paths?: string[] | null,
    include_attributes: string[] = [
      'title',
      'type',
      'name',
      'role',
      'aria-label',
      'placeholder',
      'value',
      'alt',
      'aria-expanded',
      'data-date-format',
    ],
    max_actions_per_step: number = 10,
    tool_calling_method: ToolCallingMethod | null = 'auto',
    page_extraction_llm: BaseChatModel | null = null,
    planner_llm: BaseChatModel | null = null,
    planner_interval: number = 1,  // Run planner every N steps
    // Inject state
    injected_agent_state: AgentState | null = null,
    //
    context: Context | null = null,
  ) {
    const finalPageExtractionLlm = page_extraction_llm || llm;

    // Core components
    this.task = task;
    this.llm = llm;
    this.controller = controller;
    this.sensitive_data = sensitive_data;

    this.settings = new AgentSettings({
      use_vision,
      use_vision_for_planner,
      save_conversation_path: save_conversation_path ?? undefined,
      save_conversation_path_encoding: save_conversation_path_encoding ?? undefined,
      max_failures,
      retry_delay,
      override_system_message: override_system_message ?? undefined,
      extend_system_message: extend_system_message ?? undefined,
      max_input_tokens,
      validate_output,
      message_context: message_context ?? undefined,
      generate_gif,
      available_file_paths: available_file_paths ?? undefined,
      include_attributes,
      max_actions_per_step,
      tool_calling_method: tool_calling_method || 'auto',
      page_extraction_llm: finalPageExtractionLlm,
      planner_llm: planner_llm ?? undefined,
      planner_interval,
  });

    // Initialize state
    this.state = injected_agent_state || new AgentState();

    // Action setup
    this._setupActionModels();
    this._setBrowserUseVersionAndSource();
    this.initial_actions = initial_actions ? this._convertInitialActions(initial_actions) : null;

    // Model setup
    this._setModelNames();

    // For models without tool calling, add available actions to context
    this.available_actions = this.controller.registry.getPromptDescription();

    this.tool_calling_method = this._setToolCallingMethod();
    this.settings.message_context = this._setMessageContext();

    // Initialize message manager with state
    this._message_manager = new MessageManager(
      task,
      new SystemPrompt(
      this.available_actions,
  this.settings.max_actions_per_step,
        override_system_message??undefined,
        extend_system_message??undefined
      ).getSystemMessage(),
      {
        maxTokens: this.settings.max_input_tokens,
        numChatTurnsToKeep:10,
        imageTokens:800,
        includeAttributes: this.settings.include_attributes,
        messageContext: this.settings.message_context,
        sensitiveData:this.sensitive_data||undefined,
        availableFilePath: this.settings.available_file_paths,
      },
      this.state.message_manager_state
    );

    // Browser setup
    this.injected_browser = browser !== null;
    this.injected_browser_context = browser_context !== null;
    if (browser_context) {
      this.browser = browser;
      this.browser_context = browser_context;
    } else {
      this.browser = browser || new Browser();
      this.browser_context = new BrowserContext(this.browser, this.browser.config.new_context_config);
    }

    // Callbacks
    this.register_new_step_callback = register_new_step_callback;
    this.register_done_callback = register_done_callback;
    this.register_external_agent_status_raise_error_callback = register_external_agent_status_raise_error_callback;

    // Context
    this.context = context;

    // Telemetry - placeholder until implemented
    this.telemetry = {}; // Replace with actual ProductTelemetry implementation

    // Log conversation path if set
    if (this.settings.save_conversation_path) {
      console.info(`Saving conversation to ${this.settings.save_conversation_path}`);
    }
  }
}
