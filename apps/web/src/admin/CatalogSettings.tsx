import { useState } from "react";
import {
  defaultKidsCatalog,
  KIDS_CATALOG_STORY_MAX,
  KIDS_CATALOG_TITLE_MAX,
  KIDS_GRID,
  KIDS_MISSION_WORLDS,
  unsolvableKidsMissions,
  type KidsCatalog,
  type KidsCatalogEntry,
  type KidsMissionWorld,
} from "@agorix/curriculum";

const WORLD_NAMES: Record<KidsMissionWorld, string> = {
  space: "Espacio",
  ocean: "Océano",
  robots: "Robots",
  city: "Ciudad",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

/**
 * The missions as data (issue #616): where each starts and ends, and its words. Hints are counted
 * from the layout, so nothing here can make them disagree. The server refuses to publish a mission
 * the runtime cannot win; this panel shows it first.
 */
export function CatalogSettings({
  catalog,
  onChange,
}: {
  readonly catalog: KidsCatalog;
  readonly onChange: (next: KidsCatalog) => void;
}) {
  const [world, setWorld] = useState<KidsMissionWorld>("space");
  const unsolvable = unsolvableKidsMissions(catalog);
  const set = (slot: number, change: Partial<KidsCatalogEntry>) => {
    const entries = catalog[world].map((entry, index) =>
      index === slot ? { ...entry, ...change } : entry,
    ) as unknown as KidsCatalog[KidsMissionWorld];
    onChange({ ...catalog, [world]: entries });
  };
  const cell = (
    slot: number,
    which: "start" | "goal",
    axis: "cx" | "cy",
    label: string,
    entry: KidsCatalogEntry,
  ) => {
    // A start in the last column would leave no room for a goal to its right.
    const max = axis === "cx" ? KIDS_GRID.cols - (which === "start" ? 2 : 1) : KIDS_GRID.rows - 1;
    return (
      <label key={`${which}${axis}`}>
        {label}
        <input
          type="number"
          min={0}
          max={max}
          step={1}
          value={entry[which][axis]}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            const changed = { ...entry[which], [axis]: clamp(next, 0, max) };
            // The goal always stays to the right of the start, so the missions stay winnable.
            if (which === "start" && axis === "cx" && changed.cx >= entry.goal.cx) {
              set(slot, {
                start: changed,
                goal: { ...entry.goal, cx: Math.min(KIDS_GRID.cols - 1, changed.cx + 1) },
              });
            } else if (which === "goal" && axis === "cx" && changed.cx <= entry.start.cx) {
              set(slot, { goal: { ...entry.goal, cx: entry.start.cx + 1 } });
            } else set(slot, { [which]: changed });
          }}
        />
      </label>
    );
  };
  return (
    <div className="ai-admin-card">
      <p className="ai-admin-note">
        Las misiones de cada mundo. Las pistas se calculan solas desde el recorrido, así que no
        pueden contradecirlo. Una misión que el runtime no pueda ganar no se publica. Un proyecto
        guardado se abre igual y se evalúa contra el recorrido nuevo.
      </p>
      <div role="group" aria-label="Mundos">
        {KIDS_MISSION_WORLDS.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={world === name}
            className={world === name ? "selected" : ""}
            onClick={() => setWorld(name)}
          >
            {WORLD_NAMES[name]}
          </button>
        ))}
      </div>
      {catalog[world].map((entry, slot) => (
        <fieldset key={slot}>
          <legend>
            {WORLD_NAMES[world]} · misión {slot + 1}
          </legend>
          {unsolvable.includes(`${world}:${slot}`) ? (
            <p role="alert">Esta misión no se puede resolver: no se va a publicar.</p>
          ) : null}
          {cell(slot, "start", "cx", "Sale de la columna", entry)}
          {cell(slot, "start", "cy", "Sale de la fila", entry)}
          {cell(slot, "goal", "cx", "Meta en la columna", entry)}
          {cell(slot, "goal", "cy", "Meta en la fila", entry)}
          {(["es", "en"] as const).map((locale) => (
            <div key={locale}>
              <label>
                Título ({locale === "es" ? "español" : "inglés"})
                <input
                  type="text"
                  maxLength={KIDS_CATALOG_TITLE_MAX}
                  value={entry.title[locale]}
                  onChange={(event) =>
                    set(slot, { title: { ...entry.title, [locale]: event.target.value } })
                  }
                />
              </label>
              <label>
                Relato ({locale === "es" ? "español" : "inglés"})
                <input
                  type="text"
                  maxLength={KIDS_CATALOG_STORY_MAX}
                  value={entry.story[locale]}
                  onChange={(event) =>
                    set(slot, { story: { ...entry.story, [locale]: event.target.value } })
                  }
                />
              </label>
            </div>
          ))}
        </fieldset>
      ))}
      <button type="button" onClick={() => onChange(defaultKidsCatalog())}>
        Volver a las misiones originales
      </button>
      <p className="ai-admin-footnote">
        Títulos y relatos: letras, números y signos comunes, sin enlaces ni marcas. Los textos que
        escribas los ven los chicos.
      </p>
    </div>
  );
}
