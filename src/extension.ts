// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CspResourceLinkProvider } from './provider/CspResourceLinkProvider';
import * as path from 'path';
const LAST_SAVE_PATH_KEY = 'iris-linker.lastSavePath';
import { exportToXMLContent, getServerConfig } from './tool/tool';
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
		console.log(`uri: ${JSON.stringify(uri)}`);
        
        const fileExtName = path.extname(uri.fsPath);
        //let originalFileName = path.basename(uri.fsPath, fileExtName);
        let piece = ['.cls','.mac'].indexOf(fileExtName)>-1 ? "." : "_"; // 类使用点分割包名，csp,js,css,csr使用下划线分割目录名
        const originalFileName = uri.path.substring(1).replaceAll('/', piece);
        const suggestedFileName = `${originalFileName}.xml`;
        const lastSavePath = context.globalState.get<string>(LAST_SAVE_PATH_KEY);
        let defaultUri: vscode.Uri;
        if (lastSavePath) {
            defaultUri = vscode.Uri.joinPath(vscode.Uri.file(lastSavePath),suggestedFileName);
        }else{
            defaultUri = vscode.Uri.joinPath(vscode.Uri.file(require('os').homedir()),suggestedFileName);
        }
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: defaultUri,       // 关键：这里指定了默认路径和文件名
            saveLabel: 'Export',          // 按钮文字
            filters: { 'XML Files': ['xml'], 'All Files': ['*'] } // 文件过滤器
        });
        console.dir(saveUri);
        if (saveUri) {
            try {
                let xmlContent = '';
                console.log(`正在从服务器导出 ${uri.path} 到 ${saveUri}`);
                if (true || uri.scheme === 'isfs') {                    
                    // const {getServerConfig,exportToXMLContent} = require("./tool/tool");                    
                    // 获取配置
                    const serverConfig = getServerConfig(uri); // uri.authority = 138:dhc-app
                    console.log(`serverConfig: ${JSON.stringify(serverConfig)}`);
                    xmlContent = await exportToXMLContent(uri, serverConfig);
                    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(xmlContent, 'utf8'));
                    await context.globalState.update(LAST_SAVE_PATH_KEY, saveUri.fsPath);
                    const openAction = 'Open';                        
                    const result = await vscode.window.showInformationMessage(
                        'Exported successfully. Open folder?', 
                        { modal: false }, // 非模态，不会阻塞操作
                        openAction 
                    );
                    if (result === openAction) {
                        // const folderUri = vscode.Uri.joinPath(saveUri, '..');
                        await vscode.commands.executeCommand('revealFileInOS', saveUri);
                    }
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
