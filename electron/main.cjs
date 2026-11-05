const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  net,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { Readable } = require("node:stream");
const MIME = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", ogv: "video/ogg", avi: "video/x-msvideo", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", avif: "image/avif", svg: "image/svg+xml" };

// Serve local files with real HTTP byte ranges so Chromium can fetch only the
// moov/index and the needed clusters instead of streaming the whole file.
async function serveFile(filePath, request) {
  const stat = await fs.promises.stat(filePath);
  const size = stat.size;
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const headers = new Headers({
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": "no-cache",
  });
  const range = request.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2]));
    } else {
      start = Number(m[1]);
      if (m[2] !== "") end = Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  if (request.method === "HEAD" || size === 0)
    return new Response(null, { status, headers });
  const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 });
  return new Response(Readable.toWeb(stream), { status, headers });
}
const {
  Library,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
} = require("./library.cjs");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "terrace-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

let window;
let library;
let quitting = false;
const devURL = process.env.TERRACE_DEV_URL;
if (process.env.TERRACE_USER_DATA)
  app.setPath("userData", process.env.TERRACE_USER_DATA);

function handle(channel, action) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.sender !== window?.webContents)
      throw new Error("Untrusted IPC sender");
    return action(...args);
  });
}

async function createWindow() {
  window = new BrowserWindow({
    title: "Terrace Player",
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#101312",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.on("enter-full-screen", () => {
    window.webContents.send("fullscreen:changed", true);
  });
  window.on("leave-full-screen", () => {
    window.webContents.send("fullscreen:changed", false);
  });
  if (devURL) {
    const url = new URL(devURL);
    if (url.hostname !== "127.0.0.1")
      throw new Error("Development server must be local");
    await window.loadURL(devURL);
  } else {
    await window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  library = new Library(app.getPath("userData"));
  await library.load();
  protocol.handle("terrace-media", async (request) => {
    const url = new URL(request.url);
    const id = url.pathname.slice(1);
    const item = library.items.find((entry) => entry.id === id);
    if (url.hostname !== "asset" || !item)
      return new Response("Not found", { status: 404 });
    try {
      return await serveFile(item.path, request);
    } catch {
      return new Response("File unavailable", { status: 404 });
    }
  });
  handle("library:list", () => library.list());
  handle("library:import", (paths) => library.import(paths));
  handle("library:choose", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "导入图片或视频",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "图片和视频",
          extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS],
        },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
    return result.canceled ? null : library.import(result.filePaths);
  });
  handle("library:update", (id, patch) => library.update(id, patch));
  handle("library:remove", (id) => library.remove(id));
  handle("fullscreen:set", (enabled) => {
    const next = Boolean(enabled);
    window.setFullScreen(next);
    // isFullScreen() can lag during the transition; return the requested state.
    return next;
  });
  handle("fullscreen:get", () => window.isFullScreen());
  await createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", (event) => {
  if (quitting || !library) return;
  event.preventDefault();
  quitting = true;
  library.queue.finally(() => app.quit());
});
