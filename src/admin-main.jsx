import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import AdminApp from "./AdminApp";
import ErrorBoundary from "./components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AdminApp />
    </ErrorBoundary>
  </React.StrictMode>
);
