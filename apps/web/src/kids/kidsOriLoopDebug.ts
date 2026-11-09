import { diagnoseRun } from "@agorix/run-evidence";
import { type ProjectProgram, type Statement, type Trigger } from "@agorix/program-model";
import {
  createProgramProposal,
  createProposalReview,
  validateProgramProposal,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import type { MultiActorRunResult } from "@agorix/runtime";
import type { Locale } from "../i18n.js";
import {
  STUDIO_EDGE_CONDITION,
  actorOfScript,
  studioActorId,
  validateStudioProgram,
} from "./kidsStudioModel.js";

/**
 * Ori helps with a loop that did not end (issue #1132). Every sentence comes from the run's own
 * trace; the only change Ori can offer is a visible proposal the child accepts or declines.
 */
export type LoopKind = "forever" | "repeatUntil" | "waitUntil";

export interface LoopDiagnosis {
  readonly kind: LoopKind;
  /** Index of the loop among the script's top-level statements. */
  readonly statementIndex: number;
  readonly scriptIndex: number;
  /** Plain sentences backed by the trace. */
  readonly evidence: readonly string[];
}

function scriptIndexOf(program: ProjectProgram, actorId: string): number {
  return program.scripts.findIndex((script) => {
    const actor = actorOfScript(script.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === actorId;
  });
}

/**
 * The first top-level loop of this character that the run cut off, or null. The detection is the
 * `loopNeverEnds` finding of `@agorix/run-evidence`; the sentences are written here.
 */
export function diagnoseLoop(
  program: ProjectProgram,
  run: MultiActorRunResult,
  actorId: string,
  locale: Locale,
): LoopDiagnosis | null {
  const scriptIndex = scriptIndexOf(program, actorId);
  if (scriptIndex < 0) return null;
  const es = locale === "es";
  const found = diagnoseRun({ program, run, actorId })
    .flatMap((finding) => {
      const place = /^scripts\[(\d+)\]\/statements\[(\d+)\]$/.exec(finding.nodeIds[0] ?? "");
      return finding.kind === "loopNeverEnds" && place && Number(place[1]) === scriptIndex
        ? [{ finding, statementIndex: Number(place[2]) }]
        : [];
    })
    .sort((a, b) => a.statementIndex - b.statementIndex)[0];
  if (found === undefined) return null;
  const { finding, statementIndex } = found;
  const passes = finding.counts["passes"] ?? 0;
  const evidence =
    finding.loop === "forever"
      ? es
        ? `«Por siempre» no tiene un final propio: el programa corrió ${passes} bloques dentro del bucle y se cortó por el límite de pasos.`
        : `“Forever” has no end of its own: the program ran ${passes} blocks inside the loop and was cut by the step limit.`
      : finding.loop === "repeatUntil"
        ? es
          ? `La condición se revisó ${passes} veces y siempre dio «no», así que «Repetir hasta» nunca llegó a su final.`
          : `The condition was checked ${passes} times and always said “no”, so “Repeat until” never reached its end.`
        : es
          ? "«Esperar hasta» esperó 10 segundos del programa y la condición nunca dio «sí»."
          : "“Wait until” waited 10 program seconds and the condition never said “yes”.";
  return { kind: finding.loop!, statementIndex, scriptIndex, evidence: [evidence] };
}

/** When does this character's script start? A sentence per trigger. */
export function explainTrigger(trigger: Trigger, locale: Locale): string {
  const es = locale === "es";
  switch (trigger.type) {
    case "onStart":
      return es
        ? "Este programa empieza solo, cuando tocás Jugar."
        : "This program starts by itself when you press Play.";
    case "greenFlag":
      return es
        ? "Este programa empieza con la bandera verde, o sea cuando tocás Jugar."
        : "This program starts with the green flag, which is when you press Play.";
    case "onKeyPressed":
      return es
        ? `Este programa empieza cuando se pulsa la tecla ${trigger.key}.`
        : `This program starts when the ${trigger.key} key is pressed.`;
    case "onActorClicked":
      return es
        ? "Este programa empieza cuando tocás al personaje."
        : "This program starts when you tap the character.";
    case "onMessage":
      return es
        ? `Este programa empieza cuando llega el mensaje «${trigger.message}».`
        : `This program starts when the message “${trigger.message}” arrives.`;
    case "onTimerOver":
      return es
        ? `Este programa empieza cuando pasan ${trigger.seconds} segundos desde que tocás Jugar.`
        : `This program starts when ${trigger.seconds} seconds have passed since you press Play.`;
    case "onLoudnessOver":
      return es
        ? `Este programa empieza cuando el volumen pasa de ${trigger.level}.`
        : `This program starts when the loudness goes over ${trigger.level}.`;
    case "onCloneStart":
      return es
        ? "Este programa empieza cuando nace una copia del personaje."
        : "This program starts when a copy of the character is born.";
    case "onBackdropSwitch":
      return es
        ? "Este programa empieza cuando cambia el fondo."
        : "This program starts when the backdrop changes.";
  }
}

function stopStatement(): Statement {
  return {
    type: "if",
    condition: STUDIO_EDGE_CONDITION,
    then: [{ type: "stop", scope: "script" }],
  };
}

/** The one change Ori can offer for a `forever`: a way out when the character touches the edge. */
export function foreverExit(statement: Statement): Statement | null {
  if (statement.type !== "forever" || statement.body.length > 2) return null;
  return { ...statement, body: [...statement.body, stopStatement()] };
}

export function explainForeverExit(locale: Locale): string {
  return locale === "es"
    ? "Si agregás «Si toca el borde → Detener», el bucle tiene una salida y el programa termina."
    : "If you add “If touching the edge → Stop”, the loop has a way out and the program ends.";
}

export function proposeForeverExit(
  program: ProjectProgram,
  diagnosis: LoopDiagnosis,
  locale: Locale,
): ProgramProposal {
  const current = validateStudioProgram(program);
  const script = current.scripts[diagnosis.scriptIndex]!;
  const original = script.statements[diagnosis.statementIndex];
  const replacement = original ? foreverExit(original) : null;
  if (diagnosis.kind !== "forever" || !replacement) throw new Error("no exit to offer");
  const actor = actorOfScript(script.id)!;
  const nodeId = `scripts[${diagnosis.scriptIndex}]/statements[${diagnosis.statementIndex}]`;
  const proposal = createProgramProposal({
    id: `ori-forever-exit-${diagnosis.scriptIndex}-${diagnosis.statementIndex}`,
    baseProgram: current,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: locale === "es" ? "Una salida para el bucle" : "A way out of the loop",
    rationale: explainForeverExit(locale),
    affectedActorIds: [studioActorId(actor.index, actor.characterId)],
    affectedScriptIds: [script.id],
    affectedNodeIds: [nodeId],
    operations: [{ type: "replaceStatement", nodeId, statement: replacement }],
  });
  reviewForeverExit(current, diagnosis, proposal);
  return proposal;
}

/** Recheck the loop, its place and the exact replacement before showing or accepting bytes. */
export function reviewForeverExit(
  program: ProjectProgram,
  diagnosis: LoopDiagnosis,
  raw: ProgramProposal,
): ProposalReview {
  const current = validateStudioProgram(program);
  const script = current.scripts[diagnosis.scriptIndex];
  const original = script?.statements[diagnosis.statementIndex];
  const expected = original ? foreverExit(original) : null;
  const proposal = validateProgramProposal(raw);
  const operation = proposal.operations[0];
  const nodeId = `scripts[${diagnosis.scriptIndex}]/statements[${diagnosis.statementIndex}]`;
  if (
    !expected ||
    proposal.source.kind !== "learning-companion" ||
    proposal.source.capability !== "builder" ||
    proposal.operations.length !== 1 ||
    operation?.type !== "replaceStatement" ||
    operation.nodeId !== nodeId ||
    JSON.stringify(operation.statement) !== JSON.stringify(expected) ||
    proposal.affectedNodeIds.join() !== nodeId
  )
    throw new Error("Ori loop exit is outside the closed scene contract");
  return createProposalReview(current, proposal);
}
