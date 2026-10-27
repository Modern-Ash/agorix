import { useState } from "react";
import type { Locale } from "../../i18n.js";
import {
  clearIndicators,
  INDICATORS_RETENTION_DAYS,
  loadIndicators,
  summarizeIndicators,
} from "../kidsIndicators.js";

const COPY = {
  es: {
    title: "Indicadores de aprendizaje",
    intro:
      "Resumen de los últimos 7 días en este dispositivo. Son solo conteos: no guardan programas, textos ni nombres, y nunca se envían a ningún lado.",
    empty: "Todavía no hay corridas en los últimos 7 días.",
    autonomy: "Autonomía",
    autonomyHelp: "Corridas hechas sin pedir ayuda a Ori ni abrir pistas.",
    success: "Llegó a la meta",
    successHelp: "Corridas que cumplieron el objetivo.",
    hints: "Pistas por corrida",
    hintsHelp: "Pistas de la escalera abiertas, dividido por corridas.",
    prediction: "Aciertos al predecir",
    predictionHelp: "Predicciones que coincidieron con lo que mostró el programa.",
    fallbacks: "Ori sin conexión",
    fallbacksHelp: "Veces que Ori respondió con reglas locales: ofertas y charla.",
    runs: "corridas",
    none: "sin datos",
    clear: "Borrar indicadores",
    cleared: "Indicadores borrados de este dispositivo.",
    keep: `Se conservan ${INDICATORS_RETENTION_DAYS} días.`,
  },
  en: {
    title: "Learning indicators",
    intro:
      "A summary of the last 7 days on this device. Counts only: no programs, text or names are kept, and nothing is ever sent anywhere.",
    empty: "No runs in the last 7 days yet.",
    autonomy: "Independence",
    autonomyHelp: "Runs made without asking Ori for help or opening hints.",
    success: "Reached the goal",
    successHelp: "Runs that met the objective.",
    hints: "Hints per run",
    hintsHelp: "Ladder hints opened, divided by runs.",
    prediction: "Prediction hits",
    predictionHelp: "Predictions that matched what the program showed.",
    fallbacks: "Ori offline",
    fallbacksHelp: "Times Ori answered with local rules: offers and chat.",
    runs: "runs",
    none: "no data",
    clear: "Clear indicators",
    cleared: "Indicators cleared from this device.",
    keep: `Kept for ${INDICATORS_RETENTION_DAYS} days.`,
  },
} as const;

/** Adult-only, device-local, aggregate counters (issue #632). */
export function KidsIndicatorsPanel({ locale }: { readonly locale: Locale }) {
  const copy = COPY[locale];
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");
  void version;
  const summary = summarizeIndicators(loadIndicators());
  const pct = (value: number | null) => (value === null ? copy.none : `${value}%`);
  const fallbacks = summary.totals.oriFallbacks + summary.totals.chatFallbacks;
  return (
    <section className="kids-adult-card" aria-labelledby="kids-indicators-title">
      <h2 id="kids-indicators-title">{copy.title}</h2>
      <p>{copy.intro}</p>
      {summary.totals.runs === 0 ? (
        <p className="kids-note">{copy.empty}</p>
      ) : (
        <dl className="kids-adult-metrics">
          <div>
            <dt>{copy.autonomy}</dt>
            <dd>
              {pct(summary.independentPercent)} ({summary.totals.runs} {copy.runs})
            </dd>
            <dd className="kids-note">{copy.autonomyHelp}</dd>
          </div>
          <div>
            <dt>{copy.success}</dt>
            <dd>{pct(summary.completedPercent)}</dd>
            <dd className="kids-note">{copy.successHelp}</dd>
          </div>
          <div>
            <dt>{copy.hints}</dt>
            <dd>{summary.hintsPerRun === null ? copy.none : summary.hintsPerRun}</dd>
            <dd className="kids-note">{copy.hintsHelp}</dd>
          </div>
          <div>
            <dt>{copy.prediction}</dt>
            <dd>{pct(summary.predictionPercent)}</dd>
            <dd className="kids-note">{copy.predictionHelp}</dd>
          </div>
          <div>
            <dt>{copy.fallbacks}</dt>
            <dd>{fallbacks}</dd>
            <dd className="kids-note">{copy.fallbacksHelp}</dd>
          </div>
        </dl>
      )}
      <p className="kids-note">{copy.keep}</p>
      <button
        type="button"
        className="kids-button"
        onClick={() => {
          clearIndicators();
          setVersion((count) => count + 1);
          setMessage(copy.cleared);
        }}
      >
        {copy.clear}
      </button>
      <p role="status" className="kids-note">
        {message}
      </p>
    </section>
  );
}
