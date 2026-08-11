import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const demoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "browser-git-sdk": resolve(demoRoot, "../src/index.ts")
    }
  },
  server: {
    fs: {
      allow: [resolve(demoRoot, "..")]
    }
  }
});
