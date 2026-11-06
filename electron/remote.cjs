// LAN remote-control service: HTTP + SSE for phones, UDP broadcast for player discovery.
const http = require("node:http");
const dgram = require("node:dgram");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { randomInt, randomUUID } = require("node:crypto");

const HTTP_PORT = 17890;
const UDP_PORT = 17891;
const IMAGE_MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", avif: "image/avif" };

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || [])
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) out.push(a.address);
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b));
}

class RemoteServer {
  constructor({ library, onCommand }) {
    this.library = library;
    this.onCommand = onCommand;
    this.pin = String(randomInt(0, 10000)).padStart(4, "0");
    this.instance = randomUUID();
    this.name = os.hostname();
    this.port = HTTP_PORT;
    this.clients = new Set();
    this.peers = new Map();
    this.playback = { selectedId: null, playing: false };
    this.html = fs.readFileSync(path.join(__dirname, "remote.html"), "utf8");
  }

  info() {
    const ips = lanAddresses();
    return {
      name: this.name,
      pin: this.pin,
      port: this.port,
      ips,
      urls: ips.map((ip) => `http://${ip}:${this.port}/?pin=${this.pin}`),
    };
  }

  async start() {
    this.server = http.createServer((req, res) => this.route(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }));
    for (let i = 0; i < 10; i++) {
      try {
        await new Promise((resolve, reject) => {
          this.server.once("error", reject);
          this.server.listen(this.port, "0.0.0.0", () => {
            this.server.removeListener("error", reject);
            resolve();
          });
        });
        break;
      } catch (error) {
        if (error.code !== "EADDRINUSE" || i === 9) throw error;
        this.port++;
      }
    }
    this.startDiscovery();
    return this.info();
  }

  startDiscovery() {
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    this.udp = sock;
    sock.on("error", () => {});
    sock.on("message", (buf, rinfo) => {
      try {
        const msg = JSON.parse(buf.toString());
        if (msg.app !== "terrace-player" || msg.id === this.instance) return;
        this.peers.set(msg.id, { name: msg.name, host: rinfo.address, port: msg.port, seen: Date.now() });
      } catch {}
    });
    sock.bind(UDP_PORT, () => {
      try { sock.setBroadcast(true); } catch {}
      const announce = () => {
        const msg = Buffer.from(JSON.stringify({ app: "terrace-player", id: this.instance, name: this.name, port: this.port }));
        sock.send(msg, UDP_PORT, "255.255.255.255", () => {});
        for (const [id, p] of this.peers) if (Date.now() - p.seen > 15000) this.peers.delete(id);
      };
      announce();
      this.timer = setInterval(announce, 4000);
    });
  }

  stop() {
    clearInterval(this.timer);
    try { this.udp?.close(); } catch {}
    for (const c of this.clients) c.end();
    this.server?.close();
  }

  async state() {
    const items = (await this.library.list()).map((i) => ({
      id: i.id, name: i.name, type: i.type, shortcut: i.shortcut, missing: i.missing,
    }));
    return { name: this.name, items, ...this.playback };
  }

  setPlayback(p) {
    this.playback = { selectedId: p?.selectedId ?? null, playing: Boolean(p?.playing) };
    this.broadcast("playback", this.playback);
  }

  async libraryChanged() {
    if (this.clients.size) this.broadcast("state", await this.state());
  }

  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) c.write(payload);
  }

  send(res, status, body, type = "application/json; charset=utf-8") {
    res.writeHead(status, {
      "Content-Type": type,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }

  async route(req, res) {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST" });
      return res.end();
    }
    if (p === "/" || p === "/index.html") return this.send(res, 200, this.html, "text/html; charset=utf-8");
    // Unauthenticated: only identifies the player, used by phone-side LAN scanning.
    if (p === "/api/hello")
      return this.send(res, 200, { app: "terrace-player", name: this.name, port: this.port });
    if (p === "/api/peers")
      return this.send(res, 200, [...this.peers.values()].map(({ name, host, port }) => ({ name, host, port })));
    if (url.searchParams.get("pin") !== this.pin) return this.send(res, 401, { error: "PIN 错误" });

    if (p === "/api/state") return this.send(res, 200, await this.state());
    if (p === "/api/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
      res.write(`event: state\ndata: ${JSON.stringify(await this.state())}\n\n`);
      this.clients.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 20000);
      req.on("close", () => { clearInterval(ping); this.clients.delete(res); });
      return;
    }
    const thumb = /^\/api\/thumb\/([a-f0-9-]{36})$/.exec(p);
    if (thumb) {
      const item = this.library.items.find((i) => i.id === thumb[1]);
      const ext = item && path.extname(item.path).slice(1).toLowerCase();
      // Only images are served (as their own thumbnail); videos never leave the PC.
      if (!item || item.type !== "image" || !IMAGE_MIME[ext]) return this.send(res, 404, { error: "not found" });
      const stat = await fs.promises.stat(item.path).catch(() => null);
      if (!stat?.isFile() || stat.size > 30 * 1024 * 1024) return this.send(res, 404, { error: "unavailable" });
      res.writeHead(200, { "Content-Type": IMAGE_MIME[ext], "Content-Length": stat.size, "Cache-Control": "max-age=3600" });
      return fs.createReadStream(item.path).pipe(res);
    }
    if (p === "/api/command" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) { raw += chunk; if (raw.length > 4096) return this.send(res, 413, {}); }
      let cmd;
      try { cmd = JSON.parse(raw); } catch { return this.send(res, 400, { error: "bad json" }); }
      const actions = ["select", "toggle", "play", "pause", "next", "previous", "fullscreen"];
      if (!actions.includes(cmd?.action)) return this.send(res, 400, { error: "unknown action" });
      if (cmd.action === "select" && !this.library.items.some((i) => i.id === cmd.id)) return this.send(res, 404, { error: "素材不存在" });
      this.onCommand({ action: cmd.action, id: cmd.id });
      return this.send(res, 200, { ok: true });
    }
    return this.send(res, 404, { error: "not found" });
  }
}

module.exports = { RemoteServer };
