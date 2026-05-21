# iris-linker README

A Visual Studio Code extension that provides CSP (Content Security Policy) resource linking capabilities.

## Features

- Document Link Provider: Automatically detects and creates clickable links for CSP resources in your code
- Custom Command: Includes a sample command iris-linker.csplinker for extension functionality
- TypeScript Support: Built with TypeScript for better type safety and developer experience

## Requirements

- Visual Studio Code 1.74.0 or higher
- Node.js 20.20.2 or higher

## Extension Settings

This extension currently has no configurable settings.

## Usage
### 一、retome csp link
1. Open a CSP file in Visual Studio Code
2. Resource links will be automatically detected and highlighted
3. Click on the links to navigate to the corresponding resources
### 二、export iris file
1. Right-click to export iris file

## Development

```bash
# Clone the repository
git clone <repository-url>
# Install dependencies
npm install
```


## Build
```bash
# Compile TypeScript
npm run compile

# Watch Mode
npm run watch
```
## Test

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```
## Project Structure

iris-linker/
├── src/
│   ├── extension.ts         # Main extension entry point
│   └── CSPResourceLinkProvider.ts  # Link provider implementation
├── out/                     # Compiled JavaScript output
├── .vscode/
│   ├── launch.json          # Debug configurations
│   └── tasks.json           # Build tasks
├── package.json             # Extension manifest
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file

## Publishing

```bash
# Install vsce (VS Code Extension Manager)
npm install -g @vscode/vsce

# Package the extension
vsce package

# Publish to VS Code Marketplace
vsce publish
```

Enjoy using iris-linker! 🚀
