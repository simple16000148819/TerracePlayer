const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("terrace", {
  list: () => ipcRenderer.invoke("library:list"),
  choose: () => ipcRenderer.invoke("library:choose"),
  importFiles: (paths) => ipcRenderer.invoke("library:import", paths),
  update: (id, patch) => ipcRenderer.invoke("library:update", id, patch),
  remove: (id) => ipcRenderer.invoke("library:remove", id),
  pathForFile: (file) => webUtils.getPathForFile(file),
  setFullscreen: (enabled) => ipcRenderer.invoke("fullscreen:set", enabled),
  getFullscreen: () => ipcRenderer.invoke("fullscreen:get"),
  remoteInfo: () => ipcRenderer.invoke("remote:info"),
  reportPlayback: (state) => ipcRenderer.invoke("remote:playback", state),
  onRemoteCommand: (callback) => {
    const listener = (_event, cmd) => callback(cmd);
    ipcRenderer.on("remote:command", listener);
    return () => ipcRenderer.removeListener("remote:command", listener);
  },
  onFullscreen: (callback) => {
    const listener = (_event, enabled) => callback(enabled);
    ipcRenderer.on("fullscreen:changed", listener);
    return () => ipcRenderer.removeListener("fullscreen:changed", listener);
  },
});
