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
export async function getLocalServerConfig(): Promise<{ baseURL: string; username: string; password: string; namespace: string }> {
    const servers = getAllServers();
    const serverNames = Object.keys(servers);

    // 优先级1: objectscript.conn（来自 .code-workspace 或 .vscode/settings.json，VSCode 已自动合并）
    const objConn: any = vscode.workspace.getConfiguration('objectscript').get('conn');
    let selectedName: string;
    let namespace: string;
    let overrideUser: string | undefined;
    let overridePass: string | undefined;

    if (objConn && objConn.server && servers[objConn.server]) {
        selectedName = objConn.server;
        namespace = objConn.ns || '';
        // objectscript.conn 中可能直接带了凭据
        overrideUser = objConn.username;
        overridePass = objConn.password;
    } else {
        // 优先级2: iris-linker.localExport.defaultServer 配置项
        const ourConfig = vscode.workspace.getConfiguration('iris-linker.localExport');
        const defaultServer: string = ourConfig.get('defaultServer') || '';
        namespace = (ourConfig.get('defaultNamespace') as string) || '';

        if (defaultServer && servers[defaultServer]) {
            selectedName = defaultServer;
        } else if (serverNames.length === 1) {
            selectedName = serverNames[0];
        } else {
            const picked = await vscode.window.showQuickPick(serverNames, {
                placeHolder: '选择要导出的目标服务器',
                title: 'IRIS Linker - 选择服务器'
            });
            if (!picked) {
                throw new Error('用户取消了服务器选择');
            }
            selectedName = picked;
        }
    }

    const server = servers[selectedName];
    // namespace 最终兜底
    namespace = namespace || server.namespace || 'User';
    return buildServerConfig(server, namespace, { username: overrideUser, password: overridePass });
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
    ignoreConflict: boolean = true
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
        
        // 发送 PUT 请求
        const response = await axios.put(
            `${serverConfig.baseURL}/v7/${serverConfig.namespace}/doc/${docName}?ignoreConflict=${ignoreConflict ? 1 : 0}`,
            payload,
            {
                auth: {
                    username: serverConfig.username,
                    password: serverConfig.password
                },
                headers: { 'Content-Type': 'application/json' }
            }
        );
        
        // 解析响应
        if (response.data && response.data.status && response.data.status.errors.length === 0) {
            return { success: true, message: `Successfully synced ${docName}` };
        } else {
            const errors = response.data.status.errors || [];
            return { success: false, message: errors.map((e: any) => e.message || JSON.stringify(e)).join('; ') };
        }
        
    } catch (error: any) {
        console.error('API 调用失败:', error);
        return {
            success: false,
            message: '服务器同步失败: ' + (error.response ? JSON.stringify(error.response.data) : error.message)
        };
    }
}
