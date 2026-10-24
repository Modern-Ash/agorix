import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { registerServiceWorker } from "./registerServiceWorker.js";

// Keep the previous editor reachable while Kids becomes the default experience.
const KidsApp = lazy(() =>
  import("./kids/KidsApp.js").then((module) => ({ default: module.KidsApp })),
);
const AdvancedApp = lazy(() => import("./App.js").then((module) => ({ default: module.App })));
const AiAdminApp = lazy(() =>
  import("./admin/AiAdminApp.js").then((module) => ({ default: module.AiAdminApp })),
);
const isAiAdmin = window.location.pathname === "/admin/ai";
const isAdvanced =
  window.location.pathname === "/advanced" || window.location.pathname.startsWith("/advanced/");

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isAiAdmin ? <AiAdminApp /> : isAdvanced ? <AdvancedApp /> : <KidsApp />}
    </Suspense>
  </StrictMode>,
);

if (!isAiAdmin) registerServiceWorker();
