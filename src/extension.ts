// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CspResourceLinkProvider } from './provider/CspResourceLinkProvider';
import * as path from 'path';
const LAST_SAVE_PATH_KEY = 'iris-linker.lastSavePath';
import { exportToXMLContent, getServerConfig, getLocalServerConfig } from './tool/tool';

/** cls/mac/int 类文件使用点号分隔包名；csp/js/css 使用下划线分隔目录名 */
function getPathSeparator(extName: string): string {
    return ['.cls', '.mac', '.int'].includes(extName) ? '.' : '_';
}

/** 从 URI 计算建议的导出文件名 */
function getSuggestedFileName(uri: vscode.Uri): string {
    const ext = path.extname(uri.fsPath);
    const piece = getPathSeparator(ext);

    if (uri.scheme === 'isfs') {
        // isfs://138:dhc-app/User/MyClass.cls → User.MyClass.cls
        return uri.path.substring(1).replaceAll('/', piece);
    }

    // file://D:/workspace/src/User/MyClass.cls → 用 workspace 相对路径
    const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (wsFolder) {
        const relative = path.relative(wsFolder.uri.fsPath, uri.fsPath);
        return relative.replace(/\\/g, '/').replaceAll('/', piece);
    }
    // fallback：直接用文件名
    return path.basename(uri.fsPath);
}

/** 从 URI 计算要传给 Atelier API 的文档名 */
function getDocumentName(uri: vscode.Uri): string {
    if (uri.scheme === 'isfs') {
        let docName = uri.path;
        const lc = docName.toLowerCase();
        if (docName.startsWith('/') && (lc.endsWith('.cls') || lc.endsWith('.mac') || lc.endsWith('.int'))) {
            docName = docName.substring(1).replaceAll('/', '.');
        }
        return docName;
    }

    // file:// —— 从 workspace 相对路径计算
    const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!wsFolder) {
        throw new Error('本地文件导出必须在工作区中打开');
    }
    let relative = path.relative(wsFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');

    // 如果配置了 stripPrefix，去掉前面的路径前缀
    const stripPrefix: string = vscode.workspace.getConfiguration('iris-linker.localExport').get('stripPrefix') || '';
    if (stripPrefix && relative.startsWith(stripPrefix)) {
        relative = relative.substring(stripPrefix.length);
    }

    const lc = relative.toLowerCase();
    if (lc.endsWith('.cls') || lc.endsWith('.mac') || lc.endsWith('.int')) {
        return relative.replace(/\//g, '.');
    }
    // csp/js/css 保持路径格式（不以 / 开头的补上）
    return relative.startsWith('/') ? relative : '/' + relative;
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "iris-linker" is now active!');
	const extension = vscode.extensions.getExtension('wanghc.iris-linker'); // 注意替换成你的实际 publisher.name
	const version = extension ? extension.packageJSON.version : '未知版本3';
	const welcomeCommand = vscode.commands.registerCommand('iris-linker.version', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage(`welcome to iris-version ${version} !`);
	});
	context.subscriptions.push(welcomeCommand);
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const cspSelector: vscode.DocumentSelector = [
        { language: 'objectscript-csp', scheme: 'file' },
        { language: 'objectscript-csp', scheme: 'isfs' }
    ];
	const cspProvider = vscode.languages.registerDocumentLinkProvider(cspSelector,new CspResourceLinkProvider());
	context.subscriptions.push(cspProvider);
	// 2. 注册右键导出命令
    const exportCommand = vscode.commands.registerCommand('iris-linker.exportToXML', async (uri: vscode.Uri) => {
		console.log('iris-linker exportToXML');
        // --- 处理文件 URI ---
        if (!uri) {
            // 如果是通过命令面板触发，尝试获取当前活动文件
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showWarningMessage('please select a file');
                return;
            }
            uri = activeEditor.document.uri;
        }
        console.log(`uri: scheme=${uri.scheme}, path=${uri.path}`);

        // 计算建议的保存文件名
        const displayName = getSuggestedFileName(uri);
        const suggestedFileName = `${displayName}.xml`;
        const lastSavePath = context.globalState.get<string>(LAST_SAVE_PATH_KEY);
        let defaultUri: vscode.Uri;
        if (lastSavePath) {
            defaultUri = vscode.Uri.joinPath(vscode.Uri.file(lastSavePath), suggestedFileName);
        } else {
            defaultUri = vscode.Uri.joinPath(vscode.Uri.file(require('os').homedir()), suggestedFileName);
        }
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: defaultUri,
            saveLabel: 'Export',
            filters: { 'XML Files': ['xml'], 'All Files': ['*'] }
        });
        console.dir(saveUri);
        if (saveUri) {
            try {
                // 根据协议获取服务器配置
                let serverConfig;
                if (uri.scheme === 'isfs') {
                    serverConfig = getServerConfig(uri);
                } else {
                    // file:// 本地文件
                    serverConfig = await getLocalServerConfig();
                }
                console.log(`serverConfig namespace: ${serverConfig.namespace}`);

                // 计算文档名并导出
                const docName = getDocumentName(uri);
                console.log(`正在从服务器导出文档: ${docName}, 目标: ${saveUri.fsPath}`);

                const xmlContent = await exportToXMLContent(docName, serverConfig);
                await vscode.workspace.fs.writeFile(saveUri, Buffer.from(xmlContent, 'utf8'));
                await context.globalState.update(LAST_SAVE_PATH_KEY, path.dirname(saveUri.fsPath));
                const openAction = 'Open';
                const result = await vscode.window.showInformationMessage(
                    'Exported successfully. Open folder?',
                    { modal: false },
                    openAction
                );
                if (result === openAction) {
                    await vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            } catch (error) {
                console.error('导出失败:', error);
                vscode.window.showErrorMessage(`Export failed: ${error}`);
            }
        }
    });
    context.subscriptions.push(exportCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
