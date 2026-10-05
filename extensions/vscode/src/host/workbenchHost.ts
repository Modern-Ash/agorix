import {
  BlockEditorAdapterError,
  applyWorkspaceChange,
  getCanonicalNodeIdForBlock,
  programToWorkspace,
} from "@agorix/block-editor";
import { intentToChange, type AgentAnchorRef, type AgentVerb } from "@agorix/interaction-core";
import { ProgramValidationError, type ProjectProgram } from "@agorix/program-model";
import { programSemanticHash } from "@agorix/proposals";
import { STUDIO_PROTOCOL_VERSION, type HostMessage, type UiMessage } from "@agorix/studio-protocol";
import type { AgentAgreements } from "@agorix/agent-workflow";
import type { SyncState } from "../sync/syncHub.js";

export interface HostPort {
  getProgram(): ProjectProgram | undefined;
  commit(program: ProjectProgram, label: string): Promise<void>;
  openProposalReview(proposalId: string): Promise<void>;
  reveal(nodeId: string): Promise<void>;
  askAgent(verb: AgentVerb, nodeId: string | undefined): Promise<void>;
  updateAgreements(agreements: AgentAgreements): void;
}

export interface WorkbenchHost {
  handle(message: UiMessage): Promise<HostMessage[]>;
  snapshot(): HostMessage[];
  syncMessage(state: SyncState): HostMessage[];
}

const schema = STUDIO_PROTOCOL_VERSION;

function isKnownFailure(error: unknown): boolean {
  return error instanceof BlockEditorAdapterError || error instanceof ProgramValidationError;
}

export function createWorkbenchHost(port: HostPort, newBlockId: () => string): WorkbenchHost {
  function snapshot(): HostMessage[] {
    const program = port.getProgram();
    if (program === undefined) {
      return [];
    }
    try {
      const { workspace } = programToWorkspace(program);
      return [{ schema, type: "workspace", workspace, programHash: programSemanticHash(program) }];
    } catch (error) {
      if (isKnownFailure(error)) {
        return [{ schema, type: "error", code: "INVALID_PROGRAM" }];
      }
      throw error;
    }
  }

  function syncMessage(state: SyncState): HostMessage[] {
    const program = port.getProgram();
    if (program === undefined) return [];
    try {
      const { mapping } = programToWorkspace(program);
      const blockFor = (nodeId: string | undefined): string | undefined =>
        nodeId === undefined
          ? undefined
          : mapping.find((entry) => entry.nodeId === nodeId)?.blockId;
      const selectedBlockId = blockFor(state.selectedNodeId);
      const executingBlockId = blockFor(state.executingNodeId);
      const failedBlockId = blockFor(state.failedNodeId);
      return [
        {
          schema,
          type: "sync",
          ...(selectedBlockId === undefined ? {} : { selectedBlockId }),
          ...(executingBlockId === undefined ? {} : { executingBlockId }),
          ...(failedBlockId === undefined ? {} : { failedBlockId }),
        },
      ];
    } catch (error) {
      if (isKnownFailure(error)) return [];
      throw error;
    }
  }

  function canonicalNodeId(id: string | undefined): string | undefined {
    if (id === undefined) return undefined;
    const program = port.getProgram();
    if (program === undefined) return id;
    try {
      const { mapping } = programToWorkspace(program);
      return getCanonicalNodeIdForBlock(mapping, id) ?? id;
    } catch (error) {
      if (isKnownFailure(error)) return id;
      throw error;
    }
  }

  function nodeIdForAnchor(anchor: AgentAnchorRef): string | undefined {
    return anchor.kind === "node" ? canonicalNodeId(anchor.id) : undefined;
  }

  async function handle(message: UiMessage): Promise<HostMessage[]> {
    switch (message.type) {
      case "ready":
        return snapshot();
      case "intent": {
        const intent = message.intent;
        if (intent.type === "revealNode") {
          await port.reveal(canonicalNodeId(intent.nodeId) ?? intent.nodeId);
          return [];
        }
        if (intent.type === "reviewProposal") {
          await port.openProposalReview(intent.proposalId);
          return [];
        }
        if (intent.type === "askAgent") {
          await port.askAgent(intent.verb, nodeIdForAnchor(intent.about));
          return [];
        }
        if (intent.type === "highlightNodes") {
          const nodeId = canonicalNodeId(intent.nodeIds[0]);
          if (nodeId !== undefined) {
            await port.reveal(nodeId);
          }
          return [];
        }
        const program = port.getProgram();
        if (program === undefined) {
          return [];
        }
        try {
          const change = intentToChange(intent, newBlockId);
          if (change === undefined) {
            return [];
          }
          const { workspace } = programToWorkspace(program);
          await port.commit(
            applyWorkspaceChange(workspace, change).program,
            `Workbench: ${intent.type}`,
          );
        } catch (error) {
          if (isKnownFailure(error) || error instanceof Error) {
            return [{ schema, type: "error", code: "INVALID_CHANGE" }];
          }
          throw error;
        }
        return snapshot();
      }
      case "agreementsChanged":
        port.updateAgreements(message.agreements);
        return [];
      default:
        // Agent-loop and proposal messages are handled by the agent host.
        return [];
    }
  }

  return { handle, snapshot, syncMessage };
}
