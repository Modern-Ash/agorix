import { validateSnapshot, validateTrace, validateProposal } from "./contracts.mjs";
import { createToolRegistry } from "./tools.mjs";
import { createProviderRouter } from "./providers.mjs";
import { validatePedagogicalHint } from "./output-guard.mjs";
/**
 * Ori MVP: provider-free educational agent harness.
 * Agorix-first defaults; no UI, no network, no shell and no automatic edits.
 * This is intentionally a deterministic baseline. LLM adapters are future work.
 */
export const AGORIX_PROFILE = Object.freeze({
  id: "agorix-kids-v1",
  locale: "es-AR",
  maxToolCalls: 2,
  maxSteps: 4,
  allowedTools: Object.freeze(["inspectProgram", "inspectTrace"]),
  hintPolicy: Object.freeze({ revealSolutionBeforeAttempt: false, maxProposedBlocks: 1 })
});

const ALLOWED_INTENTS = new Set(["help", "repeat", "turn", "move", "debug", "unknown"]);
const MAX_INPUT_LENGTH = 300;
const PERSONAL_DATA = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\+?\d[\d .()-]{8,}\d)\b)/i;
const UNSAFE = /\b(?:contrase(?:ñ|n)a|password|direcci[oó]n de casa|mi tel[eé]fono|arma|suicid|autolesi[oó]n)\b/i;

export class OriInputError extends Error {
  constructor(message) { super(message); this.name = "OriInputError"; }
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OriInputError(`${label} debe ser un objeto`);
  }
}
function cleanText(text) {
  if (typeof text !== "string" || text.length > MAX_INPUT_LENGTH) {
    throw new OriInputError("Consulta inválida o demasiado larga");
  }
  return text.trim();
}
function normalize(text) {
  return text.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function classify(text) {
  const s = normalize(text);
  if (/repet|bucle|veces/.test(s)) return "repeat";
  if (/gir|izquierda|derecha/.test(s)) return "turn";
  if (/mover|avanz|llegar|meta|planeta|ganar|gano|gane/.test(s)) return "move";
  if (/error|falla|no funciona|por que|detuvo/.test(s)) return "debug";
  if (/ayuda|no entiendo|como hago|pista/.test(s)) return "help";
  return "unknown";
}
function extractEvidence(trace) {
  if (!trace || !Array.isArray(trace.steps)) return null;
  const last = trace.steps.at(-1);
  if (!last || !Number.isSafeInteger(last.index) || typeof last.description !== "string") return null;
  // Only host-supplied trace; never quote arbitrary content as instructions.
  return { index: last.index, description: last.description.slice(0, 100) };
}
function planFor(intent) {
  const goals = {
    repeat: ["Identificar la acción que se repite", "Elegir cuántas veces", "Predecir y probar"],
    turn: ["Observar la dirección actual", "Elegir el giro", "Probar el resultado"],
    move: ["Observar la distancia a la meta", "Predecir el movimiento", "Ejecutar y comparar"],
    debug: ["Ejecutar", "Inspeccionar la traza", "Corregir una instrucción y repetir"],
    help: ["Describir el objetivo", "Elegir una acción pequeña", "Probar y observar"],
    unknown: ["Aclarar el objetivo", "Probar una idea pequeña", "Observar el resultado"]
  };
  return { kind: "learning-plan", steps: goals[intent] };
}
function boundedProposal(intent, program, request, attempts, hintsUsed) {
  if (!request.allowProposal || attempts < 1 || hintsUsed < 2) return null;
  if (!program || !Array.isArray(program.allowedBlocks)) return null;
  // Only propose a single allowlisted Agorix canonical block; never apply it.
  const kind = intent === "move" ? "move" : intent === "turn" ? "turn" : null;
  if (!kind || !program.allowedBlocks.includes(kind)) return null;
  const block = kind === "move" ? { kind: "move", steps: 1 } : { kind: "turn", direction: "right" };
  return { schemaVersion: "ori/proposal/v0", operation: "append", blocks: [block], requiresLearnerApproval: true };
}
function defaultHint(intent, context) {
  if (intent === "repeat") return "¿Qué parte querés hacer varias veces? Probá pensar en repetir.";
  if (intent === "turn") return "¿Hacia dónde mira tu personaje antes de girar?";
  if (intent === "move") return "¿Cuántos pasos pensás que faltan? Probá uno y mirá el resultado.";
  if (intent === "debug") return context.attempts > 0
    ? "Miremos el resultado de la última ejecución. ¿En qué paso cambió lo que esperabas?"
    : "Primero probá ejecutar y después miramos qué ocurrió.";
  if (intent === "help") return "Contame qué querés lograr con tu programa. Podemos probar una idea pequeña.";
  return "¿Qué querés que haga tu personaje? Podemos pensarlo paso a paso.";
}

/**
 * @param {{inspectProgram?:()=>Promise<object>|object, inspectTrace?:()=>Promise<object>|object}} tools
 * @param {{profile?:object}} options
 */
export function createOriHarness(tools = {}, options = {}) {
  assertPlainObject(tools, "tools");
  const profile = options.profile ?? AGORIX_PROFILE;
  if (profile.id !== AGORIX_PROFILE.id) throw new OriInputError("Perfil no soportado en este MVP");
  const providerRouter = options.providerRouter ?? createProviderRouter();
  return Object.freeze({
    profile: AGORIX_PROFILE,
    async respond(request) {
      assertPlainObject(request, "request");
      const message = cleanText(request.message);
      const context = request.context ?? {};
      assertPlainObject(context, "context");
      const attempts = context.attempts ?? 0;
      if (!Number.isSafeInteger(attempts) || attempts < 0 || attempts > 10000) throw new OriInputError("attempts inválido");
      const hintsUsed = context.hintsUsed ?? 0;
      if (!Number.isSafeInteger(hintsUsed) || hintsUsed < 0 || hintsUsed > 10000) throw new OriInputError("hintsUsed inválido");
      if (PERSONAL_DATA.test(message) || UNSAFE.test(message)) {
        return { kind: "safety", intent: "unknown", message: "No compartas datos personales. Si necesitás ayuda con algo importante, hablá con una persona adulta de confianza.", proposal: null, evidence: null, toolsUsed: [] };
      }
      const intent = classify(message);
      if (!ALLOWED_INTENTS.has(intent)) throw new OriInputError("Intent no permitido");
      const toolsUsed = [];
      const registry = createToolRegistry(tools, options.grants ?? AGORIX_PROFILE.allowedTools, AGORIX_PROFILE.maxToolCalls);
      // No provider calls; no writes. Reads are bounded to two allowlisted tools.
      let program = null;
      let trace = null;
      if (typeof tools.inspectProgram === "function") {
        program = await registry.call("inspectProgram"); if (program) program = validateSnapshot(program); toolsUsed.push("inspectProgram");
      }
      if (attempts > 0 && typeof tools.inspectTrace === "function") {
        trace = await registry.call("inspectTrace"); if (trace) trace = validateTrace(trace); toolsUsed.push("inspectTrace");
      }
      const evidence = extractEvidence(trace);
      let response = defaultHint(intent, { attempts });
      if (intent === "debug" && evidence) {
        response = `La ejecución llegó al paso ${evidence.index}. ¿Qué esperabas que ocurriera ahí?`;
      }
      // Optional provider output is restricted to short hints, never code or actions.
      let source = "deterministic";
      if (options.enableProvider === true && intent !== "unknown") {
        const model = await providerRouter.complete({ intent, learningStage: "connect", attempts, hintsUsed });
        if (!model.fallback && model.message) {
          const safeHint = validatePedagogicalHint(model.message);
          if (safeHint) { response = safeHint; source = model.source; }
        }
      }
      // Deliberately no auto-generated code or complete solutions in the baseline.
      // A later provider/planner may return a diff only after schema validation and child review.
      return {
        kind: "hint",
        intent,
        message: response,
        plan: planFor(intent),
        proposal: (() => { const candidate = boundedProposal(intent, program, request, attempts, hintsUsed); return candidate ? validateProposal(candidate, program) : null; })(),
        evidence,
        toolsUsed,
        policy: { fullSolutionAllowed: attempts > 0 && hintsUsed >= 2, appliedChanges: false },
        diagnostics: { programAvailable: !!program, provider: source }
      };
    }
  });
}
