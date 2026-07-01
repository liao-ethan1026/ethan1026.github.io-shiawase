/** @type {import('tailwindcss').Config} */
export default {
  // 掃描這些檔案裡實際用到的 class，只產出用得到的樣式
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
