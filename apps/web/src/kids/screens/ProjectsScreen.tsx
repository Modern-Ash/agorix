import { useState, type ChangeEvent } from "react";
import { KIDS_MISSION_IDS, getKidsMission } from "@agorix/curriculum";
import { ProjectStore, sanitizeAgorixFilename } from "@agorix/persistence";
import type { Locale } from "../../i18n.js";
import { exportKidsProject, importKidsProject, listFreeProjects } from "../kidsProjects.js";
import { KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "../kidsState.js";
import { kidsTable, type KidsText } from "../useKidsText.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly avatar: KidsAvatar;
  readonly world: KidsWorld;
  readonly onCreate: () => void;
  readonly onMission: (world: KidsWorld, index: 0 | 1 | 2) => void;
  readonly onFree: (id: string, world: KidsWorld, avatar: KidsAvatar) => void;
}

export function ProjectsScreen({ t, locale, avatar, world, onCreate, onMission, onFree }: Props) {
  const [store] = useState(() => new ProjectStore());
  const [free, setFree] = useState(() => listFreeProjects());
  const [message, setMessage] = useState("");
  const worlds = kidsTable(locale, "worlds");
  const missions = KIDS_WORLDS.flatMap((candidate) =>
    KIDS_MISSION_IDS.map((id, index) => ({
      id: `kids.${candidate}.${id}`,
      world: candidate,
      index: index as 0 | 1 | 2,
    })),
  ).filter((project) => store.has(project.id));

  function download(id: string, name: string) {
    try {
      const blob = new Blob([exportKidsProject(store, id)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; // agora-allowlist: local Blob download from validated .agorix serializer, not outbound navigation
      anchor.download = sanitizeAgorixFilename(name);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(t("saved"));
    } catch {
      setMessage(locale === "es" ? "No se pudo exportar." : "Could not export.");
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const source = await file.text();
      const project = importKidsProject(source, world, avatar, store);
      setFree(listFreeProjects());
      setMessage(t("saved"));
      onFree(project.id, project.world, project.avatar);
    } catch {
      setMessage(
        locale === "es" ? "Este archivo no se pudo abrir." : "This file could not be opened.",
      );
    }
    event.target.value = "";
  }

  return (
    <section className="kids-screen kids-projects" aria-labelledby="kids-projects-title">
      <div className="kids-projects-header">
        <h1 id="kids-projects-title">{t("projects")}</h1>
        <button type="button" className="kids-button kids-primary" onClick={onCreate}>
          + {t("newProject")}
        </button>
      </div>
      <label className="kids-import-label kids-button">
        {locale === "es" ? "Importar .agorix" : "Import .agorix"}
        <input
          type="file"
          accept=".agorix,application/json"
          onChange={(event) => void importFile(event)}
        />
      </label>
      <p role="status" className="kids-note">
        {message}
      </p>
      <div className="kids-project-grid">
        {missions.map((project) => (
          <article className="kids-project-card" key={project.id}>
            <div
              className="kids-project-thumb"
              style={{ background: KIDS_WORLD_STYLES[project.world].bg }}
              aria-hidden="true"
            >
              {KIDS_WORLD_STYLES[project.world].character} →{" "}
              {KIDS_WORLD_STYLES[project.world].goalGlyph}
            </div>
            <h2>
              {worlds[project.world]} ·{" "}
              {getKidsMission(KIDS_MISSION_IDS[project.index], locale).title}
            </h2>
            <p>{t("saved")}</p>
            <div>
              <button
                type="button"
                className="kids-button"
                onClick={() => onMission(project.world, project.index)}
              >
                {t("play")}
              </button>
              <button
                type="button"
                className="kids-button"
                onClick={() => download(project.id, project.id)}
              >
                {locale === "es" ? "Exportar" : "Export"}
              </button>
            </div>
          </article>
        ))}
        {free.map((project) => (
          <article className="kids-project-card" key={project.id}>
            <div
              className="kids-project-thumb"
              style={{ background: KIDS_WORLD_STYLES[project.world].bg }}
              aria-hidden="true"
            >
              {project.avatar} → {KIDS_WORLD_STYLES[project.world].goalGlyph}
            </div>
            <h2>
              {worlds[project.world]} · {project.id.replace("free-", "#")}
            </h2>
            <p>{store.has(project.id) ? t("saved") : t("newProject")}</p>
            <div>
              <button
                type="button"
                className="kids-button"
                onClick={() => onFree(project.id, project.world, project.avatar)}
              >
                {t("play")}
              </button>
              <button
                type="button"
                className="kids-button"
                disabled={!store.has(project.id)}
                onClick={() => download(project.id, project.id)}
              >
                {locale === "es" ? "Exportar" : "Export"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
