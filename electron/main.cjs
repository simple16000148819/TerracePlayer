const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  net,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
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
      // Electron's file fetch handles byte ranges for seeking large local videos.
      const fileResponse = await net.fetch(pathToFileURL(item.path).href, {
        method: request.method,
        headers: request.headers,
      });
      const headers = new Headers(fileResponse.headers);
      // Allow thumbnail canvas capture from <video crossorigin="anonymous">.
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Cross-Origin-Resource-Policy", "cross-origin");
      return new Response(fileResponse.body, {
        status: fileResponse.status,
        statusText: fileResponse.statusText,
        headers,
      });
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
