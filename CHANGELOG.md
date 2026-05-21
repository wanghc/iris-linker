# Change Log

All notable changes to the "iris-linker" extension will be documented in this file.

## [0.0.6]

### Added
- 支持本地文件（file:// 协议）右键导出到 IRIS 服务器
- 新增 `iris-linker.localExport.defaultServer` 配置项,也支持objectscript.conn.server
- 新增 `iris-linker.localExport.stripPrefix` 配置项,也支持.code-workspace内的folders[{path:"./src"}]
- 导出文件类型新增支持 `.int` 扩展名
- 多服务器环境下本地导出弹出服务器选择器

### Fixed
- 修复断点不生效：`launch.json` `preLaunchTask` 从无效的 `"npm: compile"` 改为 `"compile"`，`tasks.json` 新增对应 shell task
- `esbuild.js` `sourcesContent` 改为 `true`，`launch.json` 添加显式 `"sourceMaps": true`

## [0.0.5] - 2026-03-28

### Added
- 文件内容增加右键导出功能
- 文件树目录节点上增加右键导出功能

## [0.0.4] - 2026-03-27

### Added
- 增加对objectscript-csp言语中script的资源链接跳转处理
- 增加对objectscript-csp言语中link的资源链接跳转处理

### Fixed
- 修复监听csp与csr文件的监听问题

## [0.0.1] - 2026-03-27

### Added
- initial release
