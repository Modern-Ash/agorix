import { useEffect, useReducer, useState } from "react";
import type { BlockType, BlockWorkspaceSnapshot } from "@agorix/block-editor";
import type { Intent } from "@agorix/interaction-core";
import {
  STUDIO_PROTOCOL_VERSION,
  type ChangeRefusalReason,
  type HostMessage,
  type AmbientHintView,
} from "@agorix/studio-protocol";
import type { HostBridge } from "./bridge.js";
import { AgentZone, Canvas, type SyncView } from "./Canvas.js";
import { Palette } from "./Palette.js";
import { AgentPanel } from "./AgentPanel.js";
import { normalizeStudioUiLocale, type StudioUiLocale } from "./i18n.js";
import {
  canvasHints,
  fullSelection,
  initialAgentUi,
  reduceAgentUi,
  type SelectionState,
} from "./agentUi.js";

const REFUSAL_TEXT: Record<ChangeRefusalReason, string> = {
  NOT_A_CONTAINER: "That block cannot hold other blocks.",
  BAD_INDEX: "There is no place for it there.",
  BLOCK_NOT_FOUND: "That block is no longer there.",
  NOT_A_STATEMENT: "That block cannot go in the program steps.",
  WOULD_BREAK_PROGRAM: "That would break the program.",
  UNKNOWN: "That change would break the program.",
};

export function statusFor(message: HostMessage): string | undefined {
  if (message.type === "error") {
    if (message.code === "INVALID_CHANGE") {
      return `${REFUSAL_TEXT[message.reason ?? "UNKNOWN"]} Nothing changed.`;
    }
    if (message.code === "STALE_EDIT") {
      return "The program changed, so that edit was not applied. Try again.";
    }
    return "The program could not be shown.";
  }
  if (message.type === "agentUnavailable") {
    return "The agent is not available right now.";
  }
  return undefined;
}

export type WorkbenchDensity = "comfortable" | "compact";

export function Workbench({
  bridge,
  density = "comfortable",
  locale = "en",
}: {
  readonly bridge: HostBridge;
  readonly density?: WorkbenchDensity;
  readonly locale?: StudioUiLocale;
}) {
  const copyLocale = normalizeStudioUiLocale(locale);
  const [workspace, setWorkspace] = useState<BlockWorkspaceSnapshot | undefined>();
  const [status, setStatus] = useState("");
  const [programHash, setProgramHash] = useState<string | undefined>();
  const [selection, setSelection] = useState<SelectionState>({ include: [], overrides: {} });
  const [sync, setSync] = useState<SyncView>({});
  const [ambientHint, setAmbientHint] = useState<AmbientHintView | undefined>();
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
        setProgramHash(message.programHash);
        setStatus("Updated");
        return;
      }
      if (message.type === "ambientHint") {
        setAmbientHint(message.hint);
        return;
      }
      const text = statusFor(message);
      if (text !== undefined) setStatus(text);
    });
    bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "ready" });
    return unsubscribe;
  }, [bridge]);

  const proposalId = agentUi.proposal?.proposalId;
  const operations = agentUi.proposal?.operations;
  useEffect(() => {
    // The selection restarts from "keep everything" whenever a different proposal is shown.
    setSelection(fullSelection(operations));
  }, [proposalId]);
  const anchored = canvasHints(agentUi.proposal, selection);

  const post = (intent: Intent) =>
    bridge.post({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "intent",
      intent,
      ...(programHash === undefined ? {} : { baseHash: programHash }),
    });

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
    <div className="workbench" data-density={density}>
      <Palette onAdd={add} />
      <main>
        {workspace === undefined ? (
          <p>Open a project to start building.</p>
        ) : (
          <Canvas
            workspace={workspace}
            onIntent={post}
            ghosts={agentUi.proposal === undefined ? undefined : anchored.ghosts}
            sync={sync}
            hints={
              agentUi.proposal === undefined
                ? ambientHint?.blockId === undefined
                  ? undefined
                  : { hints: { [ambientHint.blockId]: ambientHint.label }, skipped: [] }
                : { hints: anchored.hints, skipped: anchored.skipped }
            }
            ambientHint={agentUi.proposal === undefined ? ambientHint : undefined}
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
      <AgentPanel
        state={agentUi}
        send={(message) => bridge.post(message)}
        selection={selection}
        onSelectionChange={setSelection}
        locale={copyLocale}
      />
    </div>
  );
}
