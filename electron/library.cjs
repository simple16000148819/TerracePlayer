const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "mkv", "ogv"];
const RESERVED_KEYS = new Set([
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

function validShortcut(value) {
  if (value === "") return true;
  if (typeof value !== "string") return false;
  const parts = value.split("+");
  const code = parts.pop();
  if (!/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2]))$/.test(code)) return false;
  if (RESERVED_KEYS.has(code)) return false;
  return (
    parts.every((part) => ["Ctrl", "Alt", "Shift"].includes(part)) &&
    new Set(parts).size === parts.length &&
    !(parts.includes("Alt") && code === "F4")
  );
}

class Library {
  constructor(directory) {
    this.file = path.join(directory, "library.json");
    this.items = [];
    this.queue = Promise.resolve();
  }

  async load() {
    try {
      const data = JSON.parse(await fs.readFile(this.file, "utf8"));
      if (!Array.isArray(data)) throw new Error("Invalid library");
      const seenIds = new Set();
      const seenKeys = new Set();
      this.items = data.filter((item) => {
        if (
          typeof item.id !== "string" ||
          !/^[a-f0-9-]{36}$/.test(item.id) ||
          seenIds.has(item.id) ||
          typeof item.path !== "string" ||
          typeof item.name !== "string" ||
          !["image", "video"].includes(item.type)
        )
          return false;
        seenIds.add(item.id);
        if (!validShortcut(item.shortcut) || seenKeys.has(item.shortcut))
          item.shortcut = "";
        if (item.shortcut) seenKeys.add(item.shortcut);
        item.loop = item.loop !== false;
        return true;
      });
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Preserve the damaged file before allowing the next successful save.
        await fs.copyFile(this.file, `${this.file}.backup-${Date.now()}`);
      }
      this.items = [];
    }
    return this.list();
  }

  async list() {
    return Promise.all(
      this.items.map(async (item) => ({
        ...item,
        url: `terrace-media://asset/${item.id}`,
        missing: !(await fs.stat(item.path).catch(() => null))?.isFile(),
      })),
    );
  }

  save() {
    const snapshot = JSON.stringify(this.items, null, 2);
    const write = this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(`${this.file}.tmp`, snapshot, "utf8");
      await fs.rename(`${this.file}.tmp`, this.file);
    });
    this.queue = write.catch(() => {});
    return write;
  }

  async import(paths) {
    if (!Array.isArray(paths) || paths.length > 1000)
      throw new Error("一次最多导入 1000 个文件");
    let added = 0;
    let duplicates = 0;
    const rejected = [];
    for (const input of paths) {
      if (typeof input !== "string" || !path.isAbsolute(input)) continue;
      const filePath = path.normalize(input);
      const extension = path.extname(filePath).slice(1).toLowerCase();
      const type = IMAGE_EXTENSIONS.includes(extension)
        ? "image"
        : VIDEO_EXTENSIONS.includes(extension)
          ? "video"
          : null;
      const stat = await fs.stat(filePath).catch(() => null);
      if (!type || !stat?.isFile()) {
        rejected.push(path.basename(filePath));
        continue;
      }
      const comparable = (value) =>
        process.platform === "win32" ? value.toLowerCase() : value;
      if (
        this.items.some(
          (item) => comparable(item.path) === comparable(filePath),
        )
      ) {
        duplicates++;
        continue;
      }
      const shortcut = Array.from(
        { length: 9 },
        (_, i) => `Digit${i + 1}`,
      ).find((key) => !this.items.some((item) => item.shortcut === key));
      this.items.push({
        id: randomUUID(),
        path: filePath,
        name: path.basename(filePath),
        type,
        size: stat.size,
        shortcut: shortcut ?? "",
        loop: true,
      });
      added++;
    }
    await this.save();
    return { items: await this.list(), added, duplicates, rejected };
  }

  async update(id, patch) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) throw new Error("素材不存在");
    if (!patch || typeof patch !== "object") throw new Error("设置无效");
    if ("shortcut" in patch) {
      if (!validShortcut(patch.shortcut)) throw new Error("该快捷键不可使用");
      if (
        patch.shortcut &&
        this.items.some(
          (entry) => entry.id !== id && entry.shortcut === patch.shortcut,
        )
      )
        throw new Error("该快捷键已分配给其他素材");
      item.shortcut = patch.shortcut;
    }
    if (typeof patch.loop === "boolean") item.loop = patch.loop;
    await this.save();
    return this.list();
  }

  async remove(id) {
    this.items = this.items.filter((entry) => entry.id !== id);
    await this.save();
    return this.list();
  }
}

module.exports = {
  Library,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  validShortcut,
};
