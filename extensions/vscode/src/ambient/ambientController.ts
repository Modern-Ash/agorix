import * as vscode from "vscode";
import {
  EMPTY_PROACTIVE_MEMORY,
  decideProactiveSuggestion,
  decideProactiveWithStudioPipeline,
  proactiveSignalFromStudio,
  recordProactiveOutcome,
  type ProactiveDecision,
  type ProactiveMemory,
  type ProactiveOfferAction,
  type StudioPipeline,
  type StudioSignal,
} from "@agorix/learning-decision-plane";
import { ambientIndicatorView, type AmbientIndicatorState } from "./indicator.js";
import type { StudioExecutionStatus } from "../studioCore.js";

export interface AmbientControllerOptions {
  readonly statusBarItem: vscode.StatusBarItem;
  readonly programId: () => string | undefined;
  readonly executionStatus: () => StudioExecutionStatus;
  readonly aiEnabled: () => boolean;
  readonly canOfferSignal: (kind: StudioSignal["kind"]) => boolean;
  /** The learner's assistance ceiling decides which actions an offer may carry (ADR 0008). */
  readonly allowAction?: (action: ProactiveOfferAction) => boolean;
  readonly budgetRemaining: () => number | undefined;
  readonly recordOffer: (outcome: "shown" | "accepted" | "dismissed" | "ignored") => void;
  readonly runCompanionAction: (action: ProactiveOfferAction) => Promise<unknown>;
  readonly proactivePipeline?: () => StudioPipeline | undefined;
  readonly showCanvasHint?: (signal: StudioSignal, decision: ProactiveDecision) => void;
  readonly clearCanvasHint?: () => void;
}

interface ActiveOffer {
  readonly signal: StudioSignal;
  readonly decision: ProactiveDecision;
}

const PICK_BY_ACTION: Record<ProactiveOfferAction, { label: string; description: string }> = {
  explain: { label: "$(comment) Explain", description: "Explain the current evidence" },
  debug: { label: "$(debug-alt) Debug", description: "Debug with runtime facts" },
  challenge: { label: "$(beaker) Challenge", description: "Ask for a prediction" },
  propose: { label: "$(lightbulb) Propose", description: "Suggest a small next change" },
};

export class AmbientController implements vscode.Disposable {
  readonly #statusBarItem: vscode.StatusBarItem;
  readonly #opts: AmbientControllerOptions;
  #memory: ProactiveMemory = EMPTY_PROACTIVE_MEMORY;
  #offer: ActiveOffer | undefined;
  #disposed = false;

  constructor(options: AmbientControllerOptions) {
    this.#opts = options;
    this.#statusBarItem = options.statusBarItem;
    this.#render("quiet");
  }

  async handleSignal(signal: StudioSignal): Promise<void> {
    if (this.#disposed) return;
    if (!this.#opts.aiEnabled()) {
      this.#offer = undefined;
      this.#render("off");
      return;
    }
    const budgetRemaining = this.#opts.budgetRemaining();
    if (budgetRemaining !== undefined && budgetRemaining <= 0) {
      this.#offer = undefined;
      this.#render("budget-capped");
      return;
    }
    if (this.#offer !== undefined) {
      this.#memory = recordProactiveOutcome(
        this.#memory,
        this.#opts.programId() ?? "no-project",
        "ignored",
        signal.sequence,
      );
      this.#opts.recordOffer("ignored");
      this.#offer = undefined;
      this.#opts.clearCanvasHint?.();
    }
    const programId = this.#opts.programId();
    if (programId === undefined) {
      this.#render("quiet");
      return;
    }
    if (!this.#opts.canOfferSignal(signal.kind)) {
      this.#render("quiet");
      return;
    }
    const proactive = proactiveSignalFromStudio(signal, {
      programId,
      running: this.#opts.executionStatus() === "running",
      typing: signal.kind === "selection-changed",
      aiEnabled: this.#opts.aiEnabled(),
      memory: this.#memory,
    });
    if (proactive === undefined) {
      this.#render("quiet");
      return;
    }
    const pipeline = this.#opts.proactivePipeline?.();
    const decision =
      pipeline === undefined
        ? decideProactiveSuggestion(proactive)
        : await decideProactiveWithStudioPipeline(proactive, {
            pipeline,
            studioSignal: signal,
            programHash: programId,
          });
    const allowed = this.#allowedActions(decision);
    if (decision.action === "offer" && allowed.length > 0) {
      this.#offer = { signal, decision };
      this.#memory = recordProactiveOutcome(this.#memory, programId, "offered", signal.sequence);
      this.#opts.recordOffer("shown");
      this.#opts.showCanvasHint?.(signal, decision);
      this.#render("available", decision);
      return;
    }
    this.#opts.clearCanvasHint?.();
    this.#render("quiet");
  }

  #allowedActions(decision: ProactiveDecision): readonly ProactiveOfferAction[] {
    const actions = decision.actions ?? ["explain"];
    const allow = this.#opts.allowAction;
    return allow === undefined ? actions : actions.filter((action) => allow(action));
  }

  async showOffer(): Promise<void> {
    const offer = this.#offer;
    const programId = this.#opts.programId();
    if (offer === undefined || programId === undefined) return;
    const actions = this.#allowedActions(offer.decision);
    if (actions.length === 0) return;
    const picks = [
      ...actions.map((action) => ({ ...PICK_BY_ACTION[action], action })),
      { label: "Not now", description: "Keep working without help", action: "decline" as const },
    ];
    const picked = await vscode.window.showQuickPick(picks, { title: "Learning Companion" });
    if (picked === undefined || picked.action === "decline") {
      this.#opts.recordOffer("dismissed");
      this.#memory = recordProactiveOutcome(
        this.#memory,
        programId,
        "declined",
        offer.signal.sequence,
      );
      this.#offer = undefined;
      this.#opts.clearCanvasHint?.();
      this.#render("quiet");
      return;
    }
    this.#opts.recordOffer("accepted");
    this.#memory = recordProactiveOutcome(
      this.#memory,
      programId,
      "accepted",
      offer.signal.sequence,
    );
    this.#offer = undefined;
    this.#opts.clearCanvasHint?.();
    this.#render("working");
    try {
      await this.#opts.runCompanionAction(picked.action);
    } finally {
      this.#render("quiet");
    }
  }

  clear(): void {
    this.#offer = undefined;
    this.#memory = EMPTY_PROACTIVE_MEMORY;
    this.#opts.clearCanvasHint?.();
    this.#render(this.#opts.aiEnabled() ? "quiet" : "off");
  }

  dispose(): void {
    this.#disposed = true;
    this.#statusBarItem.dispose();
  }

  #render(state: AmbientIndicatorState, offer?: ProactiveDecision): void {
    const view = ambientIndicatorView({
      state,
      ...(offer === undefined ? {} : { offer: { reason: offer.reason, source: offer.source } }),
    });
    this.#statusBarItem.text = view.text;
    this.#statusBarItem.tooltip = view.tooltip;
    this.#statusBarItem.command = view.command;
    this.#statusBarItem.show();
  }
}
