import { spawn } from "node:child_process";
const backend = spawn(process.execPath, ["--watch", "server/index.mjs"], {
  stdio: "inherit",
  windowsHide: true,
});
const frontend = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "4173"],
  { stdio: "inherit", windowsHide: true },
);
process.on("SIGINT", () => {
  backend.kill();
  frontend.kill();
  process.exit();
});
