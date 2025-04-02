# browser-use-typescript

A TypeScript port of the browser-use library, providing a powerful and flexible framework for browser automation using Large Language Models (LLMs).

## Features

- **LLM-Powered Automation**: Leverage the power of Large Language Models for intelligent browser automation
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Async/Await Support**: Built with modern JavaScript practices for better control flow
- **DOM Manipulation**: Advanced DOM traversal and manipulation capabilities
- **Performance Metrics**: Built-in performance tracking and optimization
- **Error Handling**: Robust error handling and recovery mechanisms
- **Modular Design**: Clean architecture for easy extension and customization

## Installation

```bash
npm install browser-use-typescript@latest
```

## Quick Start

```typescript
import { Agent } from 'browser-use-typescript';
import { ChatOpenAI } from "@langchain/openai";

async function example() {
    const llm=new ChatOpenAI({
      modelName: "gpt-4o-mini", 
      temperature: 0,
      openAIApiKey:"Your API key" // Or setup it in the env
    })  
    const agent=new Agent("use the search function,you will see click on the captcha green button, click it and then try using the search function again tell me which domnain you land on the last time",llm)
    
```

## Key Components

### Agent
The main interface for browser automation. Handles high-level operations and coordinates between different components.

### Browser Context
Manages browser state and provides low-level browser operations. Uses an async initialization pattern for better performance:
- Async initialization in constructor
- Promise-based state management
- Initialization state verification
- Safe method execution with state checks

### DOM Service
Handles DOM manipulation and traversal with efficient caching mechanisms:
- Element location caching
- Computed style caching
- Efficient DOM tree traversal
- Smart element selection strategies

### Controller Context
Manages the execution flow and coordinates between the agent and browser components:
- Action registry management
- State synchronization
- Error handling and recovery
- Event management

## Advanced Usage

### Custom Actions
```typescript

 //You can also use just the controller to perform actions on the browser, or expose them as tools(Example coming soon)
 const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      openAIApiKey: "Your OPENAI key"
    });

    agent = new Agent("hey", llm);
    controller = agent.controller; // Performs Functions on the browser
    browserContext = agent.browser_context; //Browser bridge
  });

  // Helper function to create action models and test them
  async function testAction(actionName: string, params: any) {
    const registry = controller.registry.getActions()[actionName];
    
    if (!registry) {
      console.warn(`Action "${actionName}" not found in registry`);
      return null;
    }
    
    // Ensure we have a valid paramModel (empty object if none is defined)
    const paramModel = registry.paramModel || z.object({});
    const actionModel = new ActionModel({ [actionName]: paramModel }, params);
    
    console.log(`=== Testing ${actionName} action ===`);
    
    try {
      if (browserContext) {
        const result = await controller.act(actionModel, browserContext, agent.settings.page_extraction_llm);
        console.log(`${actionName} result:`, result);
        return result;
      } else {
        console.error("Browser context is null, cannot call controller.act");
        return null;
      }
    } catch (error) {
      console.error(`${actionName} action failed:`, error);
      return null;
    }
  }

  const searchResult= async () => {
    const result = await testAction('search', { query: "typescript testing" });
}
   

```

## API Documentation

### Agent Class
- `init()`: Initialize the agent and browser context
- `act(instruction: string)`: Perform an action based on natural language instruction
- `extract(query: string)`: Extract information from the page
- `navigate(url: string)`: Navigate to a URL
- `verify(condition: string)`: Verify a condition on the page

### Browser Context
- `initialize()`: Set up browser environment
- `getPage()`: Get current page instance
- `executeScript()`: Execute JavaScript in page context
- `_ensure_initialized()`: Internal method to verify initialization

### DOM Service
- `findElement()`: Find elements using various strategies
- `getAttribute()`: Get element attributes
- `modifyElement()`: Modify element properties
- `buildDomTreeOverlay()`: Create DOM tree visualization


<video width="640" height="640" controls>
  <source src="https://asset.cloudinary.com/dqgclphiu/a86fcf4c5dc9ef5c14e81d3b1cb89911" type="video/webm">
  Your browser does not support the video tag.
</video>
## Contributing

Contributions are welcome! Please read our contributing guidelines for details on our code of conduct and the process for submitting pull requests.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

This project is a TypeScript port of the original browser-use project, enhanced with:
- Complete type safety
- Captcha Handling
- LangGraph Integration(Coming Soon)
- Improved error handling

## Support

- Documentation (Coming Soon)
- [Issue Tracker](https://github.com/yourusername/browser-use-typescript/issues)
- [Discussions](https://github.com/yourusername/browser-use-typescript/discussions)

## Version History

Current Version: 1.0.10
- Added comprehensive TypeScript support
- Implemented async initialization pattern
- Enhanced DOM manipulation capabilities
- Improved performance with caching mechanisms
- Added type definitions for all components
