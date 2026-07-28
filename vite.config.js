import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" 讓打包後的資源路徑都用相對路徑，
// 這樣不管部署在 GitHub Pages 子路徑或 Cloudflare 根目錄都能正確載入
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      // 顧客點餐頁（index.html）與後台管理頁（admin.html）各自獨立打包，
      // 後台的程式碼不會被塞進顧客要下載的檔案裡
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html")
      }
    }
  }
});
