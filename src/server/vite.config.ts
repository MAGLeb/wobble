// Сборка сервера в самодостаточный CJS-бандл dist/server/index.cjs (Node builtins — внешние).
import { defineConfig } from "vite";
import { builtinModules } from "node:module";

export default defineConfig({
  ssr: { noExternal: true },
  build: {
    emptyOutDir: false,
    ssr: "index.ts",
    outDir: "../../dist/server",
    target: "node22",
    sourcemap: false,
    commonjsOptions: { ignoreDynamicRequires: true },
    rollupOptions: {
      external: [...builtinModules],
      output: {
        format: "cjs",
        entryFileNames: "index.cjs",
        inlineDynamicImports: true,
      },
    },
  },
});
