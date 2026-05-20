import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initSdk } from "./lib/sdk";
import "./index.css";
import App from "./App.tsx";

initSdk();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
