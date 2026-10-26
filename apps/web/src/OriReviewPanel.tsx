import { requestOriContextPreview } from "./oriContextClient.js";
import { useState } from "react";
import { requestOriReviewPreview, type OriReviewPreview } from "./oriReviewClient.js";

const ACTIONS = [
  { intent: "help", label: "Necesito ayuda" },
  { intent: "debug", label: "¿Por qué no funciona?" },
  { intent: "repeat", label: "Quiero repetir pasos" },
  { intent: "move", label: "Quiero mover un personaje" },
  { intent: "turn", label: "Quiero girar" },
] as const;

export interface OriLearnerContext {
  readonly scriptCount: number;
  readonly hintCount: number;
  readonly hasRunEvidence: boolean;
  readonly verifiedTraceSteps?: number;
  readonly outcome?: "not-run" | "completed" | "failed" | "stopped";
}

export function describeOriLearningContext(context: OriLearnerContext): string {
  const scripts = Number.isSafeInteger(context.scriptCount) && context.scriptCount >= 0
    ? Math.min(context.scriptCount, 999) : 0;
  const hints = Number.isSafeInteger(context.hintCount) && context.hintCount >= 0
    ? Math.min(context.hintCount, 999) : 0;
  return `Tu proyecto tiene ${scripts} secuencias. Consultaste ${hints} pistas. ${context.hasRunEvidence ? "Hay una ejecución para revisar." : "Todavía no hay una ejecución para comparar."}`;
}

/**
 * Context is displayed locally. It is NOT sent to Ori until the cross-repo
 * context contract is implemented and verified.
 */
export function OriReviewPanel({ context }: { readonly context?: OriLearnerContext }) {
  const [result, setResult] = useState<OriReviewPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [reflection, setReflection] = useState<"try" | "explain" | null>(null);
  const ask = async (intent: string) => {
    setSelected(intent);
    setReviewed(false);
    setReflection(null);
    setResult(null);
    setLoading(true);
    try {
      const contextual = context?.outcome
        ? await requestOriContextPreview({intent:intent as "help"|"repeat"|"turn"|"move"|"debug",context:{scriptCount:context.scriptCount,hintCount:context.hintCount,outcome:context.outcome}})
        : null;
      setResult(contextual?.status === "ready" ? contextual : await requestOriReviewPreview(intent));
    }
    finally { setLoading(false); }
  };
  return (
    <section aria-label="Vista previa experimental de Ori" data-testid="ori-review-panel">
      <h3>Ori · Aprendamos a programar</h3>
      <p>Elegí qué querés explorar. Ori te propone una pista para pensar, no modifica tu programa.</p>
      {context ? <p data-testid="ori-local-context">{describeOriLearningContext(context)}</p> : null}
      {context?.verifiedTraceSteps !== undefined ? <p data-testid="ori-trace-evidence">Ejecución canónica verificada: {context.verifiedTraceSteps} pasos. La traza permanece en Agorix.</p> : null}
      <div className="tutor-actions" aria-label="Acciones educativas de Ori">
        {ACTIONS.map(action => (
          <button key={action.intent} type="button" disabled={loading}
            aria-pressed={selected === action.intent}
            onClick={() => ask(action.intent)}>
            {action.label}
          </button>
        ))}
      </div>
      {loading ? <p role="status">Ori está preparando una pista…</p> : null}
      {result?.status === "ready" ? (
        <div data-testid="ori-review-result" aria-live="polite">
          <p>{result.hint}</p>
          <p>Siguiente paso: {result.nextStep}</p>
          <p>Solo para revisión. No se aplicaron cambios.</p>
          <fieldset>
            <legend>¿Qué vas a hacer con esta pista?</legend>
            <label><input type="radio" name="ori-reflection" checked={reflection === "try"}
              onChange={() => setReflection("try")} /> Voy a probar una idea</label>
            <label><input type="radio" name="ori-reflection" checked={reflection === "explain"}
              onChange={() => setReflection("explain")} /> Necesito entenderla mejor</label>
          </fieldset>
          <button type="button" onClick={() => setReviewed(true)}
            disabled={reviewed || reflection === null}>
            {reviewed ? "Pista revisada" : "Ya revisé esta pista"}
          </button>
        </div>
      ) : result ? <p role="status">Ori no está disponible en este momento.</p> : null}
    </section>
  );
}
