import { useState } from "react";
import { requestOriReviewPreview, type OriReviewPreview } from "./oriReviewClient.js";

const ACTIONS = [
  { intent: "help", label: "Necesito ayuda" },
  { intent: "debug", label: "¿Por qué no funciona?" },
  { intent: "repeat", label: "Quiero repetir pasos" },
  { intent: "move", label: "Quiero mover un personaje" },
  { intent: "turn", label: "Quiero girar" },
] as const;

export function OriReviewPanel() {
  const [result, setResult] = useState<OriReviewPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const ask = async (intent: string) => {
    setSelected(intent);
    setReviewed(false);
    setResult(null);
    setLoading(true);
    try { setResult(await requestOriReviewPreview(intent)); }
    finally { setLoading(false); }
  };
  return (
    <section aria-label="Vista previa experimental de Ori" data-testid="ori-review-panel">
      <h3>Ori · Aprendamos a programar</h3>
      <p>Elegí qué querés explorar. Ori te propone una pista para pensar, no modifica tu programa.</p>
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
          <button type="button" onClick={() => setReviewed(true)} disabled={reviewed}>
            {reviewed ? "Pista revisada" : "Ya revisé esta pista"}
          </button>
        </div>
      ) : result ? <p role="status">Ori no está disponible en este momento.</p> : null}
    </section>
  );
}
