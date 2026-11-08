import type {
  ProjectCreativeState,
  ProjectProgram,
  Script,
  Statement,
} from "@agorix/program-model";
import type { MultiActorRunResult, MultiActorTraceEntry } from "@agorix/runtime";

/**
 * What went differently from what a learner probably expected, found in the run's own evidence.
 * The runtime proves; nothing here is a guess by a model, and nothing here is prose.
 */
export type FindingKind =
  | "neverStarted"
  | "messageUnheard"
  | "conditionNeverTrue"
  | "conditionNeverFalse"
  | "predictionMismatch";

/** The event a script waits for, as a closed shape. `name` is a key or message name. */
export interface FindingEvent {
  readonly type: "key" | "click" | "message";
  readonly name?: string;
  /** For a message: how many scripts send it (0 means nothing ever sends it). */
  readonly senders?: number;
}

export interface Finding {
  /** Stable for the same kind and place, so a surface can remember it was shown. */
  readonly id: string;
  readonly kind: FindingKind;
  readonly actorId: string;
  /** The blocks the finding is about, in the canonical node-id form. */
  readonly nodeIds: readonly string[];
  readonly counts: Readonly<Record<string, number>>;
  /**
   * Where in the run it happened: the index into the run's trace (and frames) of the first
   * statement the finding is about. Absent for something that never happened.
   */
  readonly traceIndex?: number;
  readonly event?: FindingEvent;
  /** 0 to 1. Only the most confident finding is surfaced; low ones are kept for tests and tools. */
  readonly confidence: number;
}

export interface DiagnoseInput {
  readonly program: ProjectProgram;
  readonly creative?: ProjectCreativeState;
  readonly run: MultiActorRunResult;
  /**
   * False while a live run is still going: an event that has not happened yet is not a finding
   * until the run is over.
   */
  readonly final?: boolean;
  /** The learner's prediction was judged against the run elsewhere; false means it did not match. */
  readonly predictionMatched?: boolean;
  /** Restrict to one character (the selected one). */
  readonly actorId?: string;
}

/** The finding to show, or none: at most one per run keeps Ori quiet. */
export const SURFACE_THRESHOLD = 0.6;

function childrenOf(statement: Statement): readonly (readonly [string, readonly Statement[]])[] {
  switch (statement.type) {
    case "repeat":
    case "repeatUntil":
    case "forever":
      return [["body", statement.body]];
    case "if":
      return [
        ["then", statement.then],
        ["else", statement.else ?? []],
      ];
    default:
      return [];
  }
}

/** Every statement with its node id, loops and branches included. */
function walk(
  statements: readonly Statement[],
  prefix: string,
  visit: (statement: Statement, nodeId: string) => void,
): void {
  statements.forEach((statement, index) => {
    const nodeId = `${prefix}/statements[${index}]`;
    visit(statement, nodeId);
    const visitChildren = (list: readonly Statement[], base: string) =>
      list.forEach((child, i) => {
        const id = `${base}[${i}]`;
        visit(child, id);
        for (const [name, nested] of childrenOf(child)) visitChildren(nested, `${id}/${name}`);
      });
    for (const [name, nested] of childrenOf(statement)) visitChildren(nested, `${nodeId}/${name}`);
  });
}

function statementAt(program: ProjectProgram, nodeId: string): Statement | undefined {
  let found: Statement | undefined;
  program.scripts.forEach((script, index) => {
    walk(script.statements, `scripts[${index}]`, (statement, id) => {
      if (id === nodeId) found = statement;
    });
  });
  return found;
}

function actorsOfScript(creative: ProjectCreativeState | undefined, script: Script): string[] {
  return (creative?.actors ?? [])
    .filter((actor) => actor.scripts?.includes(script.id))
    .map((actor) => actor.id);
}

function eventOf(script: Script): FindingEvent | undefined {
  const trigger = script.trigger;
  if (trigger.type === "onKeyPressed") return { type: "key", name: trigger.key };
  if (trigger.type === "onActorClicked") return { type: "click" };
  if (trigger.type === "onMessage") return { type: "message", name: trigger.message };
  return undefined;
}

export function diagnoseRun(input: DiagnoseInput): readonly Finding[] {
  const { program, creative, run } = input;
  const final = input.final !== false;
  const out: Finding[] = [];
  const wants = (actorId: string) => input.actorId === undefined || input.actorId === actorId;

  // Who sends each message (statically), and which sends actually ran.
  const senders = new Map<string, number>();
  program.scripts.forEach((script, index) =>
    walk(script.statements, `scripts[${index}]`, (statement) => {
      if (statement.type === "broadcast")
        senders.set(statement.message, (senders.get(statement.message) ?? 0) + 1);
    }),
  );
  const receivers = new Set<string>();
  for (const script of program.scripts)
    if (script.trigger.type === "onMessage") receivers.add(script.trigger.message);

  // 1. A script that never started, and what it was waiting for.
  if (final) {
    program.scripts.forEach((script, index) => {
      const event = eventOf(script);
      if (event === undefined) return;
      if (run.activations.some((activation) => activation.scriptId === script.id)) return;
      const owners = actorsOfScript(creative, script);
      const actorId = owners[0] ?? "";
      if (!wants(actorId)) return;
      const sends = event.type === "message" ? (senders.get(event.name ?? "") ?? 0) : undefined;
      const ranSend =
        event.type === "message"
          ? run.trace.some((entry) => {
              const statement = statementAt(program, entry.nodeId);
              return statement?.type === "broadcast" && statement.message === event.name;
            })
          : false;
      // A message nobody sends is a mistake worth saying; one whose sender did not run is likely;
      // a key or a tap is only something the learner has not done yet.
      const confidence = event.type === "message" ? (sends === 0 ? 0.9 : ranSend ? 0.3 : 0.7) : 0.5;
      out.push({
        id: `neverStarted:${script.id}`,
        kind: "neverStarted",
        actorId,
        nodeIds: [`scripts[${index}]`],
        counts: sends === undefined ? {} : { senders: sends },
        event: sends === undefined ? event : { ...event, senders: sends },
        confidence,
      });
    });
  }

  // 2. A message that was sent and that no script receives.
  const sentNodes = new Map<string, MultiActorTraceEntry[]>();
  const sentAt = new Map<string, number>();
  run.trace.forEach((entry, index) => {
    if (!wants(entry.actorId)) return;
    const statement = statementAt(program, entry.nodeId);
    if (statement?.type !== "broadcast" || receivers.has(statement.message)) return;
    sentNodes.set(entry.nodeId, [...(sentNodes.get(entry.nodeId) ?? []), entry]);
    if (!sentAt.has(entry.nodeId)) sentAt.set(entry.nodeId, index);
  });
  for (const [nodeId, entries] of sentNodes) {
    const statement = statementAt(program, nodeId);
    if (statement?.type !== "broadcast") continue;
    out.push({
      id: `messageUnheard:${nodeId}`,
      kind: "messageUnheard",
      actorId: entries[0]!.actorId,
      nodeIds: [nodeId],
      counts: { sent: entries.length },
      traceIndex: sentAt.get(nodeId)!,
      event: {
        type: "message",
        name: statement.message,
        senders: senders.get(statement.message) ?? 0,
      },
      confidence: 0.9,
    });
  }

  // 3. A condition that always gave the same answer.
  const asked = new Map<string, { yes: number; no: number; actorId: string; first: number }>();
  run.trace.forEach((entry, index) => {
    if (entry.conditionResult === undefined || !wants(entry.actorId)) return;
    const seen = asked.get(entry.nodeId) ?? { yes: 0, no: 0, actorId: entry.actorId, first: index };
    if (entry.conditionResult) seen.yes += 1;
    else seen.no += 1;
    asked.set(entry.nodeId, seen);
  });
  for (const [nodeId, { yes, no, actorId, first }] of asked) {
    if (statementAt(program, nodeId)?.type !== "if") continue;
    if (yes === 0)
      out.push({
        id: `conditionNeverTrue:${nodeId}`,
        kind: "conditionNeverTrue",
        actorId,
        nodeIds: [nodeId],
        counts: { yes, no },
        traceIndex: first,
        confidence: no >= 2 ? 0.8 : 0.6,
      });
    else if (no === 0 && yes >= 3)
      out.push({
        id: `conditionNeverFalse:${nodeId}`,
        kind: "conditionNeverFalse",
        actorId,
        nodeIds: [nodeId],
        counts: { yes, no },
        traceIndex: first,
        confidence: 0.4,
      });
  }

  // 4. The learner's guess did not match what happened.
  if (input.predictionMatched === false && final)
    out.push({
      id: "predictionMismatch",
      kind: "predictionMismatch",
      actorId: input.actorId ?? "",
      nodeIds: [],
      counts: {},
      confidence: 0.7,
    });

  return out.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
}

/** The one finding to show, if any is confident enough. */
export function surfacedFinding(findings: readonly Finding[]): Finding | undefined {
  const [first] = findings;
  return first !== undefined && first.confidence >= SURFACE_THRESHOLD ? first : undefined;
}

/**
 * What may leave the device for rephrasing: the shape of the finding, never a name, an id or a
 * value the learner chose.
 */
export interface ProviderFinding {
  readonly kind: FindingKind;
  readonly counts: Readonly<Record<string, number>>;
  readonly eventType?: FindingEvent["type"];
}

export function toProviderFinding(finding: Finding): ProviderFinding {
  return {
    kind: finding.kind,
    counts: { ...finding.counts },
    ...(finding.event === undefined ? {} : { eventType: finding.event.type }),
  };
}
