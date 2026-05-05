import * as vscode from 'vscode';
import * as path from 'path';
export class CspResourceLinkProvider implements vscode.DocumentLinkProvider {

    // 正则：匹配 <script src="..."> 和 <link href="...">
    // 这里的正则做了简化，实际可能需要更严谨
    private scriptRegex = /<script[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
    private linkRegex = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;

    public provideDocumentLinks(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.DocumentLink[] {
        const links: vscode.DocumentLink[] = [];
        const text = document.getText();
        
        // 处理 <script> 标签
        this.processRegex(text, document, this.scriptRegex, links);
        
        // 处理 <link> 标签 (CSS)
        this.processRegex(text, document, this.linkRegex, links);

        return links;
    }

    private processRegex(text: string, document: vscode.TextDocument, regex: RegExp, links: vscode.DocumentLink[]) {
        let match;
        while ((match = regex.exec(text)) !== null) {
            const resourcePath = match[1]; // 获取路径，如 "../css/style.css"
            
            // 跳过外部链接 (http/https) 和 根路径链接 (如果你的项目结构不支持根路径解析)
            if (resourcePath.startsWith('http') || resourcePath.startsWith('//')) {
                continue;
            }

            // 计算链接在编辑器中的显示范围
            const startIndex = match.index + match[0].indexOf(resourcePath);
            const endIndex = startIndex + resourcePath.length;
            const range = new vscode.Range(
                document.positionAt(startIndex),
                document.positionAt(endIndex)
            );

            // 解析目标文件路径
            // 假设：CSP 文件在服务器上，JS/CSS 也在同一目录结构下
            // 使用 path.posix 确保在 Windows 上也能正确处理 / 路径
            const currentDir = path.posix.dirname(document.uri.path);
            let resolvedPath = path.posix.join(currentDir, resourcePath);
            
            // 处理以 / 开头的绝对路径（假设是相对于 Web 根目录，这里简单处理为相对于工作区根目录）
            if (resourcePath.startsWith('/')) {
                 // 这里可能需要根据你的项目结构调整，比如拼接 workspaceFolder
                 // 简单起见，这里假设 / 就是工作区根目录
                 if (vscode.workspace.workspaceFolders) {
                     const wsFolder = vscode.workspace.workspaceFolders[0].uri;
                     resolvedPath = path.join(wsFolder.fsPath, resourcePath.substring(1));
                 }
            }

            // 尝试构建 URI
            // 方案 A: 如果是远程文件系统 (isfs://)，尝试直接拼接
            // 方案 B: 如果是本地映射，尝试找本地文件
            
            let targetUri: vscode.Uri | undefined;

            // 尝试作为普通文件查找 (适用于本地映射模式)
            // 注意：这里需要处理 document.uri.scheme 为 'isfs' 的情况
            // 简单做法：假设文件就在当前 CSP 文件的同级或上级目录
             targetUri = document.uri.with({
                path: resolvedPath
            });

            if (targetUri) {
                const link = new vscode.DocumentLink(range, targetUri);
                link.tooltip = `open file : ${resourcePath}`;
                links.push(link);
            }
        }
    }
}