import { useState, type ChangeEvent } from "react";
import { KIDS_MISSION_IDS, getKidsMission } from "@agorix/curriculum";
import { ProjectStore, sanitizeAgorixFilename } from "@agorix/persistence";
import type { Locale } from "../../i18n.js";
import { missionOfStudio } from "../kidsMissionStudio.js";
import type { KidsText } from "../useKidsText.js";
import { DeleteProjectDialog } from "./DeleteProjectDialog.js";
import { convertScratchProject, type ScratchImportReport } from "../kidsScratchImport.js";
import {
  cutKindOf,
  cutSentence,
  forgetImportCuts,
  intentsForCuts,
  saveImportCuts,
  type CutKind,
} from "../kidsImportCuts.js";
import { readScratchProject } from "../kidsScratchZip.js";
import { ExportMediaDialog } from "./ExportMediaDialog.js";
import { KidsBackdrop } from "./KidsArt.js";
import { ListenButton } from "./ListenButton.js";
import {
  deleteStudioProject,
  exportScratchStudioProject,
  exportStudioProject,
  importScratchStudioProject,
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

/** The cuts of an import grouped by kind, most frequent first. */
function cutSummary(
  report: ScratchImportReport,
): readonly { readonly kind: CutKind; readonly count: number }[] {
  const totals = new Map<CutKind, number>();
  for (const item of report.dropped) {
    const kind = cutKindOf(item.what);
    totals.set(kind, (totals.get(kind) ?? 0) + item.count);
  }
  return [...totals.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);
}

export function ProjectsScreen({ t, locale, readAloud = true, onCreate, onStudio }: Props) {
  const [store] = useState(() => new ProjectStore());
  const [studios, setStudios] = useState(() => listStudioProjects());
  const [message, setMessage] = useState("");
  const [scratchImport, setScratchImport] = useState<{
    readonly id: string;
    readonly report: ScratchImportReport;
  } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exportingMedia, setExportingMedia] = useState<string | null>(null);
  function confirmDelete() {
    const id = deleting;
    setDeleting(null);
    if (!id) return;
    const removed = deleteStudioProject(id, store);
    if (removed) forgetImportCuts(id);
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

  async function downloadScratch(id: string) {
    try {
      const exported = await exportScratchStudioProject(id, locale, store);
      const blob = new Blob([exported.bytes as BlobPart], { type: "application/x.scratch.sb3" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; // agora-allowlist: local Blob download of a .sb3 built on this device, not outbound navigation
      anchor.download = `${id}.sb3`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      const left = exported.report.left.reduce((sum, item) => sum + item.count, 0);
      setMessage(
        locale === "es"
          ? `Exporté ${exported.report.blocksExported} bloque(s) a Scratch.${left > 0 ? ` No pude escribir ${left} (los sonidos de la escena, las preguntas y los bloques propios todavía no).` : ""}`
          : `Exported ${exported.report.blocksExported} block(s) to Scratch.${left > 0 ? ` I could not write ${left} (the scene's built-in sounds, questions and own blocks are not there yet).` : ""}`,
      );
    } catch {
      setMessage(
        locale === "es" ? "No se pudo exportar a Scratch." : "Could not export to Scratch.",
      );
    }
  }

  async function importScratch(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const converted = convertScratchProject(await readScratchProject(await file.arrayBuffer()));
      const scene = importScratchStudioProject(converted, locale, store);
      setStudios(listStudioProjects());
      saveImportCuts(
        scene.id,
        converted.report.dropped.map((item) => cutKindOf(item.what)),
      );
      setScratchImport({ id: scene.id, report: converted.report });
      setMessage("");
    } catch {
      setScratchImport(null);
      setMessage(
        locale === "es"
          ? "Este proyecto de Scratch no se pudo importar."
          : "This Scratch project could not be imported.",
      );
    }
    event.target.value = "";
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
      <label className="kids-import-label kids-button">
        {locale === "es" ? "Importar de Scratch (.sb3)" : "Import from Scratch (.sb3)"}
        <input
          type="file"
          accept=".sb3,application/zip,application/json"
          onChange={(event) => void importScratch(event)}
        />
      </label>
      <p role="status" className="kids-note">
        {message}
      </p>
      {scratchImport ? (
        <section className="kids-scratch-report" aria-label="Scratch">
          <p>
            {locale === "es"
              ? `Traje ${scratchImport.report.sprites} objeto(s) y ${scratchImport.report.blocksImported} bloque(s) de Scratch; ${scratchImport.report.blocksAdjusted} se ajustaron a lo que permite la escena.`
              : `Brought ${scratchImport.report.sprites} sprite(s) and ${scratchImport.report.blocksImported} block(s) from Scratch; ${scratchImport.report.blocksAdjusted} were adjusted to what the scene allows.`}
          </p>
          {scratchImport.report.dropped.length > 0 ? (
            <>
              <section aria-label={locale === "es" ? "Ori explica" : "Ori explains"}>
                <h3>{locale === "es" ? "Ori te cuenta por qué" : "Ori tells you why"}</h3>
                <ul data-testid="cut-explanations">
                  {cutSummary(scratchImport.report).map((item) => (
                    <li key={item.kind}>
                      {cutSentence(item.kind, locale)} ({item.count})
                    </li>
                  ))}
                </ul>
                {intentsForCuts(cutSummary(scratchImport.report).map((item) => item.kind)).length >
                0 ? (
                  <p className="kids-note" data-testid="cut-ideas-note">
                    {locale === "es"
                      ? "Al abrir la escena, Ori te mostrará esas ideas antes de usarlas: vos decidís."
                      : "When you open the scene, Ori will show you those ideas before using them: you decide."}
                  </p>
                ) : null}
              </section>
              <details>
                <summary>
                  {locale === "es" ? "Lo que no pude traer" : "What I could not bring"}
                </summary>
                <ul>
                  {scratchImport.report.dropped.map((item) => (
                    <li key={item.what}>
                      {item.what} × {item.count}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : null}
          <button
            type="button"
            className="kids-button kids-primary"
            onClick={() => onStudio(scratchImport.id)}
          >
            {locale === "es" ? "Abrir la escena" : "Open the scene"}
          </button>
        </section>
      ) : null}
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
              <button
                type="button"
                className="kids-button"
                data-testid="export-scratch"
                onClick={() => void downloadScratch(project.id)}
              >
                {locale === "es" ? "Exportar a Scratch" : "Export to Scratch"}
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
