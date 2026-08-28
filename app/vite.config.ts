import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const licenseVirtualId = "virtual:app-license";
const licenseResolvedId = `\0${licenseVirtualId}`;

function appLicensePlugin(): Plugin {
  return {
    name: "app-license",
    resolveId(id) {
      if (id === licenseVirtualId) {
        return licenseResolvedId;
      }
    },
    load(id) {
      if (id === licenseResolvedId) {
        const licensePath = path.join(repoRoot, "LICENSE");
        const text = fs.readFileSync(licensePath, "utf8");
        return `export default ${JSON.stringify(text)};`;
      }
    },
  };
}

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), appLicensePlugin()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
