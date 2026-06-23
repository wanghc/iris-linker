# Change Log

All notable changes to the "iris-linker" extension will be documented in this file.

## [0.0.10]

### Added
- 发布模式提示：导出处于 Deployed Mode 的类时，右下角弹出明确的警告提示，指引用户在 IRIS 服务端重新编译

## [0.0.9]
### Added
- 「Sync All to IRIS Server」按钮导出增加日志

## [0.0.7]

### Added
- 批量同步功能：在 SCM（Git）视图标题栏新增「Sync All to IRIS Server」按钮，一键将本地所有修改的 IRIS 文件同步到远程服务器
- 支持文件类型大幅扩展：新增图片 (.png/.jpg/.gif/.bmp/.ico/.webp)、字体 (.eot/.otf/.ttf/.woff/.woff2)、HTML (.html/.htm)、PDF (.pdf) 的上传
- 二进制文件自动 Base64 编码上传，文本文件保持 UTF-8
- 同步进度条实时显示当前文件及进度
- 同步结果汇总（成功/失败数及失败详情）
- 新增配置项：`iris-linker.sync.ignoreConflict`（冲突忽略）、`iris-linker.sync.includeUntracked`（包含未跟踪文件）、`iris-linker.sync.confirmBeforeSync`（同步前确认）
- 右键导出菜单 now 也支持这些新文件类型

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
