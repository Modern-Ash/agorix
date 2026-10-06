import type { WorldPreviewInbound } from "../webview/worldPreview.js";

export interface StageMessageDeps {
  readonly selectNode: (nodeId: string) => unknown;
  readonly execute: (commandId: string, ...args: unknown[]) => PromiseLike<unknown> | unknown;
  readonly ready: () => void;
}

/** Maps validated Stage webview messages to Studio commands; commands never carry webview text. */
export async function handleStageMessage(
  message: WorldPreviewInbound,
  deps: StageMessageDeps,
): Promise<void> {
  switch (message.type) {
    case "agorix-ready":
      deps.ready();
      return;
    case "agorix-reveal-node":
      await deps.selectNode(message.nodeId);
      return;
    case "agorix-command":
      await deps.execute(`agorixStudio.${message.command}`);
      return;
    case "agorix-select-step":
      await deps.execute("agorixStudio.selectExecutionStep", message.index);
      return;
  }
}
