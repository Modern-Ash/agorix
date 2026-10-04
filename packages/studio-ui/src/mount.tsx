import { createRoot } from "react-dom/client";
import type { HostBridge } from "./bridge.js";
import { Workbench } from "./Workbench.js";

export function mountWorkbench(root: HTMLElement, bridge: HostBridge): () => void {
  const reactRoot = createRoot(root);
  reactRoot.render(<Workbench bridge={bridge} />);
  return () => reactRoot.unmount();
}
