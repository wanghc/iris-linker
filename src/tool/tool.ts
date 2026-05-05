// --- 辅助函数：获取服务器连接配置 ---
import vscode, { Uri } from 'vscode';
import axios from 'axios';
export function getServerConfig(url:Uri) {    
    // 获取 vscode-objectscript 的配置
    const config = vscode.workspace.getConfiguration('intersystems'); // intersystems.servers
    console.log(`查找${url}对应的serverConfig: ${JSON.stringify(config)}`);
    // 获取具体的服务器定义 (在 settings.json 中定义的 "objectscript.servers" 列表)
    const servers:{[key:string]:any}|undefined = config.get<{ [key:string]: any }>('servers');
    console.log(`servers: ${JSON.stringify(servers)}`);
    if (!servers) { throw new Error('无法获取 InterSystems 服务器配置');}
    if (servers.length === 0) {throw new Error('没有配置任何服务器');}
    const currentServerName:string = url.authority.split(':')[0];
    let currentServer = servers[currentServerName];
    console.log(`currentServer: ${JSON.stringify(currentServer)}`);
    if (!currentServer.webServer) {throw new Error('无法获取当前连接信息');}
    const scheme = currentServer.webServer.scheme ? 'https' : 'http';
    const host = currentServer.webServer.host || 'localhost';
    const port = currentServer.webServer.port || 52773;
    return {
        baseURL: `${scheme}://${host}:${port}/api/atelier`,
        username: currentServer.username,
        password: currentServer.password,
        namespace: url.authority.split(':')[1] || 'User'
        // 如果使用了 API 密钥认证，可能还需要处理其他头部，这里假设是基本认证
    };
}
// --- 辅助函数：调用 XML Export API ---
export async function exportToXMLContent(uri:Uri, serverConfig: any): Promise<string> {
    // InterSystems Atelier API 的 XML Export 接口
    // POST /api/atelier/v7/{ns}/action/xml/export
    // Body: ["ClassName.cls"]    
    try {
        // 注意：这里传入的是纯文件名，
        // 如: "websys.SensitiveProps.cls"
        // 如："/imedical/web/scripts/websys.sensitiveprops.js"
        let docName = uri.path;
        if (docName.startsWith('/') && (docName.endsWith('.cls') || docName.endsWith('.mac'))){
            docName = docName.substring(1).replaceAll('/', '.');
        }
        console.log(`要导出的文件名: ${ JSON.stringify(uri)}`);
        const ns = uri.authority.split(':')[1] || 'User';
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