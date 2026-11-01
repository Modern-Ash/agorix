import { useState } from "react";
import type { KidsSoundCategory } from "../kidsSoundCatalog.js";
import { KIDS_SOUNDS, searchKidsSounds, type KidsSoundId } from "../kidsSoundLibrary.js";

export const SOUND_CATEGORIES = [
  "all",
  "effects",
  "music",
  "nature",
  "animals",
  "vehicles",
  "magic",
  "interface",
  "actions",
] as const;

export const SOUND_CATEGORY_NAMES: Record<
  (typeof SOUND_CATEGORIES)[number],
  { es: string; en: string }
> = {
  all: { es: "Todos", en: "All" },
  effects: { es: "Efectos", en: "Effects" },
  music: { es: "Música", en: "Music" },
  nature: { es: "Naturaleza", en: "Nature" },
  animals: { es: "Animales", en: "Animals" },
  vehicles: { es: "Vehículos", en: "Vehicles" },
  magic: { es: "Magia", en: "Magic" },
  interface: { es: "Avisos", en: "Alerts" },
  actions: { es: "Acciones", en: "Actions" },
};

/**
 * Sound chooser for the Escena libre palette (#1110): categories, search and a list of the
 * bundled sounds. Choosing one plays it so the child hears before adding the block; the block
 * itself is added by the "Sonar" button beside it.
 */
export function KidsSoundPicker({
  locale,
  value,
  onChoose,
}: {
  readonly locale: "es" | "en";
  readonly value: KidsSoundId;
  readonly onChoose: (id: KidsSoundId) => void;
}) {
  const [category, setCategory] = useState<"all" | KidsSoundCategory>("all");
  const [query, setQuery] = useState("");
  const shown = searchKidsSounds(query).filter(
    (item) => category === "all" || item.category === category,
  );
  const selected = KIDS_SOUNDS.find((item) => item.id === value);
  return (
    <div
      className="kids-sound-picker"
      role="group"
      aria-label={locale === "es" ? "Sonidos" : "Sounds"}
    >
      <p className="kids-note" aria-live="polite" data-testid="sound-picker-selected">
        {locale === "es" ? "Elegido" : "Chosen"}: {selected?.[locale] ?? ""} · {KIDS_SOUNDS.length}{" "}
        {locale === "es" ? "sonidos" : "sounds"}
      </p>
      <div
        className="kids-sound-picker-filters"
        role="group"
        aria-label={locale === "es" ? "Categorías de sonidos" : "Sound categories"}
      >
        {SOUND_CATEGORIES.map((name) => (
          <button
            key={name}
            type="button"
            className="kids-button"
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {SOUND_CATEGORY_NAMES[name][locale]}
          </button>
        ))}
      </div>
      <input
        type="search"
        className="kids-gallery-search"
        value={query}
        maxLength={30}
        aria-label={locale === "es" ? "Buscar sonido" : "Search sound"}
        placeholder={locale === "es" ? "Buscar sonido" : "Search sound"}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className="kids-sound-picker-list">
        {shown.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="kids-button"
              aria-pressed={item.id === value}
              aria-label={`${locale === "es" ? "Elegir y escuchar" : "Choose and listen"} ${item[locale]}`}
              onClick={() => onChoose(item.id)}
            >
              {item[locale]}
            </button>
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="kids-note">
            {locale === "es" ? "No hay sonidos así." : "No sounds like that."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
