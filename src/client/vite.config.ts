// Сборка webview-клиента в dist/client (index.html самодостаточен, без бандлов).
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
  },
});
