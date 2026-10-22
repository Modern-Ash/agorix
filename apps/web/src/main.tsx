import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { registerServiceWorker } from "./registerServiceWorker.js";

// Agorix Kids (epic #371) is developed behind /kids until it replaces the default route (Kids 15).
const KidsApp = lazy(() =>
  import("./kids/KidsApp.js").then((module) => ({ default: module.KidsApp })),
);
const isKids =
  window.location.pathname === "/kids" || window.location.pathname.startsWith("/kids/");

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    {isKids ? (
      <Suspense fallback={null}>
        <KidsApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);

registerServiceWorker();
