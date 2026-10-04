import * as vscode from "vscode";
import { guarded } from "./guarded.js";

type CommandBody = (...args: unknown[]) => unknown | Promise<unknown>;

export interface StudioCommandHandlers {
  readonly createProject: CommandBody;
  readonly openProject: CommandBody;
  readonly exportAgorixProject: CommandBody;
  readonly checkAgentHealth: CommandBody;
  readonly setAgentCredential: CommandBody;
  readonly clearAgentCredential: CommandBody;
  readonly signIn: CommandBody;
  readonly signOut: CommandBody;
  readonly listRemoteProjects: CommandBody;
  readonly openRemoteProject: CommandBody;
  readonly saveRemoteProject: CommandBody;
  readonly openProjection: CommandBody;
  readonly switchProjection: CommandBody;
  readonly revealCanonicalNode: CommandBody;
  readonly openWorldPreview: CommandBody;
  readonly runExecution: CommandBody;
  readonly stepExecution: CommandBody;
  readonly resetExecution: CommandBody;
  readonly stopExecution: CommandBody;
  readonly selectExecutionStep: CommandBody;
  readonly companionExplain: CommandBody;
  readonly companionChallenge: CommandBody;
  readonly companionDebug: CommandBody;
  readonly companionReflect: CommandBody;
  readonly companionBuild: CommandBody;
  readonly suggestFirstStep: CommandBody;
  readonly applyProposal: CommandBody;
  readonly rejectProposal: CommandBody;
  readonly revealProposalAffectedNode: CommandBody;
  readonly undoProposal: CommandBody;
  readonly redoProposal: CommandBody;
  readonly showEvidence: CommandBody;
  readonly validateProject: CommandBody;
  readonly runChecks: CommandBody;
  readonly openWorkbench: CommandBody;
  readonly showDeveloperContext: CommandBody;
  readonly openScm: CommandBody;
  readonly suggestRepeat: CommandBody;
}

export function registerStudioCommands(
  output: vscode.OutputChannel,
  handlers: StudioCommandHandlers,
): vscode.Disposable[] {
  const commandTable: Array<{
    readonly id: string;
    readonly label: string;
    readonly body: CommandBody;
  }> = [
    { id: "agorixStudio.createProject", label: "Create Project", body: handlers.createProject },
    { id: "agorixStudio.openProject", label: "Open Project", body: handlers.openProject },
    {
      id: "agorixStudio.exportAgorix",
      label: "Export Agorix Project",
      body: handlers.exportAgorixProject,
    },
    {
      id: "agorixStudio.checkAgentHealth",
      label: "Check Agent Availability",
      body: handlers.checkAgentHealth,
    },
    {
      id: "agorixStudio.setAgentCredential",
      label: "Set Agent Credential",
      body: handlers.setAgentCredential,
    },
    {
      id: "agorixStudio.clearAgentCredential",
      label: "Clear Agent Credential",
      body: handlers.clearAgentCredential,
    },
    { id: "agorixStudio.signIn", label: "Sign In", body: handlers.signIn },
    { id: "agorixStudio.signOut", label: "Sign Out", body: handlers.signOut },
    {
      id: "agorixStudio.listRemoteProjects",
      label: "List Remote Projects",
      body: handlers.listRemoteProjects,
    },
    {
      id: "agorixStudio.openRemoteProject",
      label: "Open Remote Project",
      body: handlers.openRemoteProject,
    },
    {
      id: "agorixStudio.saveRemoteProject",
      label: "Save Remote Project",
      body: handlers.saveRemoteProject,
    },
    { id: "agorixStudio.openProjection", label: "Open Projection", body: handlers.openProjection },
    {
      id: "agorixStudio.switchProjection",
      label: "Switch Projection",
      body: handlers.switchProjection,
    },
    {
      id: "agorixStudio.revealCanonicalNode",
      label: "Reveal Canonical Node",
      body: handlers.revealCanonicalNode,
    },
    {
      id: "agorixStudio.openWorldPreview",
      label: "Open World Preview",
      body: handlers.openWorldPreview,
    },
    { id: "agorixStudio.run", label: "Run", body: handlers.runExecution },
    { id: "agorixStudio.step", label: "Step", body: handlers.stepExecution },
    { id: "agorixStudio.reset", label: "Reset", body: handlers.resetExecution },
    { id: "agorixStudio.stop", label: "Stop", body: handlers.stopExecution },
    {
      id: "agorixStudio.selectExecutionStep",
      label: "Select Execution Step",
      body: handlers.selectExecutionStep,
    },
    { id: "agorixStudio.companionExplain", label: "Explain", body: handlers.companionExplain },
    {
      id: "agorixStudio.companionChallenge",
      label: "Challenge",
      body: handlers.companionChallenge,
    },
    { id: "agorixStudio.companionDebug", label: "Debug", body: handlers.companionDebug },
    { id: "agorixStudio.companionReflect", label: "Reflect", body: handlers.companionReflect },
    { id: "agorixStudio.companionBuild", label: "Build", body: handlers.companionBuild },
    {
      id: "agorixStudio.suggestFirstStep",
      label: "Suggest first step",
      body: handlers.suggestFirstStep,
    },
    { id: "agorixStudio.applyProposal", label: "Apply Proposal", body: handlers.applyProposal },
    { id: "agorixStudio.rejectProposal", label: "Reject Proposal", body: handlers.rejectProposal },
    {
      id: "agorixStudio.revealProposalAffectedNode",
      label: "Reveal Proposal Affected Node",
      body: handlers.revealProposalAffectedNode,
    },
    { id: "agorixStudio.undoProposal", label: "Undo Proposal", body: handlers.undoProposal },
    { id: "agorixStudio.redoProposal", label: "Redo Proposal", body: handlers.redoProposal },
    {
      id: "agorixStudio.showEvidence",
      label: "Show Execution Evidence",
      body: handlers.showEvidence,
    },
    {
      id: "agorixStudio.validateProject",
      label: "Validate Project",
      body: handlers.validateProject,
    },
    { id: "agorixStudio.runChecks", label: "Run Checks", body: handlers.runChecks },
    { id: "agorixStudio.openWorkbench", label: "Open Workbench", body: handlers.openWorkbench },
    {
      id: "agorixStudio.showDeveloperContext",
      label: "Show Developer Context",
      body: handlers.showDeveloperContext,
    },
    { id: "agorixStudio.openScm", label: "Open SCM", body: handlers.openScm },
    { id: "agorixStudio.suggestRepeat", label: "Suggest repeat", body: handlers.suggestRepeat },
  ];

  return commandTable.map((entry) =>
    vscode.commands.registerCommand(entry.id, guarded(output, entry.label, entry.body)),
  );
}
