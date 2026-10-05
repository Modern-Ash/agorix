import { createRoot } from "react-dom/client";
import type { HostBridge } from "./bridge.js";
import { Workbench, type WorkbenchDensity } from "./Workbench.js";
import type { StudioUiLocale } from "./i18n.js";

export function mountWorkbench(
  root: HTMLElement,
  bridge: HostBridge,
  options: { readonly density?: WorkbenchDensity; readonly locale?: StudioUiLocale } = {},
): () => void {
  const reactRoot = createRoot(root);
  reactRoot.render(
    <Workbench
      bridge={bridge}
      {...(options.density === undefined ? {} : { density: options.density })}
      {...(options.locale === undefined ? {} : { locale: options.locale })}
    />,
  );
  return () => reactRoot.unmount();
}
