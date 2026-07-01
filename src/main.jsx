import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

// 用 ErrorBoundary 把整個 App 包起來，任何執行期例外都會顯示錯誤畫面而非全白
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
