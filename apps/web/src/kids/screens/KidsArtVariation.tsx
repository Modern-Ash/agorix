import { useState } from "react";
import type { Locale } from "../../i18n.js";
import {
  ART_VARIATIONS,
  ART_VARIATION_TEXT,
  varyArt,
  type ArtVariation,
} from "../kidsArtVariations.js";

const COPY = {
  es: {
    title: "Ideas de Ori para",
    intro: "Elegí una idea y mirá cómo queda al lado de tu dibujo. Vos decidís si la usás.",
    now: "Tu dibujo",
    idea: "Con la idea de Ori",
    use: "Usar esta idea",
    reject: "No usar",
    cannot: "Esta idea no se pudo hacer con este dibujo.",
    working: "Ori está preparando la idea...",
    close: "Cerrar las ideas",
    tipIdea: "Ver cómo quedaría tu dibujo con esta idea, sin cambiar nada todavía",
    tipUse: "Cambiar tu dibujo por la versión de Ori; se puede deshacer",
    tipReject: "Dejar tu dibujo como está",
    tipClose: "Cerrar las ideas de Ori para este dibujo",
  },
  en: {
    title: "Ori's ideas for",
    intro: "Pick an idea and see it beside your drawing. You decide whether to use it.",
    now: "Your drawing",
    idea: "With Ori's idea",
    use: "Use this idea",
    reject: "Don't use it",
    cannot: "This idea could not be made with this drawing.",
    working: "Ori is getting the idea ready...",
    close: "Close the ideas",
    tipIdea: "See how your drawing would look with this idea, without changing anything yet",
    tipUse: "Replace your drawing with Ori's version; it can be undone",
    tipReject: "Keep your drawing as it is",
    tipClose: "Close Ori's ideas for this drawing",
  },
} as const;

/**
 * Ori's ideas for one of the child's own pictures (issue #1308): a closed list of changes, each
 * shown beside the picture it comes from. Nothing changes until the child presses "use".
 */
export function KidsArtVariation({
  source,
  name,
  locale,
  onUse,
  onClose,
}: {
  readonly source: string;
  readonly name: string;
  readonly locale: Locale;
  readonly onUse: (dataUrl: string) => void;
  readonly onClose: () => void;
}) {
  const text = COPY[locale === "es" ? "es" : "en"];
  const lang = locale === "es" ? "es" : "en";
  const [preview, setPreview] = useState<{ variation: ArtVariation; after: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function pick(variation: ArtVariation) {
    setBusy(true);
    setFailed(false);
    setPreview(null);
    const after = await varyArt(source, variation);
    setBusy(false);
    if (after === null) setFailed(true);
    else setPreview({ variation, after });
  }

  return (
    <section className="kids-art-variation" aria-label={`${text.title} ${name}`}>
      <h3>
        {text.title} {name}
      </h3>
      <p className="kids-note">{text.intro}</p>
      <div role="group" aria-label={text.title}>
        {ART_VARIATIONS.map((variation) => (
          <button
            key={variation}
            type="button"
            className="kids-button"
            title={text.tipIdea}
            disabled={busy}
            aria-pressed={preview?.variation === variation}
            data-testid={`art-variation-${variation}`}
            onClick={() => void pick(variation)}
          >
            {ART_VARIATION_TEXT[variation][lang]}
          </button>
        ))}
      </div>
      {busy ? (
        <p role="status" className="kids-note">
          {text.working}
        </p>
      ) : null}
      {failed ? (
        <p role="status" className="kids-note">
          {text.cannot}
        </p>
      ) : null}
      {preview ? (
        <div className="kids-art-variation-compare" data-testid="art-variation-compare">
          <figure>
            <img src={source} alt={text.now} width={96} height={96} />
            <figcaption>{text.now}</figcaption>
          </figure>
          <figure>
            <img
              src={preview.after}
              alt={`${text.idea}: ${ART_VARIATION_TEXT[preview.variation][lang]}`}
              width={96}
              height={96}
              data-testid="art-variation-after"
            />
            <figcaption>{text.idea}</figcaption>
          </figure>
          <div>
            <button
              type="button"
              className="kids-button kids-primary"
              title={text.tipUse}
              data-testid="art-variation-use"
              onClick={() => {
                onUse(preview.after);
                setPreview(null);
              }}
            >
              {text.use}
            </button>
            <button
              type="button"
              className="kids-button"
              title={text.tipReject}
              onClick={() => setPreview(null)}
            >
              {text.reject}
            </button>
          </div>
        </div>
      ) : null}
      <button type="button" className="kids-button" title={text.tipClose} onClick={onClose}>
        {text.close}
      </button>
    </section>
  );
}
