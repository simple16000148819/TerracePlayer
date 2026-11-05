const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "terrace-smoke-"));
  const image = path.join(temp, "测试图片 & green.png");
  const video = path.join(temp, "blue.mp4");
  const invalid = path.join(temp, "invalid.mp4");
  const env = { ...process.env, TERRACE_USER_DATA: path.join(temp, "profile") };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.TERRACE_DEV_URL;
  let app;
  try {
    // FFmpeg is only needed by this integration test, never by the player.
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=0x5b9e4f:s=640x360",
        "-frames:v",
        "1",
        image,
      ],
      { stdio: "ignore" },
    );
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=0x305ab5:s=640x480:r=30",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440",
        "-t",
        "3",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        video,
      ],
      { stdio: "ignore" },
    );
    await fs.writeFile(invalid, "not a video");
    app = await electron.launch({
      args: ["."],
      cwd: path.resolve(__dirname, ".."),
      env,
    });
    let page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.locator("#stage-empty").waitFor();
    await page.screenshot({ path: path.join(temp, "empty.png") });
    const imported = await page.evaluate(
      (paths) => window.terrace.importFiles(paths),
      [image, video, invalid],
    );
    assert.equal(imported.added, 3);
    await page.reload();
    await page.locator(".asset-card.selected").waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector(".media-layer.visible img")?.naturalWidth ===
        640,
    );
    assert.equal(await page.locator(".asset-card").count(), 3);

    // Exercise the native file dialog entry point without requiring manual interaction.
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, image);
    await page.locator("#import-top").click();
    await page.locator("#toast").filter({ hasText: "重复" }).waitFor();
    await page.evaluate(() => {
      document.querySelector("#toast").textContent = "";
    });
    const cdp = await page.context().newCDPSession(page);
    for (const type of ["dragEnter", "dragOver", "drop"]) {
      await cdp.send("Input.dispatchDragEvent", {
        type,
        x: 500,
        y: 250,
        data: { items: [], files: [video], dragOperationsMask: 1 },
      });
    }
    await page.locator("#toast").filter({ hasText: "重复" }).waitFor();
    assert.equal(await page.locator("#drop-overlay").isVisible(), false);
    await cdp.detach();
    await page.locator("#shortcut").focus();
    await page.keyboard.press("q");
    await page.waitForFunction(
      () => document.querySelector("#shortcut").value === "Q",
    );
    await page.keyboard.press("2");
    await page.waitForFunction(() => {
      const video = document.querySelector(".media-layer.visible video");
      return video && !video.paused && video.currentTime > 0.1;
    });
    await page.locator("#shortcut").focus();
    await page.keyboard.press("q");
    await page.locator("#toast").filter({ hasText: "已分配" }).waitFor();
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () => document.querySelector(".media-layer.visible video").paused,
    );
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () => !document.querySelector(".media-layer.visible video").paused,
    );
    await page.locator("#seek").fill("60");
    await page.waitForFunction(
      () =>
        document.querySelector(".media-layer.visible video").currentTime > 1.5,
    );
    await page.locator("#loop").uncheck();
    await page.waitForFunction(
      () => !document.querySelector(".media-layer.visible video").loop,
    );
    assert.equal(
      await page
        .locator(".media-layer.visible video")
        .evaluate((video) => getComputedStyle(video).objectFit),
      "contain",
    );
    await page.locator("#fit").focus();
    await page.keyboard.press("f");
    await page.locator("body.presenting").waitFor();
    await page.locator(".app-header").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".app-header").isVisible(), false);
    await page.waitForFunction(() => {
      const video = document.querySelector(".media-layer.visible video");
      const rect = video.getBoundingClientRect();
      return (
        getComputedStyle(video).objectFit === "contain" &&
        Math.abs(rect.width - innerWidth) < 1 &&
        Math.abs(rect.height - innerHeight) < 1
      );
    });
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isFullScreen(),
      ),
      true,
    );
    await page.screenshot({ path: path.join(temp, "fullscreen-cover.png") });
    await page.keyboard.press("f");
    assert.equal(await page.locator("body.presenting").count(), 1);
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isFullScreen(),
      ),
      true,
    );
    await page.keyboard.press("q");
    await page.waitForFunction(
      () =>
        document.querySelector(".media-layer.visible img")?.naturalWidth ===
        640,
    );
    assert.equal(
      await page
        .locator(".media-layer.visible img")
        .evaluate((image) => getComputedStyle(image).objectFit),
      "contain",
    );
    assert.equal(
      await page
        .locator("body")
        .evaluate((body) => getComputedStyle(body).cursor),
      "none",
    );
    await page.keyboard.press("2");
    await page.waitForFunction(
      () => !!document.querySelector(".media-layer.visible video"),
    );
    for (const key of ["q", "2", "q", "2"]) await page.keyboard.press(key);
    await page.waitForFunction(() => {
      const video = document.querySelector(".media-layer.visible video");
      return (
        video &&
        !video.paused &&
        getComputedStyle(video).objectFit === "cover" &&
        !document.querySelector(".media-layer:not(.visible) video")
      );
    });
    await page.keyboard.press("3");
    await page.waitForFunction(() =>
      document.querySelector("#toast").textContent.includes("无法播放"),
    );
    assert.ok(
      await page.locator(".media-layer.visible video").count(),
      "Failed switch preserves previous picture",
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.body.classList.contains("presenting"),
    );
    assert.equal(
      await page
        .locator(".media-layer.visible video")
        .evaluate((video) => getComputedStyle(video).objectFit),
      "contain",
    );
    assert.equal(await page.locator("#fit").inputValue(), "contain");
    await page.locator("#fit").selectOption("cover");
    await page.keyboard.press("F11");
    await page.locator(".app-header").waitFor({ state: "hidden" });
    await page.keyboard.press("F11");
    await page.locator(".app-header").waitFor({ state: "visible" });
    assert.equal(
      await page
        .locator(".media-layer.visible video")
        .evaluate((video) => getComputedStyle(video).objectFit),
      "cover",
    );
    await page.locator("#fit").selectOption("contain");
    await page.locator("#fit").evaluate((select) => select.blur());
    await page.keyboard.press("q");
    await page.waitForFunction(
      () => !!document.querySelector(".media-layer.visible img"),
    );
    await page.setViewportSize({ width: 980, height: 680 });
    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > innerWidth,
      settingsBottom: document
        .querySelector(".asset-settings")
        .getBoundingClientRect().bottom,
      height: innerHeight,
    }));
    assert.equal(overflow.horizontal, false);
    assert.ok(
      overflow.settingsBottom <= overflow.height,
      "Settings fit in the viewport",
    );
    await page.screenshot({ path: path.join(temp, "compact.png") });
    await app.close();
    app = await electron.launch({
      args: ["."],
      cwd: path.resolve(__dirname, ".."),
      env,
    });
    page = await app.firstWindow();
    await page.locator(".asset-card.selected").waitFor();
    assert.equal(await page.locator("#shortcut").inputValue(), "Q");
    const restored = await page.evaluate(() => window.terrace.list());
    assert.equal(restored[1].loop, false);
    await page.locator("#remove").click();
    await page.waitForFunction(
      () => document.querySelectorAll(".asset-card").length === 2,
    );
    assert.ok((await fs.stat(image)).isFile());
    assert.deepEqual(errors, []);
    console.log(
      "PASS: native import, drag-and-drop, preview, shortcuts, collision checks, playback, seeking, F immersive entry, fullscreen video cover, preview fit restoration, F11 toggle, rapid switches, failed switch, compact layout, persistence and source-safe removal.",
    );
    console.log(`Screenshots: ${temp}`);
  } finally {
    if (app) await app.close().catch(() => {});
    // Keep screenshots for local inspection; remove test media and profile.
    await Promise.all(
      [image, video, invalid].map((file) => fs.rm(file, { force: true })),
    );
    await fs.rm(path.join(temp, "profile"), { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
