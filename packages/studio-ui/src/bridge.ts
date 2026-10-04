import type { HostMessage, UiMessage } from "@agorix/studio-protocol";

export interface HostBridge {
  post(message: UiMessage): void;
  subscribe(listener: (message: HostMessage) => void): () => void;
}
