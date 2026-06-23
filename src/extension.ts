// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CspResourceLinkProvider } from './provider/CspResourceLinkProvider';
import * as path from 'path';
const LAST_SAVE_PATH_KEY = 'iris-linker.lastSavePath';
import * as fs from 'fs';
import * as cp from 'child_process';
import { exportToXMLContent, getServerConfig, getLocalServerConfig, importDocumentToServer, FILE_CATEGORIES, SUPPORTED_EXTENSIONS } from './tool/tool';

/** cls/mac/int 类文件使用点号分隔包名；其他文件使用下划线分隔目录名 */
function getPathSeparator(extName: string): string {
    return FILE_CATEGORIES.CLASS_FILES.includes(extName) ? '.' : '_';
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
        if (docName.startsWith('/') && FILE_CATEGORIES.CLASS_FILES.some(ext => lc.endsWith(ext))) {
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
    if (FILE_CATEGORIES.CLASS_FILES.some(ext => lc.endsWith(ext))) {
        return relative.replace(/\//g, '.');
    }
    // csp/js/css 保持路径格式（不以 / 开头的补上）
    return relative.startsWith('/') ? relative : '/' + relative;
}

/** 从 Git 相对路径直接计算 docName（不依赖 VSCode workspace folder） */
function getDocumentNameFromGitPath(gitRelativePath: string): string {
    let relative = gitRelativePath.replace(/\\/g, '/');

    // 如果配置了 stripPrefix，去掉前面的路径前缀
    const stripPrefix: string = vscode.workspace.getConfiguration('iris-linker.localExport').get('stripPrefix') || '';
    if (stripPrefix && relative.startsWith(stripPrefix)) {
        relative = relative.substring(stripPrefix.length);
    }

    const lc = relative.toLowerCase();
    if (FILE_CATEGORIES.CLASS_FILES.some(ext => lc.endsWith(ext))) {
        return relative.replace(/\//g, '.');
    }
    // csp/js/css/html 保持路径格式（不以 / 开头的补上）
    return relative.startsWith('/') ? relative : '/' + relative;
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

// --- 辅助函数：获取 Git 仓库根目录 ---
function getGitRoot(workspaceRoot: string): string {
    try {
        const stdout = cp.execSync('git rev-parse --show-toplevel', {
            cwd: workspaceRoot,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return stdout.trim().replace(/\\/g, '/');
    } catch {
        // 如果失败，返回原工作区路径
        return workspaceRoot.replace(/\\/g, '/');
    }
}

// --- 辅助函数：从 Git 获取修改的文件列表 ---
function getGitChangedFiles(workspaceRoot: string): string[] {
    try {
        // 获取已修改和已暂存的文件
        const changed = cp.execSync('git diff --name-only HEAD', {
            cwd: workspaceRoot,
            encoding: 'utf8'
        }).split('\n').filter(f => f.trim());

        // 获取未跟踪的新文件
        const untracked = cp.execSync('git ls-files --others --exclude-standard', {
            cwd: workspaceRoot,
            encoding: 'utf8'
        }).split('\n').filter(f => f.trim());

        return [...changed, ...untracked];
    } catch (error) {
        throw new Error(`Git 操作失败: ${error}`);
    }
}

// --- 辅助函数：过滤 IRIS 支持的文件类型 ---
function filterIRISFiles(files: string[]): string[] {
    return files.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return SUPPORTED_EXTENSIONS.includes(ext);
    });
}

export function activate(context: vscode.ExtensionContext) {

	// 创建 Output Channel，用于输出同步日志
	const outputChannel = vscode.window.createOutputChannel('IRIS Linker');
	context.subscriptions.push(outputChannel);

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
        outputChannel.appendLine('=== 导出 XML 开始 ===');
        outputChannel.show(true);

        // --- 处理文件 URI ---
        if (!uri) {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showWarningMessage('please select a file');
                return;
            }
            uri = activeEditor.document.uri;
        }
        outputChannel.appendLine(`[EXPORT] uri: scheme=${uri.scheme}, path=${uri.path}, fsPath=${uri.fsPath}`);

        // 计算建议的保存文件名
        const displayName = getSuggestedFileName(uri);
        const suggestedFileName = `${displayName}.xml`;
        outputChannel.appendLine(`[EXPORT] 建议文件名: ${suggestedFileName}`);

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

        if (saveUri) {
            let docName = '';
            try {
                // 根据协议获取服务器配置
                let serverConfig;
                if (uri.scheme === 'isfs') {
                    serverConfig = getServerConfig(uri);
                    outputChannel.appendLine(`[EXPORT] 使用 isfs 协议，直接从 URI 获取配置`);
                } else {
                    // file:// 本地文件（传入文件 uri 确保 objectscript.conn 读取正确的作用域）
                    serverConfig = await getLocalServerConfig(outputChannel, uri);
                    outputChannel.appendLine(`[EXPORT] 使用 file 协议，从 objectscript.conn 获取配置`);
                }
                outputChannel.appendLine(`[EXPORT] serverConfig: baseURL=${serverConfig.baseURL}, ns=${serverConfig.namespace}, serverName=${serverConfig.serverName || '(无)'}, username=${serverConfig.username}`);

                // 计算文档名并导出
                docName = getDocumentName(uri);
                outputChannel.appendLine(`[EXPORT] 计算出的 docName: "${docName}"`);

                const xmlContent = await exportToXMLContent(docName, serverConfig, outputChannel);
                outputChannel.appendLine(`[EXPORT] 导出内容长度: ${xmlContent.length}`);

                if (xmlContent.length === 0) {
                    outputChannel.appendLine(`[EXPORT] ⚠ 导出内容为空！可能 docName 无效或服务器上不存在此文档`);
                    vscode.window.showWarningMessage(`导出结果为空，请检查 IRIS Linker 输出面板中的日志`);
                }

                await vscode.workspace.fs.writeFile(saveUri, Buffer.from(xmlContent, 'utf8'));
                await context.globalState.update(LAST_SAVE_PATH_KEY, path.dirname(saveUri.fsPath));
                outputChannel.appendLine(`[EXPORT] 文件已保存到: ${saveUri.fsPath}`);
                outputChannel.appendLine('=== 导出 XML 完成 ===');

                const openAction = 'Open';
                const result = await vscode.window.showInformationMessage(
                    'Exported successfully. Open folder?',
                    { modal: false },
                    openAction
                );
                if (result === openAction) {
                    await vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            } catch (error: any) {
                outputChannel.appendLine(`[EXPORT] ✗ 导出失败: ${error.message || error}`);
                if (error.isDeployed) {
                    // 提取类名用于提示
                    const match = (error.rawBody || '').match(/Class\s+'([^']+)'/i);
                    const className = match ? match[1] : docName;
                    vscode.window.showWarningMessage(
                        `"${className}" 处于发布模式（Deployed Mode），无法导出。请在 IRIS 服务端重新编译该类。`,
                        { modal: false }
                    );
                } else {
                    vscode.window.showErrorMessage(`Export failed: ${error.message || error}`);
                }
            }
        } else {
            outputChannel.appendLine(`[EXPORT] 用户取消了保存对话框`);
        }
    });
    context.subscriptions.push(exportCommand);

    // 3. 注册批量同步命令
    const syncCommand = vscode.commands.registerCommand('iris-linker.syncAllToServer', async () => {
        console.log('iris-linker syncAllToServer');
        outputChannel.appendLine('=== 同步开始 ===');
        outputChannel.show(true); // 显示 Output 面板但不抢焦点

        try {
            // 获取工作区根目录
            const wsFolder = vscode.workspace.workspaceFolders?.[0];
            if (!wsFolder) {
                throw new Error('没有打开的工作区');
            }

            // 检查是否为 Git 仓库，并获取 Git 根目录
            let gitRoot: string;
            try {
                gitRoot = getGitRoot(wsFolder.uri.fsPath);
                outputChannel.appendLine(`Git root: ${gitRoot}`);
            } catch {
                throw new Error('当前工作区不是 Git 仓库');
            }

            // 获取修改文件列表（路径相对于 Git 根目录）
            const allChangedFiles = getGitChangedFiles(gitRoot);
            outputChannel.appendLine(`Git changed files (all): ${allChangedFiles.length}`);
            allChangedFiles.forEach(f => outputChannel.appendLine(`  [git] ${f}`));

            // 是否包含未跟踪文件
            const includeUntracked: boolean = vscode.workspace.getConfiguration('iris-linker.sync').get('includeUntracked') || false;
            let filesToProcess = includeUntracked ? allChangedFiles : allChangedFiles.filter(f => f.trim());

            // 过滤 IRIS 支持的文件类型
            const irisFiles = filterIRISFiles(filesToProcess);
            outputChannel.appendLine(`IRIS files to sync: ${irisFiles.length}`);
            irisFiles.forEach(f => outputChannel.appendLine(`  [sync] ${f}`));

            if (irisFiles.length === 0) {
                vscode.window.showInformationMessage('没有需要同步的 IRIS 文件');
                return;
            }

            // 确认
            const confirmBeforeSync: boolean = vscode.workspace.getConfiguration('iris-linker.sync').get('confirmBeforeSync') !== false;
            if (confirmBeforeSync) {
                const fileList = irisFiles.map(f => `  • ${f}`).join('\n');
                const choice = await vscode.window.showInformationMessage(
                    `即将同步 ${irisFiles.length} 个文件到 IRIS 服务器:\n\n${fileList}\n\n是否继续?`,
                    { modal: true },
                    '同步', '取消'
                );
                if (choice !== '同步') {
                    outputChannel.appendLine('用户取消了同步');
                    return;
                }
            }

            // 获取服务器配置（传入 workspaceFolder 确保 objectscript.conn 读取正确的作用域）
            const serverConfig = await getLocalServerConfig(outputChannel, wsFolder.uri);
            outputChannel.appendLine(`Server: ${serverConfig.baseURL}, namespace: ${serverConfig.namespace}, serverName: ${serverConfig.serverName}`);

            // 是否忽略冲突
            const ignoreConflict: boolean = vscode.workspace.getConfiguration('iris-linker.sync').get('ignoreConflict') !== false;

            // 批量上传（带进度条）
            const total = irisFiles.length;
            let success = 0, failed = 0;
            const failedFiles: string[] = [];

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `同步到 IRIS 服务器`,
                cancellable: true
            }, async (progress, token) => {
                const gitRootUri = vscode.Uri.file(gitRoot);
                for (let i = 0; i < total; i++) {
                    if (token.isCancellationRequested) {
                        failedFiles.push('用户取消了操作');
                        break;
                    }

                    const file = irisFiles[i];
                    const fileUri = vscode.Uri.joinPath(gitRootUri, file);
                    // 直接从 Git 相对路径计算 docName，不依赖 getWorkspaceFolder
                    const docName = getDocumentNameFromGitPath(file);
                    const isBinary = FILE_CATEGORIES.BINARY_FILES.includes(path.extname(file).toLowerCase());
                    const typeLabel = isBinary ? ' (binary)' : '';

                    progress.report({
                        message: `${i + 1}/${total} - ${path.basename(file)}${typeLabel}`,
                        increment: 100 / total
                    });

                    outputChannel.appendLine(`--- [${i + 1}/${total}] ${file} → docName: ${docName} ---`);

                    const result = await importDocumentToServer(docName, fileUri.fsPath, serverConfig, ignoreConflict, outputChannel);
                    if (result.success) {
                        success++;
                    } else {
                        failed++;
                        failedFiles.push(`${path.basename(file)}: ${result.message}`);
                    }
                }
            });

            // 显示汇总结果
            outputChannel.appendLine(`=== 同步完成: ${success} 成功, ${failed} 失败 ===`);
            
            let message = `同步完成: ${success} 个成功, ${failed} 个失败`;
            if (failedFiles.length > 0) {
                const showFailed = failedFiles.slice(0, 8);
                message += `\n\n失败列表:\n${showFailed.map(f => `  • ${f}`).join('\n')}`;
                if (failedFiles.length > 8) {
                    message += `\n  ... 还有 ${failedFiles.length - 8} 个`;
                }
            }

            if (failed === 0) {
                vscode.window.showInformationMessage(message);
            } else {
                vscode.window.showWarningMessage(message);
            }

        } catch (error: any) {
            outputChannel.appendLine(`=== 同步异常: ${error.message || error} ===`);
            vscode.window.showErrorMessage(`批量同步失败: ${error.message || error}`);
        }
    });
    context.subscriptions.push(syncCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
