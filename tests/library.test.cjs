const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Library, validShortcut } = require("../electron/library.cjs");

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "terrace-library-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const image = path.join(dir, "图片 & sample.PNG");
  const video = path.join(dir, "video.mp4");
  const invalid = path.join(dir, "notes.txt");
  await Promise.all(
    [image, video, invalid].map((file) => fs.writeFile(file, "fixture")),
  );
  return { dir, image, video, invalid, library: new Library(dir) };
}

test("imports media, rejects unsupported paths, and deduplicates", async (t) => {
  const { library, image, video, invalid, dir } = await fixture(t);
  const result = await library.import([
    image,
    image,
    video,
    invalid,
    dir,
    path.join(dir, "gone.jpg"),
  ]);
  assert.equal(result.added, 2);
  assert.equal(result.duplicates, 1);
  assert.equal(result.rejected.length, 3);
  assert.deepEqual(
    result.items.map((item) => item.shortcut),
    ["Digit1", "Digit2"],
  );
  assert.ok(
    result.items.every(
      (item) => !item.missing && item.url.startsWith("terrace-media://asset/"),
    ),
  );
});

test("persists shortcuts and loop settings, detects moved files", async (t) => {
  const { library, dir, image, video } = await fixture(t);
  const { items } = await library.import([image, video]);
  await library.update(items[1].id, {
    shortcut: "Ctrl+Shift+KeyA",
    loop: false,
  });
  await fs.unlink(image);
  const restored = await new Library(dir).load();
  assert.equal(restored[0].missing, true);
  assert.equal(restored[1].shortcut, "Ctrl+Shift+KeyA");
  assert.equal(restored[1].loop, false);
});

test("rejects shortcut collisions and playback reserved keys", async (t) => {
  const { library, image, video } = await fixture(t);
  const { items } = await library.import([image, video]);
  await assert.rejects(
    library.update(items[1].id, { shortcut: "Digit1" }),
    /已分配/,
  );
  await assert.rejects(
    library.update(items[1].id, { shortcut: "KeyF" }),
    /不可使用/,
  );
  assert.equal(validShortcut("Alt+F4"), false);
  assert.equal(validShortcut("Ctrl+Ctrl+KeyA"), false);
  assert.equal(validShortcut("Ctrl+KeyQ"), true);
  assert.equal(validShortcut(""), true);
  assert.equal(validShortcut(null), false);
});

test("removing an asset never deletes the source; freed keys are reused", async (t) => {
  const { library, image, video } = await fixture(t);
  const { items } = await library.import([image]);
  await library.remove(items[0].id);
  assert.ok((await fs.stat(image)).isFile());
  const result = await library.import([video]);
  assert.equal(result.items[0].shortcut, "Digit1");
});

test("atomic save queue stores the latest state", async (t) => {
  const { library, image, dir } = await fixture(t);
  const { items } = await library.import([image]);
  await Promise.all([
    library.update(items[0].id, { shortcut: "KeyA" }),
    library.update(items[0].id, { shortcut: "KeyB" }),
    library.update(items[0].id, { loop: false }),
  ]);
  const restored = await new Library(dir).load();
  assert.equal(restored[0].shortcut, "KeyB");
  assert.equal(restored[0].loop, false);
});

test("backs up damaged configuration before recovering", async (t) => {
  const { library, dir } = await fixture(t);
  await fs.writeFile(library.file, "{broken");
  assert.deepEqual(await library.load(), []);
  assert.ok(
    (await fs.readdir(dir)).some((file) =>
      file.startsWith("library.json.backup-"),
    ),
  );
});
