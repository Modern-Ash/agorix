import { KIDS_GRID } from "@agorix/curriculum";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import { createProposalReview, validateProgramProposal } from "@agorix/proposals";
import type { KidsOriOffer } from "./kidsOri.js";

const ORI_PATH = "/api/tutor/ori";
const DEFAULT_TIMEOUT_MS = 7_500;
const MAX_RESPONSE_CHARS = 16 * 1024;

interface RequestOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

/** A failed, late or unsafe server reply is indistinguishable from local mode to the child. */
export async function requestKidsOriOffer(
  program: ProjectProgram,
  missionId: string,
  locale: "es" | "en",
  hintLevel: 1 | 2 | 3 | 4 | 5,
  missionIndex: number,
  options: RequestOptions = {},
): Promise<KidsOriOffer | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const text = await Promise.race([
      (async () => {
        const response = await fetchImpl(ORI_PATH, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ missionId, locale, hintLevel, program }),
          signal: controller.signal,
        });
        return response.ok ? response.text() : null;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Ori response budget exceeded"));
        }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      }),
    ]);
    if (text === null || text.length > MAX_RESPONSE_CHARS) return null;
    const envelope: unknown = JSON.parse(text);
    if (!isRecord(envelope) || !exactKeys(envelope, ["message", "proposal"])) return null;
    if (typeof envelope.message !== "string" || !envelope.proposal) return null;
    const proposal = validateProgramProposal(envelope.proposal as never);
    if (proposal.source.kind !== "learning-companion" || proposal.source.capability !== "builder")
      return null;
    if (proposal.operations.length > 3) return null;
    for (const operation of proposal.operations) {
      if (operation.type !== "appendStatement" || operation.scriptIndex !== 0) return null;
      if (!allowedStatement(operation.statement, missionIndex)) return null;
    }
    createProposalReview(program, proposal);
    const first = proposal.operations[0];
    if (first?.type !== "appendStatement") return null;
    const statement = first.statement;
    const kind =
      statement.type === "turn" ? "turn" : statement.type === "repeat" ? "repeat" : "move";
    const amount =
      statement.type === "move"
        ? statement.steps / KIDS_GRID.cellSize
        : statement.type === "repeat"
          ? statement.count
          : undefined;
    return { kind, ...(amount === undefined ? {} : { amount }), proposal };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function allowedStatement(statement: Statement, missionIndex: number): boolean {
  if (statement.type === "move")
    return (
      Number.isInteger(statement.steps / KIDS_GRID.cellSize) &&
      statement.steps >= KIDS_GRID.cellSize &&
      statement.steps <= 5 * KIDS_GRID.cellSize
    );
  if (statement.type === "turn")
    return missionIndex >= 1 && (statement.degrees === -90 || statement.degrees === 90);
  if (statement.type === "repeat")
    return (
      missionIndex >= 2 &&
      Number.isInteger(statement.count) &&
      statement.count >= 2 &&
      statement.count <= 6 &&
      statement.body.length === 1 &&
      statement.body[0]?.type === "move" &&
      allowedStatement(statement.body[0], missionIndex)
    );
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
