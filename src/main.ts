import "./style.css";
import { icon } from "./icons";
import { Player } from "./player";
import type { Asset, ImportResult } from "./types";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};
const escapeHTML = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );
const shortcutLabel = (key: string) =>
  key.replace(/Key|Digit/g, "").replace(/\+/g, " + ");
const time = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "00:00";
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)
    .toString()
    .padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
};

$("#app").innerHTML = `
  <header class="app-header">
    <div class="brand"><span class="brand-mark">${icon("film")}</span><div><strong>TERRACE<span>PLAYER</span></strong><small>本地放映台</small></div></div>
    <div class="header-center"><span class="status-dot"></span>本地素材 · 随时放映</div>
    <div class="header-actions"><button class="icon-button" id="help" title="操作说明" aria-label="操作说明">${icon("help")}</button><button class="primary" id="import-top">${icon("plus")}导入素材</button></div>
  </header>
  <div class="workspace">
    <aside class="library">
      <div class="section-heading"><h1>素材库 <span id="asset-count">0</span></h1><span class="eyebrow">LIBRARY</span></div>
      <label class="search">${icon("search")}<input id="search" placeholder="搜索素材名称" aria-label="搜索素材名称" /><kbd>/</kbd></label>
      <div class="filters" role="group" aria-label="素材类型">
        <button class="filter active" data-filter="all">全部 <span id="count-all">0</span></button>
        <button class="filter" data-filter="video">视频 <span id="count-video">0</span></button>
        <button class="filter" data-filter="image">图片 <span id="count-image">0</span></button>
      </div>
      <div class="library-list" id="library-list"></div>
      <button class="import-zone" id="import-bottom">${icon("upload")}<span>拖拽素材到窗口<small>或点击选择图片、视频</small></span>${icon("plus")}</button>
      <div class="local-note"><span class="status-dot"></span>文件留在本地，无需上传</div>
    </aside>
    <main class="main">
      <div class="preview-heading"><div><span class="eyebrow">PREVIEW</span><h2>画面预览</h2></div><div class="preview-actions"><span class="preview-tag" id="preview-tag">等待导入</span><button id="fullscreen" class="secondary" disabled>${icon("expand")}全屏放映 <kbd>F</kbd></button></div></div>
      <section class="stage" id="stage" aria-label="素材预览">
        <div id="media-host"></div>
        <div class="stage-empty" id="stage-empty">
          <span class="empty-label">YOUR LOCAL SCREEN</span>
          <h3>让每一帧，自在呈现</h3>
          <p>导入图片或视频，开启你的本地放映台</p>
          <button class="primary" id="import-empty">${icon("plus")}选择本地素材</button>
          <span class="format-note">MP4 · WEBM · MOV · JPG · PNG · 更多</span>
        </div>
        <div class="load-indicator" id="load-indicator" hidden>正在准备画面…</div>
      </section>
      <div class="transport">
        <div class="transport-buttons"><button class="icon-button" id="previous" title="上一个素材（←）" aria-label="上一个素材" disabled>${icon("previous")}</button><button class="play-button" id="play" title="播放 / 暂停（空格）" aria-label="播放或暂停" disabled>${icon("play")}</button><button class="icon-button" id="next" title="下一个素材（→）" aria-label="下一个素材" disabled>${icon("next")}</button></div>
        <span class="time" id="current-time">00:00</span><input class="seek" id="seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="播放进度" disabled /><span class="time" id="duration">00:00</span>
        <div class="volume-control"><button class="icon-button" id="mute" aria-label="静音" title="静音（M）">${icon("volume")}</button><input id="volume" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="音量" /></div>
      </div>
      <section class="asset-settings">
        <div class="asset-info"><span class="info-icon" id="info-icon">${icon("film")}</span><div><h3 id="asset-name">尚未选择素材</h3><p id="asset-meta">导入后点击素材即可预览</p></div></div>
        <div class="settings-row">
          <div class="shortcut-setting"><label for="shortcut">${icon("keyboard")}专属快捷键</label><div class="shortcut-editor"><input id="shortcut" readonly placeholder="点击后按下按键" disabled aria-label="设置素材切换快捷键" /><button id="clear-shortcut" class="icon-button" title="清除快捷键" aria-label="清除快捷键" disabled>${icon("close")}</button></div><small id="shortcut-hint">全屏时按下，即刻切换</small></div>
          <div class="fit-setting"><label for="fit">画面显示</label><select id="fit"><option value="contain">完整显示</option><option value="cover">填满画面</option></select><small>保持原始比例</small></div>
          <div class="loop-setting"><label class="toggle-label">${icon("loop")}循环播放<input id="loop" type="checkbox" role="switch" checked disabled /><span class="toggle"></span></label><small>视频结束后自动重新播放</small></div>
          <button class="remove-button" id="remove" title="从素材库移除，不删除原文件" disabled>${icon("trash")}移除</button>
        </div>
      </section>
      <footer class="main-footer"><span>${icon("keyboard")} <kbd>←</kbd><kbd>→</kbd> 切换素材 <i></i><kbd>Space</kbd> 播放 / 暂停</span><span><kbd>F</kbd> 全屏 <i></i><kbd>Esc</kbd> 退出全屏</span></footer>
    </main>
  </div>
  <div class="drop-overlay" id="drop-overlay" hidden>${icon("upload")}<h2>松开，加入素材库</h2><p>图片和视频都可以一次导入</p></div>
  <div class="toast" id="toast" role="status" hidden></div>
  <dialog id="help-dialog"><div class="dialog-heading"><h2>放映操作</h2><button class="icon-button" id="close-help" aria-label="关闭">${icon("close")}</button></div><p>将图片、视频拖到窗口，或点击「导入素材」。前 9 个素材自动分配数字 1–9，也可以在下方重新设置。</p><div class="help-row"><span>切换素材</span><kbd>专属按键 / ← →</kbd></div><div class="help-row"><span>全屏 / 退出</span><kbd>F 或 F11 / Esc</kbd></div><div class="help-row"><span>播放 / 暂停</span><kbd>Space</kbd></div><div class="help-row"><span>静音</span><kbd>M</kbd></div><p class="help-note">全屏中隐藏所有控件与鼠标。新画面准备好后再切换；视频每次从头播放。仅在本程序获得焦点时响应快捷键。素材库引用原文件，请勿移动或删除。</p><button class="primary" id="help-done">知道了</button></dialog>
  <input type="file" id="browser-files" multiple accept="image/*,video/*" hidden />
`;

const player = new Player($("#media-host"));
const api = window.terrace;
let items: Asset[] = [];
let selectedId: string | null = null;
let filter = "all";
let fullscreen = false;
let selecting = 0;
let importing = false;
let recording = false;
let toastTimer = 0;
let dragDepth = 0;
let controlsVideo: HTMLVideoElement | null = null;
const selected = () => items.find((item) => item.id === selectedId);

function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}

function failure(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.replace(
          /^Error invoking remote method '[^']+': Error: /,
          "",
        )
      : "操作失败，请重试";
  toast(message);
}

function renderLibrary() {
  $("#asset-count").textContent = String(items.length);
  for (const type of ["all", "video", "image"])
    $(`#count-${type}`).textContent = String(
      items.filter((item) => type === "all" || item.type === type).length,
    );
  const query = $<HTMLInputElement>("#search").value.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      (filter === "all" || item.type === filter) &&
      item.name.toLowerCase().includes(query),
  );
  $("#library-list").innerHTML = visible.length
    ? visible
        .map(
          (item, index) => `
    <button class="asset-card ${item.id === selectedId ? "selected" : ""} ${item.missing ? "missing" : ""}" data-id="${item.id}" title="${escapeHTML(item.path)}" aria-pressed="${item.id === selectedId}">
      <span class="thumbnail">${item.type === "image" && !item.missing ? `<img src="${escapeHTML(item.url)}" alt="" loading="lazy" />` : icon(item.type === "video" ? "play" : "image")}<span class="type-badge">${item.type === "video" ? "视频" : "图片"}</span></span>
      <span class="card-info"><strong>${escapeHTML(item.name)}</strong><small>${item.missing ? "文件丢失 · 请重新导入" : `${item.name.split(".").pop()?.toUpperCase()} · ${formatSize(item.size)}`}</small></span>
      <span class="card-key">${item.shortcut ? `<kbd>${escapeHTML(shortcutLabel(item.shortcut))}</kbd>` : `<span class="card-order">${String(index + 1).padStart(2, "0")}</span>`}</span>
    </button>`,
        )
        .join("")
    : `<div class="library-empty">${icon(items.length ? "search" : "film")}<strong>${items.length ? "没有匹配的素材" : "你的素材，从这里开始"}</strong><p>${items.length ? "试试其他关键词或素材类型" : "导入后，所有画面尽在掌握"}</p></div>`;
}

function formatSize(bytes: number) {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function renderSettings() {
  const item = selected();
  $("#asset-name").textContent = item?.name ?? "尚未选择素材";
  $("#asset-name").title = item?.path ?? "";
  $("#asset-meta").textContent = item
    ? `${item.type === "video" ? "视频素材" : "图片素材"} · ${formatSize(item.size)} · 本地文件`
    : "导入后点击素材即可预览";
  $("#info-icon").innerHTML = icon(item?.type === "image" ? "image" : "film");
  $("#preview-tag").textContent = item
    ? item.type === "image"
      ? "图片预览"
      : "视频预览"
    : "等待导入";
  for (const id of [
    "fullscreen",
    "previous",
    "next",
    "shortcut",
    "clear-shortcut",
    "remove",
  ])
    $<HTMLButtonElement>(`#${id}`).disabled = !item;
  $<HTMLInputElement>("#shortcut").value = item
    ? shortcutLabel(item.shortcut)
    : "";
  $<HTMLInputElement>("#loop").disabled = item?.type !== "video";
  $<HTMLInputElement>("#loop").checked = item?.loop ?? true;
  $<HTMLButtonElement>("#play").disabled = item?.type !== "video";
  $<HTMLInputElement>("#seek").disabled = item?.type !== "video";
}

function updateTransport() {
  const video = player.video;
  $("#current-time").textContent = time(video?.currentTime ?? 0);
  $("#duration").textContent = time(video?.duration ?? 0);
  $<HTMLInputElement>("#seek").value = String(
    video?.duration ? (video.currentTime / video.duration) * 100 : 0,
  );
  $("#play").innerHTML = icon(video && !video.paused ? "pause" : "play");
}

async function selectAsset(id: string) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  if (item.missing) {
    toast("原文件已移动或删除，请从新位置重新导入");
    return;
  }
  const ticket = ++selecting;
  $("#load-indicator").hidden = false;
  try {
    const committed = await player.show(item);
    if (!committed || ticket !== selecting) return;
    selectedId = id;
    $("#stage-empty").hidden = true;
    renderLibrary();
    renderSettings();
    if (controlsVideo) {
      for (const event of [
        "timeupdate",
        "play",
        "pause",
        "ended",
        "durationchange",
      ])
        controlsVideo.removeEventListener(event, updateTransport);
    }
    controlsVideo = player.video;
    if (controlsVideo) {
      for (const event of [
        "timeupdate",
        "play",
        "pause",
        "ended",
        "durationchange",
      ])
        controlsVideo.addEventListener(event, updateTransport);
      controlsVideo.loop = item.loop;
    }
    updateTransport();
  } catch (error) {
    if (ticket === selecting) failure(error);
  } finally {
    if (ticket === selecting) $("#load-indicator").hidden = true;
  }
}

function step(direction: number) {
  const available = items.filter((item) => !item.missing);
  if (!available.length) return;
  const index = available.findIndex((item) => item.id === selectedId);
  void selectAsset(
    available[(index + direction + available.length) % available.length].id,
  );
}

async function applyImport(result: ImportResult | null) {
  if (!result) return;
  const oldIds = new Set(items.map((item) => item.id));
  items = result.items;
  renderLibrary();
  const added = items.find((item) => !oldIds.has(item.id));
  if (!selectedId && added) await selectAsset(added.id);
  const messages = [`已导入 ${result.added} 个素材`];
  if (result.duplicates) messages.push(`${result.duplicates} 个重复文件已跳过`);
  if (result.rejected.length)
    messages.push(`${result.rejected.length} 个不支持或无效文件已跳过`);
  toast(messages.join("，"));
}

async function importPaths(paths: string[]) {
  if (!api || importing) return;
  importing = true;
  try {
    await applyImport(await api.importFiles(paths));
  } catch (error) {
    failure(error);
  } finally {
    importing = false;
  }
}

async function chooseFiles() {
  if (!api) {
    $<HTMLInputElement>("#browser-files").click();
    return;
  }
  if (importing) return;
  importing = true;
  try {
    await applyImport(await api.choose());
  } catch (error) {
    failure(error);
  } finally {
    importing = false;
  }
}

async function browserImport(files: File[]) {
  const rejected: string[] = [];
  let added = 0;
  let duplicates = 0;
  for (const file of files) {
    const type = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : null;
    if (!type) {
      rejected.push(file.name);
      continue;
    }
    if (
      items.some((item) => item.name === file.name && item.size === file.size)
    ) {
      duplicates++;
      continue;
    }
    const key = Array.from(
      { length: 9 },
      (_, index) => `Digit${index + 1}`,
    ).find((key) => !items.some((item) => item.shortcut === key));
    items.push({
      id: crypto.randomUUID(),
      name: file.name,
      path: file.name,
      url: URL.createObjectURL(file),
      type,
      size: file.size,
      shortcut: key ?? "",
      loop: true,
      missing: false,
    });
    added++;
  }
  renderLibrary();
  if (!selectedId && items.length) await selectAsset(items[0].id);
  toast(
    `浏览器预览：导入 ${added} 个，重复 ${duplicates} 个，不支持 ${rejected.length} 个。素材仅在本次页面保留`,
  );
}

async function updateAsset(patch: Partial<Pick<Asset, "shortcut" | "loop">>) {
  const item = selected();
  if (!item) return;
  const id = item.id;
  try {
    if (api) items = await api.update(id, patch);
    else {
      if (
        patch.shortcut &&
        items.some(
          (entry) => entry.id !== id && entry.shortcut === patch.shortcut,
        )
      )
        throw new Error("该快捷键已分配给其他素材");
      Object.assign(item, patch);
    }
    if (selectedId === id && player.video)
      player.video.loop = selected()?.loop ?? true;
    renderLibrary();
    renderSettings();
    if ("shortcut" in patch)
      toast(
        patch.shortcut
          ? `快捷键已设置为 ${shortcutLabel(patch.shortcut)}`
          : "快捷键已清除",
      );
  } catch (error) {
    renderSettings();
    failure(error);
  }
}

function syncFullscreen(enabled: boolean) {
  fullscreen = enabled;
  document.body.classList.toggle("presenting", enabled);
  if (enabled) {
    (document.activeElement as HTMLElement)?.blur();
    $<HTMLDialogElement>("#help-dialog").close();
  }
}

async function setFullscreen(enabled: boolean) {
  if (enabled && !selectedId) return;
  try {
    if (api) {
      const next = await api.setFullscreen(enabled);
      // Apply immediately so one F enters immersive mode even if the native
      // fullscreen event reports isFullScreen() late on Windows.
      syncFullscreen(Boolean(next));
    } else {
      if (enabled) await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
      syncFullscreen(Boolean(document.fullscreenElement));
    }
  } catch (error) {
    failure(error);
  }
}

function shortcutFromEvent(event: KeyboardEvent) {
  return [
    ...(event.ctrlKey ? ["Ctrl"] : []),
    ...(event.altKey ? ["Alt"] : []),
    ...(event.shiftKey ? ["Shift"] : []),
    event.code,
  ].join("+");
}

const reserved = new Set([
  "Escape",
  "Space",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyF",
  "KeyM",
  "F11",
]);
document.addEventListener("keydown", (event) => {
  if (event.repeat || event.isComposing) return;
  const target = event.target as HTMLElement;
  if (recording && target.id === "shortcut") {
    event.preventDefault();
    if (event.code === "Escape") {
      target.blur();
      return;
    }
    if (
      ["Control", "Shift", "Alt", "Meta"].some((prefix) =>
        event.code.startsWith(prefix),
      )
    )
      return;
    if (
      !/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2]))$/.test(event.code) ||
      reserved.has(event.code) ||
      event.metaKey ||
      (event.altKey && event.code === "F4")
    ) {
      toast("请使用字母、数字或功能键；F、M、空格、方向键等为播放保留键");
      return;
    }
    void updateAsset({ shortcut: shortcutFromEvent(event) });
    target.blur();
    return;
  }
  if (event.code === "Escape" && fullscreen) {
    event.preventDefault();
    void setFullscreen(false);
    return;
  }
  const fullscreenKey = event.code === "KeyF" || event.code === "F11";
  if (
    target.closest(
      "input:not([type='range']):not([type='checkbox']), textarea, dialog",
    ) ||
    (target.closest("select") && !fullscreenKey) ||
    $<HTMLDialogElement>("#help-dialog").open
  )
    return;
  if (
    target.matches("input[type='range'], input[type='checkbox']") &&
    ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
      event.code,
    )
  )
    return;
  const match = items.find(
    (item) => item.shortcut && item.shortcut === shortcutFromEvent(event),
  );
  if (match) {
    event.preventDefault();
    void selectAsset(match.id);
    return;
  }
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  if (
    [
      "KeyF",
      "F11",
      "Space",
      "ArrowLeft",
      "ArrowRight",
      "KeyM",
      "Slash",
    ].includes(event.code)
  )
    event.preventDefault();
  switch (event.code) {
    case "KeyF":
      void setFullscreen(true);
      break;
    case "F11":
      void setFullscreen(!fullscreen);
      break;
    case "Space":
      void player.toggle().catch(failure);
      break;
    case "ArrowLeft":
      step(-1);
      break;
    case "ArrowRight":
      step(1);
      break;
    case "KeyM":
      toggleMute();
      break;
    case "Slash":
      if (!fullscreen) $<HTMLInputElement>("#search").focus();
      break;
  }
});

for (const id of ["import-top", "import-bottom", "import-empty"])
  $(`#${id}`).addEventListener("click", () => void chooseFiles());
$("#library-list").addEventListener("click", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-id]");
  if (card?.dataset.id) void selectAsset(card.dataset.id);
});
$("#search").addEventListener("input", renderLibrary);
document.querySelectorAll<HTMLElement>(".filter").forEach((button) =>
  button.addEventListener("click", () => {
    filter = button.dataset.filter ?? "all";
    document.querySelector(".filter.active")?.classList.remove("active");
    button.classList.add("active");
    renderLibrary();
  }),
);
$("#fullscreen").addEventListener("click", () => void setFullscreen(true));
$("#stage").addEventListener("dblclick", () => void setFullscreen(!fullscreen));
$("#previous").addEventListener("click", () => step(-1));
$("#next").addEventListener("click", () => step(1));
$("#play").addEventListener("click", () => void player.toggle().catch(failure));
$("#seek").addEventListener("input", () => {
  if (player.video && Number.isFinite(player.video.duration))
    player.video.currentTime =
      (Number($<HTMLInputElement>("#seek").value) / 100) *
      player.video.duration;
});
function toggleMute() {
  const muted = player.toggleMute();
  $("#mute").innerHTML = icon(muted ? "mute" : "volume");
  $("#mute").setAttribute("aria-label", muted ? "取消静音" : "静音");
}
$("#mute").addEventListener("click", toggleMute);
$("#volume").addEventListener("input", () => {
  const value = Number($<HTMLInputElement>("#volume").value);
  player.setVolume(value);
  $("#mute").innerHTML = icon(value ? "volume" : "mute");
});
$("#fit").addEventListener("change", () =>
  player.setFit($<HTMLSelectElement>("#fit").value as "contain" | "cover"),
);
$("#shortcut").addEventListener("focus", () => {
  recording = true;
  $("#shortcut-hint").textContent =
    "请按快捷键，也支持 Ctrl / Alt / Shift 组合";
});
$("#shortcut").addEventListener("blur", () => {
  recording = false;
  $("#shortcut-hint").textContent = "全屏时按下，即刻切换";
});
$("#clear-shortcut").addEventListener(
  "click",
  () => void updateAsset({ shortcut: "" }),
);
$("#loop").addEventListener(
  "change",
  () => void updateAsset({ loop: $<HTMLInputElement>("#loop").checked }),
);
$("#remove").addEventListener("click", async () => {
  const item = selected();
  if (!item) return;
  try {
    if (api) items = await api.remove(item.id);
    else {
      URL.revokeObjectURL(item.url);
      items = items.filter((entry) => entry.id !== item.id);
    }
    ++selecting;
    selectedId = null;
    player.clear();
    $("#load-indicator").hidden = true;
    $("#stage-empty").hidden = false;
    renderLibrary();
    renderSettings();
    updateTransport();
    const next = items.find((entry) => !entry.missing);
    if (next) await selectAsset(next.id);
    toast("已从素材库移除，原文件未删除");
  } catch (error) {
    failure(error);
  }
});
$("#help").addEventListener("click", () =>
  $<HTMLDialogElement>("#help-dialog").showModal(),
);
for (const id of ["close-help", "help-done"])
  $(`#${id}`).addEventListener("click", () =>
    $<HTMLDialogElement>("#help-dialog").close(),
  );

document.addEventListener("dragenter", (event) => {
  event.preventDefault();
  if (fullscreen || !event.dataTransfer?.types.includes("Files")) return;
  dragDepth++;
  $("#drop-overlay").hidden = false;
});
document.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = fullscreen ? "none" : "copy";
});
document.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $("#drop-overlay").hidden = true;
});
document.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  $("#drop-overlay").hidden = true;
  if (fullscreen) return;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (api)
    void importPaths(
      files.map((file) => api.pathForFile(file)).filter(Boolean),
    );
  else void browserImport(files);
});
window.addEventListener("blur", () => {
  dragDepth = 0;
  $("#drop-overlay").hidden = true;
});
$("#browser-files").addEventListener("change", () => {
  const input = $<HTMLInputElement>("#browser-files");
  void browserImport(Array.from(input.files ?? []));
  input.value = "";
});
document.addEventListener("fullscreenchange", () => {
  if (!api) syncFullscreen(Boolean(document.fullscreenElement));
});
api?.onFullscreen(syncFullscreen);

async function init() {
  if (api) {
    try {
      items = await api.list();
      syncFullscreen(await api.getFullscreen());
      renderLibrary();
      const first = items.find((item) => !item.missing);
      if (first) await selectAsset(first.id);
    } catch (error) {
      failure(error);
    }
  } else {
    renderLibrary();
    $(".header-center").innerHTML =
      '<span class="status-dot"></span>浏览器预览 · 素材不持久保存';
  }
}
void init();
