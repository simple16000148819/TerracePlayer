import type { Asset } from "./types";

export class Player {
  static readonly FADE_MS = 320;
  private layers: HTMLElement[];
  private active = -1;
  private generation = 0;
  private cancelLoad: (() => void) | undefined;
  private volume = 0.8;
  private muted = false;
  private fit: "contain" | "cover" = "contain";

  constructor(private host: HTMLElement) {
    this.layers = [
      document.createElement("div"),
      document.createElement("div"),
    ];
    this.layers.forEach((layer) => {
      layer.className = "media-layer";
      this.host.append(layer);
    });
  }

  get video(): HTMLVideoElement | null {
    return this.layers[this.active]?.querySelector("video") ?? null;
  }

  get media(): HTMLImageElement | HTMLVideoElement | null {
    return this.layers[this.active]?.querySelector("img, video") ?? null;
  }

  async show(asset: Asset): Promise<boolean> {
    const generation = ++this.generation;
    this.cancelLoad?.();
    const next = this.active === 0 ? 1 : 0;
    const layer = this.layers[next];
    layer.querySelector("video")?.pause();
    layer.replaceChildren();
    layer.classList.remove("visible");
    const media = document.createElement(
      asset.type === "video" ? "video" : "img",
    );
    media.style.objectFit = this.fit;
    if (media instanceof HTMLVideoElement) {
      media.preload = "auto";
      media.playsInline = true;
      media.loop = asset.loop;
      media.volume = this.volume;
      // Preload silently so the old clip remains the only audible source.
      media.muted = true;
    } else {
      media.alt = asset.name;
    }
    layer.append(media);
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      const timer = window.setTimeout(
        () => finish(new Error("素材加载超时，请检查文件或编码格式")),
        20000,
      );
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        media.removeEventListener("error", failed);
        media.removeEventListener("load", ready);
        media.removeEventListener("canplay", ready);
        if (generation === this.generation) this.cancelLoad = undefined;
        if (error) reject(error);
        else resolve();
      };
      const failed = () =>
        finish(
          new Error(
            "无法播放该文件。请检查文件位置，或转为 MP4（H.264 / AAC）",
          ),
        );
      const ready = async () => {
        if (media instanceof HTMLVideoElement) {
          try {
            await media.play();
            // Commit only after Chromium has submitted a decoded video frame.
            if ("requestVideoFrameCallback" in media) {
              media.requestVideoFrameCallback(() => finish());
            } else {
              finish();
            }
          } catch {
            finish(new Error("视频无法开始播放，请检查编码格式"));
          }
        } else {
          finish();
        }
      };
      this.cancelLoad = () => finish();
      media.addEventListener("error", failed, { once: true });
      media.addEventListener("load", ready, { once: true });
      media.addEventListener("canplay", ready, { once: true });
      media.src = asset.url;
    }).catch((error: unknown) => {
      if (generation === this.generation) {
        if (media instanceof HTMLVideoElement) media.pause();
        layer.replaceChildren();
      }
      throw error;
    });
    if (generation !== this.generation) return false;
    const oldLayer = this.layers[this.active];
    oldLayer?.querySelector("video")?.pause();
    // Keep the incoming layer above so opacity crossfades are not covered.
    layer.style.zIndex = "2";
    if (oldLayer) oldLayer.style.zIndex = "1";
    layer.classList.add("visible");
    oldLayer?.classList.remove("visible");
    this.active = next;
    if (media instanceof HTMLVideoElement) media.muted = this.muted;

    const clearOld = () => {
      if (generation !== this.generation) return;
      oldLayer?.replaceChildren();
      if (oldLayer) oldLayer.style.zIndex = "";
      layer.style.zIndex = "";
    };
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!oldLayer || reduceMotion) clearOld();
    else window.setTimeout(clearOld, Player.FADE_MS);
    return true;
  }

  clear() {
    ++this.generation;
    this.cancelLoad?.();
    this.layers.forEach((layer) => {
      layer.querySelector("video")?.pause();
      layer.replaceChildren();
      layer.classList.remove("visible");
    });
    this.active = -1;
  }

  async toggle() {
    const video = this.video;
    if (!video) return;
    if (video.paused) await video.play();
    else video.pause();
  }

  setVolume(value: number) {
    this.volume = value;
    this.muted = value === 0;
    if (this.video) {
      this.video.volume = value;
      this.video.muted = this.muted;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.video) this.video.muted = this.muted;
    return this.muted;
  }

  setFit(value: "contain" | "cover") {
    this.fit = value;
    if (this.media) this.media.style.objectFit = value;
  }
}
