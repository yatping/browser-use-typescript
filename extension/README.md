# Browser Agent Extension

A Chrome extension that uses an agent to execute actions in the current tab. The extension allows users to input their desired actions, which are then executed in the current tab with feedback sent back to the agent for next steps.

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Generate icons:
```bash
npm run generate-icons
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
- Open Chrome and go to `chrome://extensions/`
- Enable "Developer mode" in the top right
- Click "Load unpacked" and select the `extension` folder

## Development Server

For easier development, you can use the development server:

```bash
npm run dev
```

This will:
1. Build the extension
2. Start a local server at http://localhost:3000
3. Run the TypeScript compiler in watch mode for automatic recompilation

To use the development server:
1. Load the extension in Chrome as described above
2. When you make changes to the code, the TypeScript compiler will automatically recompile
3. Click the "Reload" button in chrome://extensions/ to reload the extension with your changes

## Project Structure

```
extension/
├── src/                    # Source files
│   ├── types/             # TypeScript type definitions
│   ├── popup.html         # Extension popup interface
│   ├── popup.ts           # Popup logic
│   ├── content.ts         # Content script for page interaction
│   └── background.ts      # Background script for extension logic
├── dist/                  # Compiled files (generated)
├── icons/                 # Extension icons
├── manifest.json          # Extension configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Project dependencies
├── build.js              # Build script
└── dev-server.js         # Development server
```

## Development

- Run `npm run watch` to automatically compile TypeScript files on changes
- Run `npm run build` to build the extension
- Run `npm run dev` to start the development server
- After making changes, reload the extension in Chrome

## Features

- TypeScript support for better type safety and development experience
- Modular architecture with separate content and background scripts
- Support for various actions (click, type, getText)
- Clean and modern UI for user input
- Error handling and status feedback
- Development server for easier development

## TODO

- Implement agent integration
- Add more action types
- Add error retry mechanisms
- Implement the feedback loop with the agent 