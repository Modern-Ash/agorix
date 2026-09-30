import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { DecisionPlaneTestHost } from "./DecisionPlaneTestHost.js";
import { registerServiceWorker } from "./registerServiceWorker.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const testDecisionPlane =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has("decision-plane-test");

createRoot(container).render(
  <StrictMode>{testDecisionPlane ? <DecisionPlaneTestHost /> : <App />}</StrictMode>,
);

registerServiceWorker();
