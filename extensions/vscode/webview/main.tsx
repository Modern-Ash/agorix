import {
  mountWorkbench,
  type HostBridge,
  type StudioUiLocale,
  type WorkbenchDensity,
} from "@agorix/studio-ui";
import { parseHostMessage } from "@agorix/studio-protocol";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const api = acquireVsCodeApi();
const bridge: HostBridge = {
  post: (message) => api.postMessage(message),
  subscribe: (listener) => {
    const handler = (event: MessageEvent) => {
      const message = parseHostMessage(event.data);
      if (message !== undefined) {
        listener(message);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  },
};

const root = document.getElementById("root");
if (root !== null) {
  const density = root.dataset["density"] === "compact" ? "compact" : "comfortable";
  const locale = root.dataset["locale"] === "es" ? "es" : "en";
  mountWorkbench(root, bridge, {
    density: density as WorkbenchDensity,
    locale: locale as StudioUiLocale,
  });
}
