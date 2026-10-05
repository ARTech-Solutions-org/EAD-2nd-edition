import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
  throw new Error("PORT must be an integer from 1024 to 65535");
}

const vite = spawn(
  "vite",
  ["--host", "0.0.0.0", "--port", port, "--strictPort"],
  { stdio: "inherit", shell: process.platform === "win32" },
);
vite.on("error", (error) => {
  console.error("Could not start Vite:", error.message);
  process.exitCode = 1;
});
vite.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
