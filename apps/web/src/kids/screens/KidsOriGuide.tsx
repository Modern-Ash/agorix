import { useRef, useState } from "react";
import type { Locale } from "../../i18n.js";
import type { KidsScreen } from "../kidsState.js";
import { KidsSprite } from "./KidsArt.js";

const GUIDANCE: Record<KidsScreen, { es: string; en: string }> = {
  onboard: {
    es: "Elegí cómo querés explorar. Podemos pensar juntos cuando empieces a crear.",
    en: "Choose how you want to explore. We can think together when you start creating.",
  },
  map: {
    es: "Elegí una misión. Antes de jugar, imaginá qué harán tus bloques.",
    en: "Choose a mission. Before playing, imagine what your blocks will do.",
  },
  create: {
    es: "Elegí un explorador y un mundo. ¿Qué te gustaría que pase ahí?",
    en: "Choose an explorer and a world. What would you like to happen there?",
  },
  studio: {
    es: "Cada personaje tiene su programa. Elegí uno, probá sus bloques y revisá mis ideas.",
    en: "Each character has a program. Choose one, try its blocks, and review my ideas.",
  },
  editor: {
    es: "Contame qué querés crear. Revisá mis ideas antes de usarlas.",
    en: "Tell me what you want to create. Review my ideas before using them.",
  },
  advanced: {
    es: "Cada personaje tiene sus propios bloques. Probá una idea y mirá qué cambia.",
    en: "Each character has its own blocks. Try an idea and see what changes.",
  },
  advancedReact: {
    es: "¿Qué evento inicia cada acción? Podés pedirme una idea en esta etapa.",
    en: "Which event starts each action? You can ask me for an idea in this stage.",
  },
  advancedScore: {
    es: "Antes de jugar, imaginá cómo cambiará el puntaje.",
    en: "Before playing, imagine how the score will change.",
  },
  advancedControl: {
    es: "Probá una condición y compará tu predicción con el resultado.",
    en: "Try a condition and compare your prediction with the result.",
  },
  advancedMessage: {
    es: "Un mensaje puede iniciar los bloques de otro personaje. Mirá la ejecución paso a paso.",
    en: "A message can start another character's blocks. Watch the run step by step.",
  },
  reflect: {
    es: "¿Qué bloque hizo que ocurriera eso? Tu explicación importa.",
    en: "Which block made that happen? Your explanation matters.",
  },
  projects: {
    es: "Podés abrir un proyecto y seguir probando ideas.",
    en: "You can open a project and keep trying ideas.",
  },
  parents: {
    es: "Acá una persona adulta puede elegir los ajustes de tu experiencia.",
    en: "An adult can choose your experience settings here.",
  },
};

export function KidsOriGuide({
  screen,
  locale,
  aboveNav,
}: {
  readonly screen: KidsScreen;
  readonly locale: Locale;
  readonly aboveNav: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <div className={`kids-ori-guide-zone${aboveNav ? " kids-ori-guide-above-nav" : ""}`}>
      <button
        type="button"
        ref={trigger}
        className="kids-ori-float-trigger"
        aria-label={locale === "es" ? "Hablar con Ori" : "Talk with Ori"}
        onClick={() => setOpen(true)}
      >
        <KidsSprite slot="ori" />
        <span>Ori</span>
      </button>
      {open ? (
        <div className="kids-ori-float-backdrop" role="presentation" onClick={close}>
          <div
            className="kids-ori-float-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={locale === "es" ? "Ori te acompaña" : "Ori is with you"}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
            }}
          >
            <button
              type="button"
              className="kids-button kids-ori-float-close"
              autoFocus
              onClick={close}
            >
              {locale === "es" ? "Cerrar" : "Close"}
            </button>
            <p className="kids-ori-guide-message">{GUIDANCE[screen][locale]}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
