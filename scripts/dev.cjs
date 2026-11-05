const { spawn } = require("node:child_process");
const { createServer } = require("vite");

async function main() {
  const server = await createServer({
    server: { host: "127.0.0.1", port: 5173, strictPort: false },
    base: "./",
  });
  await server.listen();
  const env = { ...process.env, TERRACE_DEV_URL: server.resolvedUrls.local[0] };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require("electron"), ["."], {
    stdio: "inherit",
    env,
  });
  const close = async () => {
    child.kill();
    await server.close();
  };
  child.on("exit", async (code) => {
    await server.close();
    process.exit(code ?? 0);
  });
  child.on("error", async (error) => {
    console.error(error);
    await server.close();
    process.exit(1);
  });
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
  console.log(`Terrace Player development server: ${env.TERRACE_DEV_URL}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
