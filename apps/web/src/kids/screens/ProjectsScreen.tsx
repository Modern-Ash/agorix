import { useState, type ChangeEvent } from "react";
import { KIDS_MISSION_IDS, getKidsMission } from "@agorix/curriculum";
import { ProjectStore, sanitizeAgorixFilename } from "@agorix/persistence";
import type { Locale } from "../../i18n.js";
import { missionOfStudio } from "../kidsMissionStudio.js";
import type { KidsText } from "../useKidsText.js";
import { DeleteProjectDialog } from "./DeleteProjectDialog.js";
import { ExportMediaDialog } from "./ExportMediaDialog.js";
import { KidsBackdrop } from "./KidsArt.js";
import { ListenButton } from "./ListenButton.js";
import {
  deleteStudioProject,
  exportStudioProject,
  importStudioProject,
  listStudioProjects,
} from "../kidsStudioProjects.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly readAloud?: boolean;
  readonly onCreate: () => void;
  readonly onStudio: (id: string) => void;
}

export function ProjectsScreen({ t, locale, readAloud = true, onCreate, onStudio }: Props) {
  const [store] = useState(() => new ProjectStore());
  const [studios, setStudios] = useState(() => listStudioProjects());
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exportingMedia, setExportingMedia] = useState<string | null>(null);
  function confirmDelete() {
    const id = deleting;
    setDeleting(null);
    if (!id) return;
    const removed = deleteStudioProject(id, store);
    setStudios(listStudioProjects());
    setMessage(
      removed
        ? locale === "es"
          ? "Escena borrada."
          : "Scene deleted."
        : locale === "es"
          ? "No se pudo borrar."
          : "Could not delete.",
    );
  }

  function downloadStudio(id: string, includeMedia: boolean) {
    try {
      const blob = new Blob([exportStudioProject(id, store, includeMedia)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; // agora-allowlist: local Blob download from validated .agorix serializer, not outbound navigation
      anchor.download = sanitizeAgorixFilename(id);
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
      const scene = importStudioProject(await file.text(), locale, store);
      setStudios(listStudioProjects());
      setMessage(t("saved"));
      onStudio(scene.id);
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
        <ListenButton
          t={t}
          locale={locale}
          enabled={readAloud}
          text={`${t("projects")}. ${t("newProject")}`}
        />
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
      {deleting ? (
        <DeleteProjectDialog
          locale={locale}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
      {exportingMedia ? (
        <ExportMediaDialog
          locale={locale}
          onConfirm={() => {
            downloadStudio(exportingMedia, true);
            setExportingMedia(null);
          }}
          onCancel={() => setExportingMedia(null)}
        />
      ) : null}
      <div className="kids-project-grid">
        {studios.map((project) => (
          <article className="kids-project-card" key={project.id}>
            <KidsBackdrop
              world={{ kind: "gallery", id: project.backdropId }}
              className="kids-project-thumb"
            />
            <h2>
              {(() => {
                const mission = missionOfStudio(project.id);
                return mission
                  ? `${locale === "es" ? "Misión" : "Mission"} ${mission.index + 1}: ${getKidsMission(KIDS_MISSION_IDS[mission.index], locale, mission.world).title}`
                  : `${locale === "es" ? "Escena libre" : "Free scene"} · ${project.id.replace("studio-", "#")}`;
              })()}
            </h2>
            <p>{t("saved")}</p>
            <div>
              <button type="button" className="kids-button" onClick={() => onStudio(project.id)}>
                {t("play")}
              </button>
              <button
                type="button"
                className="kids-button"
                onClick={() => {
                  if (
                    store
                      .load(project.id)
                      .metadata.assets?.some((asset) => asset.source.startsWith("data:"))
                  )
                    setExportingMedia(project.id);
                  else downloadStudio(project.id, false);
                }}
              >
                {locale === "es" ? "Exportar" : "Export"}
              </button>
              <button type="button" className="kids-button" onClick={() => setDeleting(project.id)}>
                {locale === "es" ? "Borrar" : "Delete"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
