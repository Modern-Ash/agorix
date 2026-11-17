import * as vscode from "vscode";
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
  type StudioProposalSession,
} from "../studioCore.js";
import { REMOTE_SCHEME, type OpenProject, type StoredSnapshot } from "../store/session.js";

export interface StudioProposalCommandPort {
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
  ): Promise<void> => {
    const open = port.requireProject();
    if (open === undefined) {
      return;
    }
    const raw = serializeProjectFile(stored, open.uri.fsPath, { includeMedia: true });
    if (open.uri.scheme !== REMOTE_SCHEME) {
      await vscode.workspace.fs.writeFile(open.uri, new TextEncoder().encode(raw));
    }
    port.setCurrentProject({
      uri: open.uri,
      project: parseProjectFile(raw, open.uri.fsPath),
      ...(open.remote === undefined ? {} : { remote: open.remote }),
    });
    port.afterCanonicalProgramChange();
  };

  const restoreSnapshot = async (snapshot: StoredSnapshot): Promise<void> => {
    const remote = port.getCurrentProject()?.remote;
    if (snapshot.uri.scheme !== REMOTE_SCHEME) {
      await vscode.workspace.fs.writeFile(snapshot.uri, new TextEncoder().encode(snapshot.raw));
    }
    port.setCurrentProject({
      uri: snapshot.uri,
      project: parseProjectFile(snapshot.raw, snapshot.uri.fsPath),
      ...(remote === undefined ? {} : { remote }),
    });
    port.afterCanonicalProgramChange();
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
        await writeCurrentProject(
          createStoredProjectWithProgram(current.project.stored, decision.program),
        );
        port.undoStack().push({ uri: current.uri, raw: previousRaw });
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
      await writeCurrentProject(stored);
      port.undoStack().push({ uri: open.uri, raw: previousRaw });
      port.redoStack().length = 0;
      port.setActiveProposal(undefined);
      await vscode.window.showInformationMessage(
        t("Applied proposal. Use Undo Proposal to restore it."),
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
    const previous = port.undoStack().pop();
    if (open === undefined || previous === undefined) {
      return;
    }
    port.redoStack().push({ uri: open.uri, raw: serializeStoredProject(open.project.stored) });
    await restoreSnapshot(previous);
  };

  const redoProposal = async (): Promise<void> => {
    const open = port.requireProject();
    const next = port.redoStack().pop();
    if (open === undefined || next === undefined) {
      return;
    }
    port.undoStack().push({ uri: open.uri, raw: serializeStoredProject(open.project.stored) });
    await restoreSnapshot(next);
  };

  const commitProgram = async (program: ProjectProgram): Promise<void> => {
    const open = port.requireProject();
    if (open === undefined) {
      return;
    }
    const previousRaw = serializeStoredProject(open.project.stored);
    await writeCurrentProject(createStoredProjectWithProgram(open.project.stored, program));
    port.undoStack().push({ uri: open.uri, raw: previousRaw });
    port.redoStack().length = 0;
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
