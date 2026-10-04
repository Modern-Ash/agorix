import * as vscode from "vscode";
import {
  createExecutionEvidence,
  createExecutionViewState,
  formatInspectorReport,
  type StudioExecutionEvidence,
  type StudioExecutionStatus,
  type StudioExecutionViewState,
} from "../studioCore.js";
import type { OpenProject } from "../store/session.js";
import { ExecutionInspectorItem } from "../views/providers.js";

export interface StudioExecutionCommandPort {
  requireProject(): OpenProject | undefined;
  getEvidence(): StudioExecutionEvidence | undefined;
  setEvidence(evidence: StudioExecutionEvidence | undefined): void;
  getFrameIndex(): number;
  setFrameIndex(frameIndex: number): void;
  getStatus(): StudioExecutionStatus;
  setStatus(status: StudioExecutionStatus): void;
  refreshExecutionViews(): void;
  revealCanonicalNode(nodeId: string): Promise<void>;
  didRunExecution?(view: StudioExecutionViewState): void;
}

export interface StudioExecutionCommandHandlers {
  currentExecutionView(): StudioExecutionViewState | undefined;
  resetExecution(): StudioExecutionViewState | undefined;
  runExecution(): StudioExecutionViewState | undefined;
  stepExecution(): StudioExecutionViewState | undefined;
  stopExecution(): StudioExecutionViewState | undefined;
  selectExecutionStep(target?: unknown): Promise<StudioExecutionViewState | undefined>;
  showEvidence(output: vscode.OutputChannel): string | undefined;
}

export function createStudioExecutionCommandHandlers(
  port: StudioExecutionCommandPort,
): StudioExecutionCommandHandlers {
  const computeExecution = (): StudioExecutionEvidence | undefined => {
    const open = port.requireProject();
    if (open === undefined) {
      return undefined;
    }
    const evidence = port.getEvidence() ?? createExecutionEvidence(open.project.stored);
    port.setEvidence(evidence);
    return evidence;
  };

  const currentExecutionView = (): StudioExecutionViewState | undefined => {
    const evidence = port.getEvidence();
    return evidence === undefined
      ? undefined
      : createExecutionViewState(evidence, port.getFrameIndex(), port.getStatus());
  };

  const setExecution = (
    evidence: StudioExecutionEvidence,
    frameIndex: number,
    status: StudioExecutionStatus,
  ): StudioExecutionViewState => {
    port.setEvidence(evidence);
    port.setStatus(status);
    const view = createExecutionViewState(evidence, frameIndex, status);
    port.setFrameIndex(view.selectedFrameIndex);
    port.refreshExecutionViews();
    port.didRunExecution?.(view);
    return view;
  };

  const resetExecution = (): StudioExecutionViewState | undefined => {
    const evidence = computeExecution();
    return evidence === undefined ? undefined : setExecution(evidence, 0, "idle");
  };

  const runExecution = (): StudioExecutionViewState | undefined => {
    const open = port.requireProject();
    if (open === undefined) {
      return undefined;
    }
    const evidence = createExecutionEvidence(open.project.stored);
    return setExecution(evidence, evidence.previewFrames.length - 1, "completed");
  };

  const stepExecution = (): StudioExecutionViewState | undefined => {
    const evidence = computeExecution();
    if (evidence === undefined) {
      return undefined;
    }
    const nextFrame = Math.min(
      port.getFrameIndex() + 1,
      Math.max(0, evidence.previewFrames.length - 1),
    );
    const status = nextFrame >= evidence.previewFrames.length - 1 ? "completed" : "running";
    return setExecution(evidence, nextFrame, status);
  };

  const stopExecution = (): StudioExecutionViewState | undefined => {
    const open = port.requireProject();
    if (open === undefined) {
      return undefined;
    }
    const stoppedAt = currentExecutionView()?.currentFrame?.step ?? 0;
    const evidence = createExecutionEvidence(open.project.stored, { stopAfterSteps: stoppedAt });
    return setExecution(evidence, evidence.previewFrames.length - 1, "stopped");
  };

  const selectExecutionStep = async (
    target?: unknown,
  ): Promise<StudioExecutionViewState | undefined> => {
    const stepIndex =
      typeof target === "number"
        ? target
        : target instanceof ExecutionInspectorItem
          ? target.step.index
          : 0;
    const evidence = computeExecution();
    if (evidence === undefined) {
      return undefined;
    }
    const step = createExecutionViewState(evidence, stepIndex, port.getStatus()).inspectorSteps[
      stepIndex
    ];
    const view = setExecution(evidence, step?.frameIndex ?? stepIndex, port.getStatus());
    if (step?.nodeId !== undefined) {
      await port.revealCanonicalNode(step.nodeId);
    }
    return view;
  };

  const showEvidence = (output: vscode.OutputChannel): string | undefined => {
    const open = port.requireProject();
    if (open === undefined) {
      return undefined;
    }
    const evidence = createExecutionEvidence(open.project.stored);
    setExecution(evidence, evidence.previewFrames.length - 1, "completed");
    const report = formatInspectorReport(evidence);
    output.clear();
    output.appendLine(report);
    output.show(true);
    const firstNode = evidence.stepSequence.find((step) => step.nodeId !== undefined)?.nodeId;
    if (firstNode !== undefined) {
      void port.revealCanonicalNode(firstNode);
    }
    return report;
  };

  return {
    currentExecutionView,
    resetExecution,
    runExecution,
    stepExecution,
    stopExecution,
    selectExecutionStep,
    showEvidence,
  };
}
