import {
  REPEAT_UNTIL_MAX_PASSES,
  type ProjectCreativeState,
  type ProjectProgram,
  type Script,
  type Statement,
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
  | "predictionMismatch"
  | "hiddenCharacter"
  | "soundSilent"
  | "workingAgainstEachOther"
  | "loopNeverEnds"
  | "repeatedBlocks"
  | "repeatedApart"
  | "wordNeverSet"
  | "copiesAtLimit";

/** Which loop did not end. */
export type LoopKindFound = "forever" | "repeatUntil" | "waitUntil";

/** The event a script waits for, as a closed shape. `name` is a key or message name. */
export interface FindingEvent {
  readonly type: "key" | "click" | "message" | "backdrop" | "clone" | "timer" | "loudness";
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
  /** For `loopNeverEnds`: which loop. */
  readonly loop?: LoopKindFound;
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

/** A statement without the blocks nested inside it, so each block is looked at once. */
function childless(statement: Statement): unknown {
  const copy: Record<string, unknown> = { ...(statement as unknown as Record<string, unknown>) };
  for (const key of ["body", "then", "else"]) delete copy[key];
  return copy;
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
  if (trigger.type === "onBackdropSwitch") return { type: "backdrop", name: trigger.backdropId };
  if (trigger.type === "onCloneStart") return { type: "clone" };
  if (trigger.type === "onTimerOver") return { type: "timer" };
  if (trigger.type === "onLoudnessOver") return { type: "loudness" };
  return undefined;
}

/** Fewest times the same blocks must be written before Ori says so, and the longest group. */
const MIN_REPEATED = 3;
const MAX_PERIOD = 3;

function repeatedWriting(statements: readonly Statement[]):
  | {
      readonly kind: "repeatedBlocks" | "repeatedApart";
      start: number;
      period: number;
      times: number;
    }
  | undefined {
  const keys = statements.map((statement) => JSON.stringify(statement));
  // In a row first: one to three blocks written out three or more times, one after the other.
  for (let start = 0; start < keys.length; start += 1)
    for (let period = 1; period <= MAX_PERIOD; period += 1) {
      let times = 1;
      while (
        start + (times + 1) * period <= keys.length &&
        keys
          .slice(start, start + period)
          .every((key, offset) => key === keys[start + times * period + offset])
      )
        times += 1;
      if (times >= MIN_REPEATED) return { kind: "repeatedBlocks", start, period, times };
    }
  // Apart: two or three blocks that come back later, not one right after the other.
  for (let period = 2; period <= MAX_PERIOD; period += 1)
    for (let start = 0; start + period <= keys.length; start += 1) {
      const group = keys.slice(start, start + period);
      let times = 1;
      let next = start + period;
      while (next + period <= keys.length) {
        if (group.every((key, offset) => key === keys[next + offset])) {
          times += 1;
          next += period;
        } else next += 1;
      }
      if (times >= MIN_REPEATED) return { kind: "repeatedApart", start, period, times };
    }
  return undefined;
}

/** Statements whose result a learner expects to see on the stage. */
const SHOWN = new Set([
  "move",
  "goTo",
  "glideTo",
  "goToTarget",
  "setX",
  "setY",
  "changeX",
  "changeY",
  "turn",
  "say",
  "think",
  "bounceOnEdge",
]);
const MOVES = new Set([
  "move",
  "goTo",
  "glideTo",
  "goToTarget",
  "setX",
  "setY",
  "changeX",
  "changeY",
  "bounceOnEdge",
]);

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
  // Which backdrops some block switches to, so a hat waiting for another one can be told apart.
  const switchedTo = new Set<string>();
  program.scripts.forEach((script, index) =>
    walk(script.statements, `scripts[${index}]`, (statement) => {
      if (statement.type === "switchBackdrop") switchedTo.add(statement.backdropId);
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
      // A copy script belongs to the character it is the copy script of.
      const owners = actorsOfScript(
        creative,
        script.trigger.type === "onCloneStart"
          ? { ...script, id: script.id.replace(/-clone$/, "") }
          : script,
      );
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
      const confidence =
        event.type === "message"
          ? sends === 0
            ? 0.9
            : ranSend
              ? 0.3
              : 0.7
          : event.type === "backdrop" && !switchedTo.has(event.name ?? "")
            ? 0.8
            : event.type === "clone"
              ? 0.6
              : 0.5;
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

  // 4. The program acted, but the character is hidden at the end, so nothing shows.
  for (const actor of run.actors) {
    if (!wants(actor.id) || actor.world.sprite.visible !== false) continue;
    const entries = run.trace
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.actorId === actor.id);
    const acted = entries.filter(({ entry }) => SHOWN.has(entry.statementType)).length;
    if (acted === 0) continue;
    const hid = entries.filter(({ entry }) => entry.statementType === "hide").at(-1);
    out.push({
      id: `hiddenCharacter:${actor.id}`,
      kind: "hiddenCharacter",
      actorId: actor.id,
      nodeIds: hid === undefined ? [] : [hid.entry.nodeId],
      counts: { actions: acted },
      ...(hid === undefined ? {} : { traceIndex: hid.index }),
      confidence: hid === undefined ? 0.6 : 0.8,
    });
  }

  // 5. A sound that played with the volume at zero.
  const silent = new Map<string, { count: number; first: number; actorId: string }>();
  run.trace.forEach((entry, index) => {
    if (entry.statementType !== "playSound" || !wants(entry.actorId)) return;
    if ((entry.worldAfter.sounds?.volume ?? 100) !== 0) return;
    const seen = silent.get(entry.nodeId) ?? { count: 0, first: index, actorId: entry.actorId };
    seen.count += 1;
    silent.set(entry.nodeId, seen);
  });
  for (const [nodeId, { count, first, actorId }] of silent)
    out.push({
      id: `soundSilent:${nodeId}`,
      kind: "soundSilent",
      actorId,
      nodeIds: [nodeId],
      counts: { played: count },
      traceIndex: first,
      confidence: 0.85,
    });

  // 6. Two scripts of one character pushing it in opposite directions, so it goes nowhere.
  const pushed = new Map<
    string,
    Map<string, { dx: number; dy: number; first: number; node: string }>
  >();
  run.trace.forEach((entry, index) => {
    if (!wants(entry.actorId) || !MOVES.has(entry.statementType)) return;
    const dx = entry.worldAfter.sprite.x - entry.worldBefore.sprite.x;
    const dy = entry.worldAfter.sprite.y - entry.worldBefore.sprite.y;
    if (dx === 0 && dy === 0) return;
    const scripts = pushed.get(entry.actorId) ?? new Map();
    const seen = scripts.get(entry.scriptId) ?? { dx: 0, dy: 0, first: index, node: entry.nodeId };
    seen.dx += dx;
    seen.dy += dy;
    scripts.set(entry.scriptId, seen);
    pushed.set(entry.actorId, scripts);
  });
  for (const [actorId, scripts] of pushed) {
    const list = [...scripts.values()].filter(
      (item) => Math.abs(item.dx) + Math.abs(item.dy) >= 40,
    );
    for (let a = 0; a < list.length; a += 1)
      for (let b = a + 1; b < list.length; b += 1) {
        const x = list[a]!;
        const y = list[b]!;
        const reach = Math.max(Math.abs(x.dx) + Math.abs(x.dy), Math.abs(y.dx) + Math.abs(y.dy));
        if (Math.abs(x.dx + y.dx) + Math.abs(x.dy + y.dy) > reach * 0.1) continue;
        out.push({
          id: `workingAgainstEachOther:${x.node}:${y.node}`,
          kind: "workingAgainstEachOther",
          actorId,
          nodeIds: [x.node, y.node],
          counts: { scripts: 2 },
          traceIndex: Math.min(x.first, y.first),
          confidence: 0.65,
        });
      }
  }

  // 7. A loop the run had to cut off: a forever, a repeat until or a wait until that never ended.
  program.scripts.forEach((script, scriptIndex) => {
    script.statements.forEach((statement, statementIndex) => {
      if (
        statement.type !== "forever" &&
        statement.type !== "repeatUntil" &&
        statement.type !== "waitUntil"
      )
        return;
      const base = `scripts[${scriptIndex}]/statements[${statementIndex}]`;
      const own = run.trace
        .map((entry, index) => ({ entry, index }))
        .filter(
          ({ entry }) =>
            entry.scriptId === script.id &&
            (entry.nodeId === base || entry.nodeId.startsWith(`${base}/`)),
        );
      const first = own[0];
      if (first === undefined || !wants(first.entry.actorId)) return;
      let passes = 0;
      if (statement.type === "forever") {
        if (run.outcome !== "budget-exceeded") return;
        passes = own.filter(({ entry }) => entry.statementType !== "forever").length;
      } else if (statement.type === "repeatUntil") {
        passes = own.filter(({ entry }) => entry.nodeId === `${base}/body[0]`).length;
        if (passes < REPEAT_UNTIL_MAX_PASSES) return;
      } else {
        if (!own.some(({ entry }) => entry.note?.startsWith("waitUntil"))) return;
      }
      out.push({
        id: `loopNeverEnds:${base}`,
        kind: "loopNeverEnds",
        actorId: first.entry.actorId,
        nodeIds: [base],
        counts: { passes },
        traceIndex: first.index,
        loop: statement.type,
        confidence: 0.9,
      });
    });
  });

  // 8. The same blocks written out again and again: in a row (a repeat would do) or apart (a
  // block of the learner's own would). Found in the program, so it shows after any run.
  program.scripts.forEach((script, scriptIndex) => {
    const actorId = actorsOfScript(creative, script)[0] ?? "";
    if (!wants(actorId)) return;
    const found = repeatedWriting(script.statements);
    if (found === undefined) return;
    out.push({
      id: `${found.kind}:scripts[${scriptIndex}]/statements[${found.start}]`,
      kind: found.kind,
      actorId,
      nodeIds: [`scripts[${scriptIndex}]/statements[${found.start}]`],
      counts: { period: found.period, times: found.times },
      confidence: found.kind === "repeatedBlocks" ? 0.62 : 0.6,
    });
  });

  // 9. A word that blocks read but nothing ever put anything in: it is always empty.
  const wordsWritten = new Set<string>();
  const wordReads = new Map<string, { nodeId: string; scriptIndex: number }[]>();
  program.scripts.forEach((script, scriptIndex) =>
    walk(script.statements, `scripts[${scriptIndex}]`, (statement, nodeId) => {
      if (statement.type === "setText" || statement.type === "askText")
        wordsWritten.add(statement.variableId);
      // The word a statement reads, other than the one it writes: found in its own shape.
      const shape = JSON.stringify(
        statement.type === "setText" ? statement.value : childless(statement),
      );
      for (const match of shape.matchAll(/"type":"textVariable","variableId":"([^"]+)"/g)) {
        const list = wordReads.get(match[1]!) ?? [];
        list.push({ nodeId, scriptIndex });
        wordReads.set(match[1]!, list);
      }
    }),
  );
  for (const [variableId, reads] of wordReads) {
    if (wordsWritten.has(variableId)) continue;
    const first = reads[0]!;
    const script = program.scripts[first.scriptIndex]!;
    const actorId = actorsOfScript(creative, script)[0] ?? "";
    if (!wants(actorId)) continue;
    // Said out loud in this run is a mistake worth pointing at; never reached is only likely.
    const ranAt = run.trace.findIndex((entry) =>
      reads.some((read) => read.nodeId === entry.nodeId),
    );
    out.push({
      id: `wordNeverSet:${variableId}`,
      kind: "wordNeverSet",
      actorId,
      nodeIds: [first.nodeId],
      counts: { reads: reads.length },
      ...(ranAt < 0 ? {} : { traceIndex: ranAt }),
      confidence: ranAt < 0 ? 0.4 : 0.75,
    });
  }

  // 10. Copies that were not made because the run already holds as many as it may.
  const refused = run.trace.findIndex((entry) => entry.note?.startsWith("createCopies: limit of"));
  if (refused >= 0 && wants(run.trace[refused]!.actorId))
    out.push({
      id: `copiesAtLimit:${run.trace[refused]!.nodeId}`,
      kind: "copiesAtLimit",
      actorId: run.trace[refused]!.actorId,
      nodeIds: [run.trace[refused]!.nodeId],
      counts: {
        refused: run.trace.filter((entry) => entry.note?.startsWith("createCopies: limit of"))
          .length,
        alive: run.actors.length,
      },
      traceIndex: refused,
      confidence: 0.8,
    });

  // 11. The learner's guess did not match what happened.
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
  readonly loop?: LoopKindFound;
}

export function toProviderFinding(finding: Finding): ProviderFinding {
  return {
    kind: finding.kind,
    counts: { ...finding.counts },
    ...(finding.event === undefined ? {} : { eventType: finding.event.type }),
    ...(finding.loop === undefined ? {} : { loop: finding.loop }),
  };
}
