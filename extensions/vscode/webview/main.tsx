import { mountWorkbench, type HostBridge } from "@agorix/studio-ui";
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
  mountWorkbench(root, bridge);
}
