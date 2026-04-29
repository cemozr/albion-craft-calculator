import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "electron/main.ts"),
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    outDir: "dist/main",
    emptyOutDir: true,
    rollupOptions: {
      external: [
        "electron",
        "path",
        "fs",
        "os",
        "https",
        "http",
        "url",
        "zlib",
        "stream",
        "events",
        "util",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
