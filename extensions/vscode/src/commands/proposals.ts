import * as vscode from "vscode";
import { createRemoteClient } from "./accounts.js";
import type { AgentAgreements } from "@agorix/agent-workflow";
import { canPropose, ceilingMessage } from "../assistance.js";
import { t } from "../l10n.js";
import type { ProjectProgram } from "@agorix/program-model";
import {
  applyProposalSession,
  createProposalSession,
  createStoredProjectWithProgram,
  modifyProposalSession,
  rejectProposalSession,
  serializeProjectFile,
  serializeStoredProject,
  suggestFirstStep,
  suggestRepeat,
  parseProjectFile,
  parseStoredProject,
  type StudioProposalSession,
} from "../studioCore.js";
import { REMOTE_SCHEME, type OpenProject, type StoredSnapshot } from "../store/session.js";

export interface StudioProposalCommandPort {
  readonly context: vscode.ExtensionContext;
  requireProject(): OpenProject | undefined;
  agentAgreements(): AgentAgreements;
  getCurrentProject(): OpenProject | undefined;
  setCurrentProject(project: OpenProject): void;
  getCurrentProjectionId(): string;
  getActiveProposal(): StudioProposalSession | undefined;
  setActiveProposal(proposal: StudioProposalSession | undefined): void;
  undoStack(): StoredSnapshot[];
  redoStack(): StoredSnapshot[];
  refreshCompanionViews(): void;
  afterCanonicalProgramChange(): void;
  openProjection(id: string): Promise<void>;
  revealCanonicalNode(nodeId: string): Promise<void>;
}

export interface StudioProposalCommandHandlers {
  suggestFirstStepCommand(): Promise<void>;
  suggestRepeatCommand(): Promise<void>;
  reviewProposalSession(proposalSession: StudioProposalSession): Promise<void>;
  revealProposalAffectedNode(): Promise<void>;
  applyActiveProposal(): Promise<void>;
  rejectActiveProposal(): void;
  undoProposal(): Promise<void>;
  redoProposal(): Promise<void>;
  commitProgram(program: ProjectProgram): Promise<void>;
}

export function createStudioProposalCommandHandlers(
  port: StudioProposalCommandPort,
): StudioProposalCommandHandlers {
  let applying = false;
  const revealIfPresent = async (nodeId: string): Promise<void> => {
    try {
      await port.revealCanonicalNode(nodeId);
    } catch (error) {
      if (!(error instanceof RangeError)) {
        throw error;
      }
    }
  };

  const writeCurrentProject = async (
    stored: ReturnType<typeof createStoredProjectWithProgram>,
    remoteCommit = false,
  ): Promise<boolean> => {
    const open = port.requireProject();
    if (open === undefined) {
      return false;
    }
    let accepted = stored;
    let remote = open.remote;
    if (open.uri.scheme === REMOTE_SCHEME && remoteCommit) {
      if (remote === undefined) return false;
      const client = await createRemoteClient(port.context);
      if (client === undefined) return false;
      if (port.getCurrentProject() !== open) return false;
      try {
        const result = await client.saveProject({
          id: remote.id,
          expectedRevision: remote.revision,
          project: stored,
        });
        if (result.status !== "saved") {
          void vscode.window.showWarningMessage(
            t("The server project changed; reopen it before applying the proposal."),
          );
          return false;
        }
        if (port.getCurrentProject() !== open) {
          void vscode.window.showWarningMessage(
            t("Proposal saved on the server. Reopen the project to see it."),
          );
          return false;
        }
        accepted = result.project;
        remote = { ...remote, revision: result.revision };
      } catch {
        void vscode.window.showWarningMessage(t("Could not save the proposal. Project unchanged."));
        return false;
      }
    }
    const raw = serializeProjectFile(accepted, open.uri.fsPath, { includeMedia: true });
    if (open.uri.scheme !== REMOTE_SCHEME) {
      await vscode.workspace.fs.writeFile(open.uri, new TextEncoder().encode(raw));
    }
    port.setCurrentProject({
      uri: open.uri,
      project: parseProjectFile(raw, open.uri.fsPath),
      ...(remote === undefined ? {} : { remote }),
    });
    port.afterCanonicalProgramChange();
    return true;
  };

  const restoreSnapshot = async (snapshot: StoredSnapshot): Promise<boolean> => {
    const open = port.requireProject();
    if (open === undefined || snapshot.uri.toString() !== open.uri.toString()) return false;
    const restored = parseStoredProject(snapshot.raw);
    if (snapshot.uri.scheme === REMOTE_SCHEME && snapshot.remoteCommitted)
      return writeCurrentProject(restored.stored, true);
    const raw = serializeProjectFile(restored.stored, snapshot.uri.fsPath, { includeMedia: true });
    if (snapshot.uri.scheme !== REMOTE_SCHEME)
      await vscode.workspace.fs.writeFile(snapshot.uri, new TextEncoder().encode(raw));
    port.setCurrentProject({
      uri: snapshot.uri,
      project: parseProjectFile(raw, snapshot.uri.fsPath),
      ...(open.remote === undefined ? {} : { remote: open.remote }),
    });
    port.afterCanonicalProgramChange();
    return true;
  };

  const reviewProposalSession = async (proposalSession: StudioProposalSession): Promise<void> => {
    const open = port.requireProject();
    if (open === undefined) {
      return;
    }
    port.setActiveProposal(proposalSession);
    port.refreshCompanionViews();
    const [before, after] = await Promise.all([
      vscode.workspace.openTextDocument({
        content: proposalSession.diff.acceptedCode,
        language: "javascript",
      }),
      vscode.workspace.openTextDocument({
        content: proposalSession.diff.proposedCode,
        language: "javascript",
      }),
    ]);
    await vscode.commands.executeCommand(
      "vscode.diff",
      before.uri,
      after.uri,
      t("Agorix proposal: {0}", proposalSession.purpose),
    );
    if (proposalSession.affectedNodeIds[0] !== undefined) {
      await revealIfPresent(proposalSession.affectedNodeIds[0]);
    }
    const apply = t("Apply");
    const modify = t("Modify");
    const reject = t("Reject");
    const operation = proposalSession.review.proposal.operations[0];
    const canModify =
      proposalSession.review.proposal.operations.length === 1 &&
      operation?.type === "appendStatement" &&
      (operation.statement.type === "move" || operation.statement.type === "turn");
    const choice = await vscode.window.showInformationMessage(
      `${proposalSession.purpose}. ${proposalSession.rationale}`,
      apply,
      ...(canModify ? [modify] : []),
      reject,
    );
    if (choice === apply) {
      await applyActiveProposal();
    } else if (choice === modify && canModify && operation?.type === "appendStatement") {
      const original =
        operation.statement.type === "move"
          ? operation.statement.steps
          : operation.statement.degrees;
      const entered = await vscode.window.showInputBox({
        title: t("Modify proposed number"),
        value: String(original),
        prompt: t("Enter the number to preview before applying."),
      });
      if (entered === undefined) return;
      const amount = Number(entered);
      if (!Number.isInteger(amount) || amount === original) {
        void vscode.window.showWarningMessage(t("Choose a different whole number."));
        return;
      }
      const statement =
        operation.statement.type === "move"
          ? { type: "move" as const, steps: amount }
          : { type: "turn" as const, degrees: amount };
      let modified: StudioProposalSession;
      try {
        modified = createProposalSession(open.project, {
          ...proposalSession.review.proposal,
          operations: [{ ...operation, statement }],
        });
      } catch {
        void vscode.window.showWarningMessage(t("That number cannot be used here."));
        return;
      }
      const [originalDoc, modifiedDoc] = await Promise.all([
        vscode.workspace.openTextDocument({
          content: modified.diff.acceptedCode,
          language: "javascript",
        }),
        vscode.workspace.openTextDocument({
          content: modified.diff.proposedCode,
          language: "javascript",
        }),
      ]);
      await vscode.commands.executeCommand(
        "vscode.diff",
        originalDoc.uri,
        modifiedDoc.uri,
        t("Modified Agorix proposal"),
      );
      if (
        (await vscode.window.showInformationMessage(
          t("Apply your modified proposal?"),
          apply,
          t("Cancel"),
        )) !== apply
      )
        return;
      const current = port.requireProject();
      if (current === undefined || current.uri.toString() !== open.uri.toString()) return;
      if (applying) return;
      let decision;
      try {
        decision = modifyProposalSession(
          current.project.stored.program,
          proposalSession,
          modified.review.candidateProgram,
        );
      } catch {
        void vscode.window.showWarningMessage(t("The project changed; review the proposal again."));
        return;
      }
      applying = true;
      try {
        const previousRaw = serializeStoredProject(current.project.stored);
        if (
          !(await writeCurrentProject(
            createStoredProjectWithProgram(current.project.stored, decision.program),
            true,
          ))
        )
          return;
        port.undoStack().push({
          uri: current.uri,
          raw: previousRaw,
          ...(current.remote === undefined ? {} : { remoteCommitted: true }),
        });
        port.redoStack().length = 0;
        port.setActiveProposal(undefined);
        void vscode.window.showInformationMessage(t("Applied modified proposal."));
      } finally {
        applying = false;
      }
    } else if (choice === reject) {
      rejectActiveProposal();
    }
  };

  const suggestFirstStepCommand = async (): Promise<void> => {
    const open = port.requireProject();
    if (open === undefined) {
      return;
    }
    if (!canPropose(port.agentAgreements())) {
      await vscode.window.showInformationMessage(ceilingMessage(port.agentAgreements()));
      return;
    }
    const suggestion = suggestFirstStep(open.project);
    if (suggestion === undefined) {
      await vscode.window.showInformationMessage(
        t("First-step proposal is only available for an empty script."),
      );
      return;
    }
    await reviewProposalSession(suggestion.session);
  };

  const suggestRepeatCommand = async (): Promise<void> => {
    const open = port.requireProject();
    if (open === undefined) {
      return;
    }
    if (!canPropose(port.agentAgreements())) {
      await vscode.window.showInformationMessage(ceilingMessage(port.agentAgreements()));
      return;
    }
    const suggestion = suggestRepeat(open.project);
    if (suggestion === undefined) {
      await vscode.window.showInformationMessage(t("Nothing repeated here. No suggestion."));
      return;
    }
    await reviewProposalSession(suggestion.session);
  };

  const revealProposalAffectedNode = async (): Promise<void> => {
    const nodeId = port.getActiveProposal()?.affectedNodeIds[0];
    if (nodeId !== undefined) {
      await revealIfPresent(nodeId);
    }
  };

  const applyActiveProposal = async (): Promise<void> => {
    if (applying) return;
    const open = port.requireProject();
    const activeProposal = port.getActiveProposal();
    if (open === undefined || activeProposal === undefined) {
      return;
    }
    applying = true;
    try {
      const previousRaw = serializeStoredProject(open.project.stored);
      const decision = applyProposalSession(open.project.stored.program, activeProposal);
      const stored = createStoredProjectWithProgram(open.project.stored, decision.program);
      if (!(await writeCurrentProject(stored, true))) return;
      port.undoStack().push({
        uri: open.uri,
        raw: previousRaw,
        ...(open.remote === undefined ? {} : { remoteCommitted: true }),
      });
      port.redoStack().length = 0;
      port.afterCanonicalProgramChange();
      port.setActiveProposal(undefined);
      await vscode.window.showInformationMessage(
        t("Applied proposal. Use Undo Studio Change to restore it."),
      );
    } finally {
      applying = false;
    }
  };

  const rejectActiveProposal = (): void => {
    if (applying) return;
    const open = port.requireProject();
    const activeProposal = port.getActiveProposal();
    if (open === undefined || activeProposal === undefined) {
      return;
    }
    rejectProposalSession(open.project.stored.program, activeProposal);
    port.setActiveProposal(undefined);
    port.refreshCompanionViews();
    void vscode.window.showInformationMessage(t("Rejected proposal. Project unchanged."));
  };

  const undoProposal = async (): Promise<void> => {
    const open = port.requireProject();
    const previous = port.undoStack().at(-1);
    if (open === undefined || previous === undefined) {
      return;
    }
    port.undoStack().pop();
    port.redoStack().push({
      uri: open.uri,
      raw: serializeStoredProject(open.project.stored),
      ...(previous.remoteCommitted ? { remoteCommitted: true } : {}),
    });
    let restored: boolean;
    try {
      restored = await restoreSnapshot(previous);
    } catch (error) {
      if (port.getCurrentProject() === open) {
        port.redoStack().pop();
        port.undoStack().push(previous);
      }
      throw error;
    }
    if (!restored) {
      port.redoStack().pop();
      port.undoStack().push(previous);
      return;
    }
  };

  const redoProposal = async (): Promise<void> => {
    const open = port.requireProject();
    const next = port.redoStack().at(-1);
    if (open === undefined || next === undefined) {
      return;
    }
    port.redoStack().pop();
    port.undoStack().push({
      uri: open.uri,
      raw: serializeStoredProject(open.project.stored),
      ...(next.remoteCommitted ? { remoteCommitted: true } : {}),
    });
    let restored: boolean;
    try {
      restored = await restoreSnapshot(next);
    } catch (error) {
      if (port.getCurrentProject() === open) {
        port.undoStack().pop();
        port.redoStack().push(next);
      }
      throw error;
    }
    if (!restored) {
      port.undoStack().pop();
      port.redoStack().push(next);
      return;
    }
  };

  const commitProgram = async (program: ProjectProgram): Promise<void> => {
    const open = port.requireProject();
    if (open === undefined) {
      return;
    }
    const previousRaw = serializeStoredProject(open.project.stored);
    if (!(await writeCurrentProject(createStoredProjectWithProgram(open.project.stored, program))))
      return;
    port.undoStack().push({ uri: open.uri, raw: previousRaw });
    port.redoStack().length = 0;
    port.afterCanonicalProgramChange();
  };

  return {
    suggestFirstStepCommand,
    suggestRepeatCommand,
    reviewProposalSession,
    revealProposalAffectedNode,
    applyActiveProposal,
    rejectActiveProposal,
    undoProposal,
    redoProposal,
    commitProgram,
  };
}
