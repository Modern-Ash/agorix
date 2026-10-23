import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../i18n.js";

interface Props {
  readonly locale: Locale;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const COPY = {
  es: {
    gate: "Solo para adultos",
    question: "¿Cuánto es 7 + 5?",
    check: "Comprobar",
    back: "Borrar dígito",
    wrong: "Probá otra vez.",
    confirm: "¿Borrar este proyecto?",
    yes: "Borrar",
    cancel: "Cancelar",
  },
  en: {
    gate: "Grown-ups only",
    question: "What is 7 + 5?",
    check: "Check",
    back: "Delete digit",
    wrong: "Try again.",
    confirm: "Delete this project?",
    yes: "Delete",
    cancel: "Cancel",
  },
} as const;

/** Adult sum gate, then a plain confirmation whose default focus is Cancel. */
export function DeleteProjectDialog({ locale, onConfirm, onCancel }: Props) {
  const copy = COPY[locale];
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);
  const [passed, setPassed] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (passed) cancel.current?.focus();
  }, [passed]);

  function press(label: string) {
    if (label === "⌫") {
      setDigits((value) => value.slice(0, -1));
      setWrong(false);
    } else if (label === "✓") {
      if (digits === "12") setPassed(true);
      else setWrong(true);
      setDigits("");
    } else if (digits.length < 3) {
      setDigits((value) => value + label);
      setWrong(false);
    }
  }

  return (
    <div className="kids-predict-backdrop">
      <div
        className="kids-predict-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kids-delete-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        {passed ? (
          <>
            <h2 id="kids-delete-title">{copy.confirm}</h2>
            <div>
              <button type="button" className="kids-button" ref={cancel} onClick={onCancel}>
                {copy.cancel}
              </button>
              <button type="button" className="kids-button" onClick={onConfirm}>
                {copy.yes}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="kids-parents-kicker">🔒 {copy.gate}</p>
            <h2 id="kids-delete-title">{copy.question}</h2>
            <output className="kids-gate-display" aria-label={copy.question}>
              {digits || "_ _"}
            </output>
            <div className="kids-gate-pad" role="group" aria-label={copy.question}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => press(label)}
                  aria-label={label === "✓" ? copy.check : label === "⌫" ? copy.back : label}
                >
                  {label}
                </button>
              ))}
            </div>
            <p role="status" className="kids-note">
              {wrong ? copy.wrong : ""}
            </p>
            <button type="button" className="kids-button" onClick={onCancel}>
              {copy.cancel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
