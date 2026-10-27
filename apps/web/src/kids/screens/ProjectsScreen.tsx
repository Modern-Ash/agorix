import { useKidsCatalog } from "../kidsCatalog.js";
import { useEffect, useState, type ChangeEvent } from "react";
import { KIDS_MISSION_IDS, getKidsMission } from "@agorix/curriculum";
import { ProjectStore, sanitizeAgorixFilename } from "@agorix/persistence";
import type { Locale } from "../../i18n.js";
import {
  deleteFreeProject,
  exportKidsProject,
  importKidsProject,
  listFreeProjects,
  listFreeProjectRefs,
  restoreFreeProject,
  type RemovedFreeProject,
} from "../kidsProjects.js";
import { KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "../kidsState.js";
import { kidsTable, type KidsText } from "../useKidsText.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";
import { DeleteProjectDialog } from "./DeleteProjectDialog.js";
import { ExportMediaDialog } from "./ExportMediaDialog.js";
import { KidsBackdrop, KidsSprite, builtinWorld, emojiSlot } from "./KidsArt.js";
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
  readonly avatar: KidsAvatar;
  readonly world: KidsWorld;
  readonly readAloud?: boolean;
  readonly onCreate: () => void;
  readonly onMission: (world: KidsWorld, index: 0 | 1 | 2) => void;
  readonly onFree: (id: string, world: KidsWorld, avatar: KidsAvatar) => void;
  readonly onStudio: (id: string) => void;
}

export function ProjectsScreen({
  t,
  locale,
  avatar,
  world,
  readAloud = true,
  onCreate,
  onMission,
  onFree,
  onStudio,
}: Props) {
  const [store] = useState(() => new ProjectStore());
  const [free, setFree] = useState(() => listFreeProjects());
  const [studios, setStudios] = useState(() => listStudioProjects());
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exportingMedia, setExportingMedia] = useState<string | null>(null);
  const [undo, setUndo] = useState<RemovedFreeProject | null>(null);

  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => setUndo(null), 10_000);
    return () => window.clearTimeout(id);
  }, [undo]);

  function confirmDelete() {
    const id = deleting;
    setDeleting(null);
    if (!id) return;
    if (studios.some((item) => item.id === id)) {
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
      return;
    }
    const removed = deleteFreeProject(id, store);
    setFree(listFreeProjects());
    if (removed) {
      setUndo(removed);
      setMessage("");
    } else {
      setMessage(locale === "es" ? "No se pudo borrar." : "Could not delete.");
    }
  }

  function undoDelete() {
    if (undo && restoreFreeProject(undo, store)) setFree(listFreeProjects());
    setUndo(null);
  }
  const catalog = useKidsCatalog();
  const worlds = kidsTable(locale, "worlds");
  const refs = listFreeProjectRefs();
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
      const source = await file.text();
      let sceneId: string | null = null;
      try {
        const scene = importStudioProject(source, locale, store);
        setStudios(listStudioProjects());
        setMessage(t("saved"));
        sceneId = scene.id;
      } catch {
        // Other .agorix projects use the existing Kids importer.
      }
      if (sceneId) onStudio(sceneId);
      else {
        const project = importKidsProject(source, world, avatar, store);
        setFree(listFreeProjects());
        setMessage(t("saved"));
        onFree(project.id, project.world, project.avatar);
      }
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
        {undo ? (locale === "es" ? "Proyecto borrado." : "Project deleted.") : message}
        {undo ? (
          <>
            {" "}
            <button type="button" className="kids-button" onClick={undoDelete}>
              {locale === "es" ? "Deshacer" : "Undo"}
            </button>
          </>
        ) : null}
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
              {locale === "es" ? "Escena libre" : "Free scene"} ·{" "}
              {project.id.replace("studio-", "#")}
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
        {missions.map((project) => (
          <article className="kids-project-card" key={project.id}>
            <KidsBackdrop world={builtinWorld(project.world)} className="kids-project-thumb">
              {KIDS_WORLD_STYLES[project.world].character} →{" "}
              {KIDS_WORLD_STYLES[project.world].goalGlyph}
            </KidsBackdrop>
            <h2>
              {worlds[project.world]} ·{" "}
              {
                getKidsMission(KIDS_MISSION_IDS[project.index], locale, project.world, catalog)
                  .title
              }
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
            <KidsBackdrop
              world={
                refs.find((entry) => entry.id === project.id)?.world ?? builtinWorld(project.world)
              }
              className="kids-project-thumb"
            >
              <KidsSprite
                slot={
                  refs.find((entry) => entry.id === project.id)?.avatar ?? emojiSlot(project.avatar)
                }
                label={
                  refs.find((entry) => entry.id === project.id)?.avatar.kind === "custom"
                    ? t("customExplorer")
                    : undefined
                }
              />{" "}
              → {KIDS_WORLD_STYLES[project.world].goalGlyph}
            </KidsBackdrop>
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
