import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../i18n.js";

interface Props {
  readonly locale: Locale;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** The local math gate mirrors other adult decisions; media is never included by default. */
export function ExportMediaDialog({ locale, onConfirm, onCancel }: Props) {
  const es = locale === "es";
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);
  const [passed, setPassed] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const question = es ? "¿Cuánto es 7 + 5?" : "What is 7 + 5?";

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
        aria-labelledby="kids-media-export-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        {passed ? (
          <>
            <h2 id="kids-media-export-title">
              {es ? "Exportar con imágenes" : "Export with images"}
            </h2>
            <p>
              {es
                ? "Este archivo incluirá los dibujos del proyecto. Compartilo solo con quien elijas."
                : "This file will include the project's drawings. Share it only with someone you choose."}
            </p>
            <div>
              <button type="button" className="kids-button" ref={cancel} onClick={onCancel}>
                {es ? "Cancelar" : "Cancel"}
              </button>
              <button type="button" className="kids-button kids-primary" onClick={onConfirm}>
                {es ? "Incluir imágenes y exportar" : "Include images and export"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="kids-parents-kicker">🔒 {es ? "Solo para adultos" : "Grown-ups only"}</p>
            <h2 id="kids-media-export-title">{question}</h2>
            <output className="kids-gate-display" aria-label={question}>
              {digits || "_ _"}
            </output>
            <div className="kids-gate-pad" role="group" aria-label={question}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => press(label)}
                  aria-label={
                    label === "✓"
                      ? es
                        ? "Comprobar"
                        : "Check"
                      : label === "⌫"
                        ? es
                          ? "Borrar dígito"
                          : "Delete digit"
                        : label
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <p role="status" className="kids-note">
              {wrong ? (es ? "Probá otra vez." : "Try again.") : ""}
            </p>
            <button type="button" className="kids-button" onClick={onCancel}>
              {es ? "Cancelar" : "Cancel"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
