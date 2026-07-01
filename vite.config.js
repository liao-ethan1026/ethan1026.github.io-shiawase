import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" 讓打包後的資源路徑都用相對路徑，
// 這樣不管部署在 GitHub Pages 子路徑或 Cloudflare 根目錄都能正確載入
export default defineConfig({
  base: "./",
  plugins: [react()]
});
