// --- 辅助函数：获取服务器连接配置 ---
import vscode, { Uri } from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/** 从服务器定义构建通用的 ServerConfig 对象，overrides 可覆盖 username/password 等字段 */
function buildServerConfig(server: any, namespace: string, overrides?: { username?: string; password?: string }) {
    if (!server || !server.webServer) {
        throw new Error('服务器配置缺少 webServer 信息');
    }
    const scheme = server.webServer.scheme ? 'https' : 'http';
    const host = server.webServer.host || 'localhost';
    const port = server.webServer.port || 52773;
    return {
        baseURL: `${scheme}://${host}:${port}/api/atelier`,
        username: overrides?.username || server.username,
        password: overrides?.password || server.password,
        namespace: namespace || 'User'
    };
}

/** 获取所有已配置的服务器列表 */
function getAllServers(): { [key: string]: any } {
    const config = vscode.workspace.getConfiguration('intersystems');
    const servers = config.get<{ [key: string]: any }>('servers');
    if (!servers || Object.keys(servers).length === 0) {
        throw new Error('没有配置任何 InterSystems 服务器');
    }
    return servers;
}

/** isfs:// 协议：从 URI authority 提取服务器名和命名空间 */
export function getServerConfig(url: Uri) {
    console.log(`查找${url}对应的serverConfig`);
    const servers = getAllServers();
    const currentServerName: string = url.authority.split(':')[0];
    const currentServer = servers[currentServerName];
    console.log(`currentServer: ${JSON.stringify(currentServer)}`);
    if (!currentServer) {
        throw new Error(`找不到服务器配置: ${currentServerName}`);
    }
    const namespace = url.authority.split(':')[1] || 'User';
    return buildServerConfig(currentServer, namespace);
}

/** file:// 协议：从 objectscript.conn（.code-workspace / .vscode/settings.json）或插件配置读取默认服务器 */
export async function getLocalServerConfig(outputChannel?: vscode.OutputChannel, targetFolder?: vscode.Uri): Promise<{ baseURL: string; username: string; password: string; namespace: string; serverName: string }> {
    const servers = getAllServers();
    const serverNames = Object.keys(servers);

    // 确定要查询配置的目标 scope（优先使用传入的 folder，否则取第一个工作区文件夹）
    const wsFolders = vscode.workspace.workspaceFolders || [];
    const queryScope = targetFolder
        ? vscode.workspace.getWorkspaceFolder(targetFolder)
        : wsFolders[0] || undefined;

    // ============================================================
    // 优先级1: 从 objectscript.conn 获取服务器名（必须带 workspaceFolder scope！）
    //   不带 scope 时，VSCode 合并多层级配置可能导致 .server 字段丢失
    //   参考 vscode-objectscript 的 config("conn", configName) 写法
    // ============================================================
    let objConn: any = null;
    let connSource = '(无)';

    // 方式A: 带 scope 的查询（最准确，与 vscode-objectscript 一致）
    if (queryScope) {
        objConn = vscode.workspace.getConfiguration('objectscript', queryScope).get('conn');
        connSource = `objectscript (scope=${queryScope.name})`;
        outputChannel?.appendLine(`[CONFIG-DIAG] 方式A (folder scope): scope="${queryScope.name}", uri=${queryScope.uri.fsPath}`);
        outputChannel?.appendLine(`[CONFIG-DIAG] 方式A result: ${JSON.stringify(objConn)}`);
    }

    // 方式B: 如果方式A没拿到 server，再试不带 scope（作为对比日志输出）
    const objConnNoScope: any = vscode.workspace.getConfiguration('objectscript').get('conn');
    outputChannel?.appendLine(`[CONFIG-DIAG] 方式B (no scope): ${JSON.stringify(objConnNoScope)}`);

    // 如果方式A没拿到有效结果，用方式B的结果
    if (!objConn || !objConn.server) {
        if (objConnNoScope && objConnNoScope.server) {
            objConn = objConnNoScope;
            connSource = 'objectscript (no-scope fallback)';
            outputChannel?.appendLine(`[CONFIG-DIAG] 使用方式B (no-scope) 作为 fallback`);
        }
    }

    // 遍历所有 workspace folder，尝试找到有 server 配置的 folder（处理多根工作区场景）
    if ((!objConn || !objConn.server) && wsFolders.length > 1) {
        for (const folder of wsFolders) {
            const folderConn: any = vscode.workspace.getConfiguration('objectscript', folder).get('conn');
            outputChannel?.appendLine(`[CONFIG-DIAG] 扫描 folder "${folder.name}": conn=${JSON.stringify(folderConn)}`);
            if (folderConn && folderConn.server && servers[folderConn.server]) {
                objConn = folderConn;
                connSource = `objectscript (scan folder="${folder.name}")`;
                outputChannel?.appendLine(`[CONFIG-DIAG] 从 folder "${folder.name}" 找到有效配置`);
                break;
            }
        }
    }

    // 输出最终确定的 objConn 信息
    outputChannel?.appendLine(`[CONFIG-DIAG] 最终 connSource="${connSource}", objConn.server="${objConn?.server || '(空)'}", objConn.ns="${objConn?.ns || '(空)'}"`);

    let selectedName: string;
    let namespace: string;
    let overrideUser: string | undefined;
    let overridePass: string | undefined;

    if (objConn && objConn.server && servers[objConn.server]) {
        selectedName = objConn.server;
        namespace = objConn.ns || '';
        overrideUser = objConn.username;
        overridePass = objConn.password;
        outputChannel?.appendLine(`[CONFIG-DIAG] ✓ 使用 objectscript.conn.server="${selectedName}"`);
    } else {
        // 优先级2: iris-linker.localExport.defaultServer 配置项
        outputChannel?.appendLine(`[CONFIG-DIAG] ✗ objectscript.conn 无效或 server 不在已配置列表中，进入 fallback...`);
        
        const ourConfig = vscode.workspace.getConfiguration('iris-linker.localExport');
        const defaultServer: string = ourConfig.get('defaultServer') || '';
        namespace = (ourConfig.get('defaultNamespace') as string) || '';

        if (defaultServer && servers[defaultServer]) {
            selectedName = defaultServer;
            outputChannel?.appendLine(`[CONFIG-DIAG] → 使用 iris-linker.localExport.defaultServer="${selectedName}"`);
        } else if (serverNames.length === 1) {
            selectedName = serverNames[0];
            outputChannel?.appendLine(`[CONFIG-DIAG] → 仅一个服务器，自动选择 "${selectedName}"`);
        } else {
            // 优先级3: 检查 intersystems.servers 中是否有标记为 active 的服务器
            const activeServerName = serverNames.find(name => servers[name]?.active);
            if (activeServerName) {
                const pickActive = await vscode.window.showInformationMessage(
                    `未在 objectscript.conn 中找到服务器配置。\n发现活跃服务器 "${activeServerName}"，是否使用？`,
                    { modal: true },
                    `使用 ${activeServerName}`, '手动选择'
                );
                if (pickActive === `使用 ${activeServerName}`) {
                    selectedName = activeServerName;
                    outputChannel?.appendLine(`[CONFIG-DIAG] → 使用 active 服务器 "${selectedName}"`);
                } else {
                    selectedName = await pickServerManually(serverNames, outputChannel);
                }
            } else {
                selectedName = await pickServerManually(serverNames, outputChannel);
            }
        }
    }

    const server = servers[selectedName];
    namespace = namespace || server.namespace || 'User';

    const result = buildServerConfig(server, namespace, { username: overrideUser, password: overridePass });
    
    // 输出详细的服务器选择日志，方便排查连错服务器的问题
    outputChannel?.appendLine(`[CONFIG] connSource: ${connSource}`);
    outputChannel?.appendLine(`[CONFIG] selected server name = "${selectedName}"`);
    outputChannel?.appendLine(`[CONFIG] server.webServer = ${JSON.stringify(server?.webServer)}`);
    outputChannel?.appendLine(`[CONFIG] resolved baseURL = ${result.baseURL}`);
    outputChannel?.appendLine(`[CONFIG] namespace = ${result.namespace}`);

    return { ...result, serverName: selectedName };
}

/** 手动选择服务器 */
async function pickServerManually(serverNames: string[], outputChannel?: vscode.OutputChannel): Promise<string> {
    const picked = await vscode.window.showQuickPick(serverNames, {
        placeHolder: '选择要同步的目标服务器',
        title: 'IRIS Linker - 选择服务器'
    });
    if (!picked) {
        throw new Error('用户取消了服务器选择');
    }
    outputChannel?.appendLine(`[CONFIG-DIAG] → 手动选择 "${picked}"`);
    return picked;
}
// --- 辅助函数：调用 XML Export API ---
export async function exportToXMLContent(docName: string, serverConfig: any): Promise<string> {
    // InterSystems Atelier API 的 XML Export 接口
    // POST /api/atelier/v7/{ns}/action/xml/export
    // Body: ["ClassName.cls"] 或 ["/csp/user/page.csp"]
    try {
        console.log(`要导出的文档名: ${docName}`);
        const response = await axios.post(
            `${serverConfig.baseURL}/v7/${serverConfig.namespace}/action/xml/export`,
            [docName], // 请求体是文档名数组
            {
                auth: {
                    username: serverConfig.username,
                    password: serverConfig.password
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        // 检查响应状态
        if (response.data && response.data.result && response.data.result.content) {
            // API 返回的内容通常在 result.content 数组中，或者是字符串
            // 根据官方插件源码，这里通常是一个包含 XML 字符串的数组，或者直接是字符串
            const content = response.data.result.content;
            return Array.isArray(content) ? content.join('\n') : content;
        } else {
            throw new Error('API 返回格式异常: ' + JSON.stringify(response.data));
        }

    } catch (error: any) {
        console.error('API 调用失败:',error);
        throw new Error('服务器导出失败: ' + (error.response ? JSON.stringify(error.response.data) : error.message));
    }
}

// --- 文件类型分类常量 ---
export const FILE_CATEGORIES = {
    // 类文件：使用点号分隔包名
    CLASS_FILES: ['.cls', '.mac', '.int'],
    
    // Web 文本文件：使用路径格式，UTF-8 编码
    WEB_TEXT_FILES: ['.csp', '.js', '.css', '.html', '.htm'],
    
    // 二进制文件：使用路径格式，Base64 编码
    BINARY_FILES: [
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', // 图片
        '.eot', '.otf', '.ttf', '.woff', '.woff2',               // 字体
        '.pdf'                                                      // PDF
    ]
};

// 所有支持的文件类型
export const SUPPORTED_EXTENSIONS = [
    ...FILE_CATEGORIES.CLASS_FILES,
    ...FILE_CATEGORIES.WEB_TEXT_FILES,
    ...FILE_CATEGORIES.BINARY_FILES
];

// --- 辅助函数：判断是否为二进制文件 ---
export function isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return FILE_CATEGORIES.BINARY_FILES.includes(ext);
}

// --- 辅助函数：读取文件内容，根据类型选择编码方式 ---
// content 必须是 string[]（Atelier API 规范）：
//   文本文件：按行拆分，去掉末尾空行（避免 CSP 文件越存越长）
//   二进制文件：Base64 分片，每片 24573 字节（3 的倍数，转 Base64 后 ≤32764 字节）
export function readFileContent(filePath: string): { content: string[]; enc: boolean } {
    if (isBinaryFile(filePath)) {
        // 二进制文件：分块 Base64 编码（参照 vscode-objectscript base64EncodeContent）
        const buffer = fs.readFileSync(filePath);
        const chunkSize = 24573;
        let start = 0;
        const chunks: string[] = [];
        while (start < buffer.byteLength) {
            chunks.push(buffer.toString('base64', start, start + chunkSize));
            start += chunkSize;
        }
        return { content: chunks, enc: true };
    } else {
        // 文本文件：按行拆分为字符串数组，去掉末尾空行
        const text = fs.readFileSync(filePath, 'utf8');
        const lines = text.split(/\r?\n/);
        // 去掉末尾多余的空行（避免 CSP/JS 文件每次保存后行数增加）
        while (lines.length > 1 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        return { content: lines, enc: false };
    }
}

// --- 辅助函数：调用 Atelier API 上传文档到服务器 ---
export async function importDocumentToServer(
    docName: string,
    filePath: string,
    serverConfig: any,
    ignoreConflict: boolean = true,
    outputChannel?: vscode.OutputChannel
): Promise<{ success: boolean; message: string }> {
    try {
        // 读取文件内容（content 是 string[]）
        const { content, enc } = readFileContent(filePath);
        
        // 构造请求体（与 vscode-objectscript putDoc 完全一致）
        const payload: { enc: boolean; content: string[]; mtime: number } = {
            enc: enc,
            content: content,
            mtime: -1   // -1 表示忽略冲突时间戳检查
        };

        // 对 docName 进行 URL 编码
        //   - CLS/MAC 等类文件：docName=User.MyClass.cls，无 /，直接 encodeURIComponent 即可
        //   - CSP/JS 等路径文件：docName=/imedical/web/csp/xxx.csp，以 / 开头
        //     若直接 encodeURIComponent，开头的 / 会被编码成 %2F，
        //     导致 URL 变成 /doc//imedical/...（双斜杠），服务器返回 404
        //     正确做法：去掉开头的 /，按路径段分别编码，再拼回 URL
        let encodedDocName: string;
        if (docName.startsWith('/')) {
            // 去掉开头 /，按 / 分段编码，再拼成路径
            const withoutLeadingSlash = docName.substring(1);
            encodedDocName = withoutLeadingSlash
                .split('/')
                .map(segment => encodeURIComponent(segment))
                .join('/');
        } else {
            encodedDocName = encodeURIComponent(docName);
        }
        
        // 发送 PUT 请求
        const url = `${serverConfig.baseURL}/v7/${serverConfig.namespace}/doc/${encodedDocName}?ignoreConflict=${ignoreConflict ? 1 : 0}`;
        
        outputChannel?.appendLine(`[REQUEST] PUT ${url}`);
        outputChannel?.appendLine(`[REQUEST] docName: ${docName}`);
        outputChannel?.appendLine(`[REQUEST] enc: ${enc}, content lines: ${content.length}, mtime: -1`);
        outputChannel?.appendLine(`[REQUEST] filePath: ${filePath}`);

        const response = await axios.put(
            url,
            payload,
            {
                auth: {
                    username: serverConfig.username,
                    password: serverConfig.password
                },
                headers: { 'Content-Type': 'application/json' }
            }
        );
        
        // 输出完整响应用于调试
        const respData = response.data;
        outputChannel?.appendLine(`[RESPONSE] status.errors: ${JSON.stringify(respData?.status?.errors)}`);
        outputChannel?.appendLine(`[RESPONSE] result.name: ${respData?.result?.name}`);
        outputChannel?.appendLine(`[RESPONSE] result.status: ${respData?.result?.status}`);
        outputChannel?.appendLine(`[RESPONSE] result.db: ${respData?.result?.db}`);
        outputChannel?.appendLine(`[RESPONSE] result.ts: ${respData?.result?.ts}`);

        // 成功判断：必须同时检查外层 status.errors 和内层 result.status
        const outerErrors = respData?.status?.errors || [];
        const innerStatus = respData?.result?.status || '';
        
        if (outerErrors.length === 0 && (!innerStatus || !innerStatus.startsWith('ERROR'))) {
            outputChannel?.appendLine(`[OK] ${docName} synced successfully`);
            return { success: true, message: `Successfully synced ${docName}` };
        } else {
            const errorMsg = innerStatus || outerErrors.map((e: any) => e.message || JSON.stringify(e)).join('; ');
            outputChannel?.appendLine(`[FAIL] ${docName}: ${errorMsg}`);
            return { success: false, message: errorMsg };
        }
        
    } catch (error: any) {
        const errMsg = error.response 
            ? JSON.stringify(error.response.data) 
            : error.message;
        outputChannel?.appendLine(`[ERROR] ${docName}: ${errMsg}`);
        if (error.response?.data) {
            outputChannel?.appendLine(`[ERROR-DETAIL] ${JSON.stringify(error.response.data)}`);
        }
        return {
            success: false,
            message: '服务器同步失败: ' + errMsg
        };
    }
}
