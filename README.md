# Terrace Player · 本地放映台

基于 Electron、TypeScript 和 Vite 的本地图片 / 视频播放器。无需登录，无需网络，无云端服务。

## 启动

需要 Node.js 20.19+ 或 22.x。本工程已在 Windows、Node.js 22.8.0 上验证。

```powershell
npm install
npm run dev
```

依赖已安装时，直接运行 `npm run dev` 即可打开桌面程序。

运行构建版本：

```powershell
npm run build
npm start
```

生成 Windows 安装包：

```powershell
npm run dist
```

产物在 `release/`。首次打包需要联网下载 Electron Builder 的打包工具。工程尚未配置代码签名，Windows 可能显示未知发布者提示。

## 使用

1. 点击「导入素材」，或将本地文件拖到窗口。支持一次导入多个文件，自动跳过重复文件。
2. 点击左侧素材，在大画面中预览。视频自动播放，图片持续显示。
3. 点击「专属快捷键」输入框，直接按下字母、数字或功能键，也可以使用 Ctrl / Alt / Shift 组合键。前 9 个素材默认分配数字 1–9。
4. 点击「全屏放映」或按 F 直接进入沉浸式全屏。全屏仅显示素材，隐藏界面、鼠标和切换提示；按当前「画面显示」设置呈现（完整显示或填满画面）。按专属快捷键即可切换。
5. 按 Esc 返回主界面。快捷键只在程序获得焦点时生效，不占用系统全局快捷键。

| 按键         | 功能                           |
| ------------ | ------------------------------ |
| 素材专属按键 | 切换到对应素材，并从头播放视频 |
| ← / →        | 上一个 / 下一个素材            |
| F            | 直接进入沉浸式全屏             |
| F11          | 进入或退出全屏                 |
| Esc          | 退出全屏；编辑快捷键时取消编辑 |
| Space        | 播放 / 暂停                    |
| M            | 静音 / 取消静音                |
| /            | 搜索素材                       |

F、M、F11、Space、Esc 和方向键是保留按键，不能用于素材专属快捷键。重复快捷键会提示冲突，不覆盖原设置。

提供视频循环播放、进度拖动、音量调节，以及「完整显示 / 填满画面」两种比例保持模式。全屏与预览共用「完整显示 / 填满画面」设置；切换后立即生效。

## 素材与切换

- 图片扩展名：JPG、JPEG、PNG、WEBP、GIF、BMP、AVIF。
- 视频扩展名：MP4、WEBM、MOV、M4V、MKV、OGV。扩展名可导入不代表内部编码必定可播放，具体取决于 Electron / Chromium 的解码支持；推荐 MP4（H.264 视频 / AAC 音频）。
- 素材库保存原文件路径、快捷键、循环设置，不复制图片或大视频。移除素材仅删除库内记录，绝不删除原文件。
- 重启自动恢复素材库。原文件移动或删除后会标记丢失，需要从新位置重新导入。
- 使用双层媒体预加载，图片加载完成、视频首帧解码提交后才替换当前画面。准备期间保留上一素材，切换失败也保留上一画面。
- 全屏画面切换不显示控件或通知；无法保证不同编码、磁盘速度和 GPU 环境下零延迟，也不提供音频交叉淡化。
- 配置位于 Electron 的 `userData` 目录，Windows 默认为 `%APPDATA%\terrace-player\library.json`。不保存文件内容。

## 开发与验证

```powershell
npm run lint
npm run format:check
npm test
npm run test:electron
```

`npm test` 验证导入去重、格式过滤、快捷键冲突、持久化、文件丢失、原文件保护和损坏配置恢复。

`npm run test:electron` 使用 Playwright 启动真实 Electron 窗口，验证本地图片和 H.264 / AAC 视频、文件选择入口、播放暂停、拖动进度、快捷键、全屏、加载失败、紧凑布局和重启恢复。该集成测试需要 `ffmpeg` 在 PATH 中，仅用于生成临时测试素材；应用自身不依赖 FFmpeg。

`npm run dev:web` 可打开浏览器预览。浏览器导入仅用于界面验证，刷新后不保留素材；完整本地文件功能请通过 Electron 启动。

## 工程结构

- `electron/main.cjs`：窗口、IPC、仅授权素材可访问的媒体协议。
- `electron/preload.cjs`：启用上下文隔离、沙箱的最小文件操作桥接。
- `electron/library.cjs`：素材验证、路径引用、配置原子写入。
- `src/main.ts`：中文界面、素材管理、键盘交互。
- `src/player.ts`：双层图片 / 视频加载与播放控制。
- `src/style.css`：深色单屏布局与无控件全屏模式。
- `tests/`、`scripts/smoke.cjs`：单元与桌面集成测试。
