import * as vscode from "vscode";
import { refreshWorkbench } from "../host/workbenchPanel.js";
import { clearProjectSession, type OpenProject, type StudioSessionState } from "./session.js";

export interface StudioLifecyclePort {
  refreshStudioViews(): void;
  refreshExecutionViews(): void;
  refreshCompanionViews(): void;
}

export function resetProjectSessionState(state: StudioSessionState): void {
  clearProjectSession(state);
  refreshWorkbench();
}

export function updateStudioContext(state: StudioSessionState): void {
  void vscode.commands.executeCommand(
    "setContext",
    "agorixStudio.hasProject",
    state.current !== undefined,
  );
}

export function requireProject(state: StudioSessionState): OpenProject | undefined {
  if (state.current === undefined) {
    void vscode.window.showWarningMessage("Open an Agorix project first.");
  }
  return state.current;
}

export function afterCanonicalProgramChange(
  state: StudioSessionState,
  port: StudioLifecyclePort,
): void {
  state.executionEvidence = undefined;
  state.executionFrameIndex = 0;
  state.executionStatus = "idle";
  port.refreshStudioViews();
  port.refreshExecutionViews();
  port.refreshCompanionViews();
  refreshWorkbench();
}
