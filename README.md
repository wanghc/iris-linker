# iris-linker

> InterSystems IRIS 开发辅助工具 · VS Code 扩展  
> InterSystems IRIS Development Assistant for VS Code

[English](#english) | [中文](#中文)

---

## English

### Features

**1. CSP Resource Link Navigation**
- In `.csp` files, `Ctrl+Click` on `<script src="...">` and `<link href="...">` references to jump directly to the target JS/CSS files.

**2. Right-click Export to XML**
- Right-click any supported file in the editor, file explorer, or tab title.
- Exports the server-side XML content of IRIS documents via the **Atelier API** (`GET /api/atelier/v7/{ns}/action/xml/export/{docName}`).
- Works with both `isfs://` (remote) and `file://` (local workspace) protocols.
- Supports: `.cls` `.mac` `.int` `.csp` `.js` `.css` `.html` `.png` `.jpg` `.gif` `.bmp` `.ico` `.webp` `.eot` `.otf` `.ttf` `.woff` `.woff2` `.pdf`

**3. Batch Sync to IRIS Server**
- Click the ☁️ **"Sync All to IRIS Server"** button in the SCM (Git) view title bar.
- Detects all modified files in the Git working tree and uploads them to the IRIS server via Atelier API (`PUT /api/atelier/v7/{ns}/doc/{docName}`).
- Binary files (images, fonts, PDFs) are automatically Base64-encoded before upload.
- Real-time progress bar with success/failure summary.

### Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `iris-linker.localExport.defaultServer` | string | `""` | Default IRIS server name for local file export |
| `iris-linker.localExport.stripPrefix` | string | `""` | Strip prefix from workspace path when building doc name |
| `iris-linker.sync.ignoreConflict` | boolean | `true` | Ignore server-side conflicts when syncing |
| `iris-linker.sync.includeUntracked` | boolean | `false` | Include untracked files in sync |
| `iris-linker.sync.confirmBeforeSync` | boolean | `true` | Show confirmation dialog before syncing |

### Server Configuration (Local Workspace)

For `file://` workspaces, configure your IRIS connection in `.vscode/settings.json` or `.code-workspace`:

```json
{
  "objectscript.conn": {
    "server": "myiris",
    "ns": "USER",
    "username": "_SYSTEM",
    "password": "SYS"
  }
}
```

### Requirements

- VS Code `^1.110.0`
- InterSystems IRIS server with Atelier API enabled

### Installation

```bash
# From VSIX
code --install-extension iris-linker-0.0.7.vsix

# Or via VS Code: Extensions → ... → Install from VSIX
```

### Development
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

### License

MIT

---

## 中文

### 功能特性

**1. CSP 资源链接跳转**
- 在 `.csp` 文件中，`Ctrl+点击` `<script src="...">` 和 `<link href="...">` 引用，直接跳转到目标 JS/CSS 文件。

**2. 右键导出到 XML**
- 在编辑器、资源管理器或标签页标题右键点击任意支持的文件。
- 通过 **Atelier API** (`GET /api/atelier/v7/{ns}/action/xml/export/{docName}`) 导出 IRIS 服务端文档的 XML 内容。
- 同时支持 `isfs://`（远程连接）和 `file://`（本地工作区）两种协议。
- 支持文件类型：`.cls` `.mac` `.int` `.csp` `.js` `.css` `.html` `.png` `.jpg` `.gif` `.bmp` `.ico` `.webp` `.eot` `.otf` `.ttf` `.woff` `.woff2` `.pdf`

**3. 批量同步到 IRIS 服务器**
- 在 SCM（Git）视图标题栏点击 ☁️ **"Sync All to IRIS Server"** 按钮。
- 自动检测 Git 工作树中所有变更文件，通过 Atelier API (`PUT /api/atelier/v7/{ns}/doc/{docName}`) 一键上传到 IRIS 服务器。
- 二进制文件（图片、字体、PDF）自动 Base64 编码后上传。
- 实时进度条显示，完成后汇总成功/失败数及详情。

### 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `iris-linker.localExport.defaultServer` | string | `""` | 本地文件导出时的默认 IRIS 服务器名 |
| `iris-linker.localExport.stripPrefix` | string | `""` | 构建文档名时从工作区路径中剥离的前缀 |
| `iris-linker.sync.ignoreConflict` | boolean | `true` | 同步时忽略服务端冲突 |
| `iris-linker.sync.includeUntracked` | boolean | `false` | 同步时包含未跟踪的新文件 |
| `iris-linker.sync.confirmBeforeSync` | boolean | `true` | 同步前弹出确认对话框 |

### 本地工作区服务端配置

在 `file://` 协议本地工作区中，需在 `.vscode/settings.json` 或 `.code-workspace` 中配置 IRIS 连接信息：

```json
{
  "objectscript.conn": {
    "server": "myiris",
    "ns": "USER",
    "username": "_SYSTEM",
    "password": "SYS"
  }
}
```

### 环境要求

- VS Code `^1.110.0`
- 启用了 Atelier API 的 InterSystems IRIS 服务端

### 安装

```bash
# 通过 VSIX 安装
code --install-extension iris-linker-0.0.7.vsix

# 或在 VS Code 中: 扩展 → ... → 从 VSIX 安装
```

### 开发

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

### 开源协议

MIT
