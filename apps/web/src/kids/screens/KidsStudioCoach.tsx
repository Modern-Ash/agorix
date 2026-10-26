import { useEffect, useRef, useState } from "react";
import type { OriStudioIntent } from "@agorix/ori-agent";
import type { Locale } from "../../i18n.js";
import {
  DIRECTIONS,
  DIRECTION_LABEL,
  blockName,
  explainRun,
  judgePrediction,
  type ActorFacts,
  type Direction,
  type Reflection,
} from "../kidsStudioCoach.js";

const INTENT_LABEL: Record<Locale, Record<OriStudioIntent, string>> = {
  es: {
    ahead: "Avanzar bastante",
    square: "Hacer un cuadrado",
    backForth: "Ir y volver",
    zigzag: "Hacer un zigzag",
    melody: "Tocar una melodía",
    rhythm: "Hacer un ritmo",
    cheer: "Festejar con sonido",
  },
  en: {
    ahead: "Go a long way",
    square: "Make a square",
    backForth: "Go there and back",
    zigzag: "Make a zigzag",
    melody: "Play a tune",
    rhythm: "Make a beat",
    cheer: "Cheer with a sound",
  },
};

/** The child's goal, picked from a closed list; no typing, so nothing personal can be entered. */
export function StudioIntentPicker({
  locale,
  intents,
  disabled,
  onPick,
}: {
  readonly locale: Locale;
  readonly intents: readonly OriStudioIntent[];
  readonly disabled: boolean;
  readonly onPick: (intent: OriStudioIntent) => void;
}) {
  const es = locale === "es";
  return (
    <div role="group" aria-label={es ? "¿Qué querés lograr?" : "What do you want to achieve?"}>
      <strong>{es ? "¿Qué querés lograr?" : "What do you want to achieve?"}</strong>
      {intents.map((intent) => (
        <button
          key={intent}
          type="button"
          className="kids-button"
          disabled={disabled}
          onClick={() => onPick(intent)}
        >
          {INTENT_LABEL[locale][intent]}
        </button>
      ))}
    </div>
  );
}

/** Before playing: an optional guess about where the character will go. */
export function StudioPrediction({
  locale,
  name,
  value,
  onChange,
}: {
  readonly locale: Locale;
  readonly name: string;
  readonly value: Direction | null;
  readonly onChange: (next: Direction | null) => void;
}) {
  const es = locale === "es";
  return (
    <fieldset className="kids-studio-prediction">
      <legend>
        {es ? `¿Qué va a hacer ${name}? (opcional)` : `What will ${name} do? (optional)`}
      </legend>
      {DIRECTIONS.map((direction) => (
        <label key={direction}>
          <input
            type="radio"
            name="studio-prediction"
            checked={value === direction}
            onChange={() => onChange(direction)}
          />{" "}
          {DIRECTION_LABEL[locale][direction]}
        </label>
      ))}
      <button type="button" className="kids-button" onClick={() => onChange(null)}>
        {es ? "No sé, probemos" : "I don't know, let's try"}
      </button>
    </fieldset>
  );
}

/** After playing: what the run really did, the guess checked against it, and one question. */
export function StudioCoach({
  locale,
  name,
  facts,
  predicted,
  reflection,
  onExplained,
}: {
  readonly locale: Locale;
  readonly name: string;
  readonly facts: ActorFacts;
  readonly predicted: Direction | null;
  readonly reflection: Reflection | null;
  /** Called once when the child's guess or answer matched what the run really did. */
  readonly onExplained?: (() => void) | undefined;
}) {
  const es = locale === "es";
  const [answer, setAnswer] = useState<string | number | boolean | null>(null);
  const judged = predicted ? judgePrediction(predicted, facts, name, locale) : null;
  const told = useRef(false);
  const correct =
    reflection === null || answer === null
      ? false
      : reflection.kind === "cause"
        ? reflection.answers.includes(String(answer))
        : reflection.kind === "count"
          ? answer === reflection.answer
          : false;
  // The "did you expect it?" question is the child's own word, so only the checks count as evidence.
  useEffect(() => {
    if (told.current || !(judged?.match || correct)) return;
    told.current = true;
    onExplained?.();
  }, [judged?.match, correct, onExplained]);
  const reply = (() => {
    if (reflection === null || answer === null) return null;
    if (reflection.kind === "expected")
      return answer === true
        ? es
          ? "¡Bien! Tu idea y lo que pasó coinciden."
          : "Nice! Your idea and what happened match."
        : es
          ? `Miremos juntos: ${name} terminó ${DIRECTION_LABEL.es[facts.direction]}.`
          : `Let's look together: ${name} ended up ${DIRECTION_LABEL.en[facts.direction]}.`;
    if (reflection.kind === "cause")
      return reflection.answers.includes(String(answer))
        ? es
          ? `Sí: "${blockName(String(answer), "es")}" movió a ${name}.`
          : `Yes: "${blockName(String(answer), "en")}" moved ${name}.`
        : es
          ? `Mirá el paso a paso: se movió con "${reflection.answers.map((type) => blockName(type, "es")).join(", ")}".`
          : `Look at the steps: it moved with "${reflection.answers.map((type) => blockName(type, "en")).join(", ")}".`;
    return answer === reflection.answer
      ? es
        ? `Eso es: se ejecutaron ${reflection.answer}.`
        : `That's it: ${reflection.answer} ran.`
      : es
        ? `En total se ejecutaron ${reflection.answer}. Mirá el paso a paso.`
        : `${reflection.answer} ran in total. Look at the steps.`;
  })();
  return (
    <section className="kids-studio-coach" aria-label={es ? "Qué pasó" : "What happened"}>
      <h3>{es ? "Ori mira lo que pasó" : "Ori looks at what happened"}</h3>
      <ul>
        {explainRun(facts, name, locale).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {judged ? (
        <p role="status" data-testid="coach-prediction">
          {judged.text}
        </p>
      ) : null}
      {reflection ? (
        <div role="group" aria-label={reflection.question}>
          <strong>{reflection.question}</strong>
          {reflection.kind === "expected" ? (
            <>
              <button type="button" className="kids-button" onClick={() => setAnswer(true)}>
                {es ? "Sí" : "Yes"}
              </button>
              <button type="button" className="kids-button" onClick={() => setAnswer(false)}>
                {es ? "No" : "No"}
              </button>
            </>
          ) : (
            (reflection.options as readonly (string | number)[]).map((option) => (
              <button
                key={option}
                type="button"
                className="kids-button"
                onClick={() => setAnswer(option)}
              >
                {reflection.kind === "cause" ? blockName(String(option), locale) : option}
              </button>
            ))
          )}
          {reply ? (
            <p role="status" data-testid="coach-reply">
              {reply}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
