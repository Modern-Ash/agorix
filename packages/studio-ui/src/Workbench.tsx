import { useEffect, useReducer, useState } from "react";
import type { BlockType, BlockWorkspaceSnapshot } from "@agorix/block-editor";
import type { Intent } from "@agorix/interaction-core";
import { STUDIO_PROTOCOL_VERSION, type HostMessage } from "@agorix/studio-protocol";
import type { HostBridge } from "./bridge.js";
import { AgentZone, Canvas, type SyncView } from "./Canvas.js";
import { Palette } from "./Palette.js";
import { AgentPanel } from "./AgentPanel.js";
import { initialAgentUi, reduceAgentUi } from "./agentUi.js";

export function statusFor(message: HostMessage): string | undefined {
  if (message.type === "error") {
    return message.code === "INVALID_CHANGE"
      ? "That change would break the program, so nothing changed."
      : "The program could not be shown.";
  }
  if (message.type === "agentUnavailable") {
    return "The agent is not available right now.";
  }
  return undefined;
}

export function Workbench({ bridge }: { readonly bridge: HostBridge }) {
  const [workspace, setWorkspace] = useState<BlockWorkspaceSnapshot | undefined>();
  const [status, setStatus] = useState("");
  const [sync, setSync] = useState<SyncView>({});
  const [agentUi, dispatchAgent] = useReducer(reduceAgentUi, undefined, initialAgentUi);

  useEffect(() => {
    const unsubscribe = bridge.subscribe((message) => {
      dispatchAgent(message);
      if (message.type === "sync") {
        setSync({
          ...(message.selectedBlockId === undefined
            ? {}
            : { selectedBlockId: message.selectedBlockId }),
          ...(message.executingBlockId === undefined
            ? {}
            : { executingBlockId: message.executingBlockId }),
          ...(message.failedBlockId === undefined ? {} : { failedBlockId: message.failedBlockId }),
        });
        return;
      }
      if (message.type === "workspace") {
        setWorkspace(message.workspace);
        setStatus("Updated");
        return;
      }
      const text = statusFor(message);
      if (text !== undefined) setStatus(text);
    });
    bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "ready" });
    return unsubscribe;
  }, [bridge]);

  const post = (intent: Intent) =>
    bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "intent", intent });

  const add = (blockType: BlockType) => {
    const script = workspace?.scripts[0];
    if (script === undefined) return;
    post({
      type: "insertBlock",
      blockType,
      to: { container: { kind: "script", scriptIndex: 0 }, index: script.statements.length },
    });
  };

  return (
    <div className="workbench">
      <Palette onAdd={add} />
      <main>
        {workspace === undefined ? (
          <p>Open a project to start building.</p>
        ) : (
          <Canvas
            workspace={workspace}
            onIntent={post}
            ghosts={agentUi.proposal?.changes}
            sync={sync}
          />
        )}
        <div className="zones">
          <AgentZone verb="explain" label="Explain" onIntent={post} />
          <AgentZone verb="debug" label="Debug" onIntent={post} />
          <AgentZone verb="challenge" label="Challenge" onIntent={post} />
        </div>
        <div className="status" role="status" aria-live="polite">
          {status}
        </div>
      </main>
      <AgentPanel state={agentUi} send={(message) => bridge.post(message)} />
    </div>
  );
}
