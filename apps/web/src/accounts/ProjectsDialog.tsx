import { useState, type FormEvent } from "react";
import type { Locale } from "../i18n.js";
import { ta } from "./accountI18n.js";
import type { ProjectSummaryDto } from "./clients.js";
import { Dialog } from "./Dialog.js";
import type { ProjectsState } from "./workspace.js";

export function formatUpdatedAt(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export interface ProjectsDialogProps {
  readonly locale: Locale;
  readonly projects: ProjectsState;
  readonly activeProjectId?: string | undefined;
  readonly onOpen: (projectId: string) => Promise<void>;
  readonly onCreate: () => Promise<void>;
  readonly onRename: (projectId: string, title: string) => Promise<void>;
  readonly onDuplicate: (project: ProjectSummaryDto) => Promise<void>;
  readonly onDelete: (projectId: string) => Promise<void>;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

type Pending =
  | { readonly kind: "rename"; readonly project: ProjectSummaryDto }
  | { readonly kind: "delete"; readonly project: ProjectSummaryDto };

export function ProjectsDialog(props: ProjectsDialogProps) {
  const { locale, projects } = props;
  const [pending, setPending] = useState<Pending | undefined>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(action: () => Promise<void>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setFailed(false);
    try {
      await action();
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog
        title={ta(locale, "projectsTitle")}
        onClose={pending === undefined ? props.onClose : undefined}
        testId="projects-dialog"
      >
        <p className="agx-dialog-copy">{ta(locale, "projectsIntro")}</p>
        <div className="agx-actions">
          <button
            type="button"
            className="agx-primary"
            disabled={busy}
            onClick={() => void run(props.onCreate)}
          >
            {ta(locale, "newProject")}
          </button>
          <button type="button" onClick={props.onClose}>
            {ta(locale, "close")}
          </button>
        </div>
        <div role="alert" className="agx-error">
          {failed ? ta(locale, "actionFailed") : null}
        </div>
        {projects.status === "loading" && projects.items.length === 0 ? (
          <p role="status" data-testid="projects-loading">
            {ta(locale, "projectsLoading")}
          </p>
        ) : null}
        {projects.status === "error" ? (
          <div role="alert" className="agx-error" data-testid="projects-error">
            <p>
              {ta(
                locale,
                projects.error === "transient" ? "projectsErrorTransient" : "projectsErrorOther",
              )}
            </p>
            <button type="button" onClick={props.onRetry}>
              {ta(locale, "retry")}
            </button>
          </div>
        ) : null}
        {projects.status === "ready" && projects.items.length === 0 ? (
          <div className="agx-empty" data-testid="projects-empty">
            <h3>{ta(locale, "projectsEmptyTitle")}</h3>
            <p>{ta(locale, "projectsEmptyBody")}</p>
          </div>
        ) : null}
        {projects.items.length > 0 ? (
          <ul className="agx-project-list" aria-label={ta(locale, "projectsTitle")}>
            {projects.items.map((project) => {
              const isActive = project.projectId === props.activeProjectId;
              const label = (action: Parameters<typeof ta>[1]) =>
                ta(locale, "actionOn", { action: ta(locale, action), title: project.title });
              return (
                <li key={project.projectId} className="agx-project-card" data-testid="project-card">
                  <div className="agx-project-meta">
                    <h3 className="agx-project-title">{project.title}</h3>
                    <p className="agx-hint">
                      {ta(locale, "updatedAt", {
                        when: formatUpdatedAt(project.updatedAt, locale),
                      })}
                      {isActive ? ` · ${ta(locale, "openProjectActive")}` : ""}
                    </p>
                  </div>
                  <div className="agx-card-actions">
                    <button
                      type="button"
                      className="agx-primary"
                      aria-label={label("openProject")}
                      disabled={busy}
                      onClick={() => void run(() => props.onOpen(project.projectId))}
                    >
                      {ta(locale, "openProject")}
                    </button>
                    <button
                      type="button"
                      aria-label={label("renameProject")}
                      disabled={busy}
                      onClick={() => setPending({ kind: "rename", project })}
                    >
                      {ta(locale, "renameProject")}
                    </button>
                    <button
                      type="button"
                      aria-label={label("duplicateProject")}
                      disabled={busy}
                      onClick={() => void run(() => props.onDuplicate(project))}
                    >
                      {ta(locale, "duplicateProject")}
                    </button>
                    <button
                      type="button"
                      className="agx-danger"
                      aria-label={label("deleteProject")}
                      disabled={busy}
                      onClick={() => setPending({ kind: "delete", project })}
                    >
                      {ta(locale, "deleteProject")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Dialog>
      {pending?.kind === "rename" ? (
        <RenameDialog
          locale={locale}
          project={pending.project}
          onCancel={() => setPending(undefined)}
          onSave={async (title) => {
            if (await run(() => props.onRename(pending.project.projectId, title))) {
              setPending(undefined);
            }
          }}
        />
      ) : null}
      {pending?.kind === "delete" ? (
        <Dialog
          title={ta(locale, "deleteTitle")}
          role="alertdialog"
          onClose={() => setPending(undefined)}
          testId="delete-dialog"
        >
          <p className="agx-dialog-copy">
            {ta(locale, "deleteBody", { title: pending.project.title })}
          </p>
          <div className="agx-actions">
            <button type="button" data-autofocus="" onClick={() => setPending(undefined)}>
              {ta(locale, "cancel")}
            </button>
            <button
              type="button"
              className="agx-danger"
              disabled={busy}
              onClick={() => {
                void run(() => props.onDelete(pending.project.projectId)).then((ok) => {
                  if (ok) setPending(undefined);
                });
              }}
            >
              {ta(locale, "deleteConfirm")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

function RenameDialog(props: {
  readonly locale: Locale;
  readonly project: ProjectSummaryDto;
  readonly onCancel: () => void;
  readonly onSave: (title: string) => Promise<void>;
}) {
  const { locale } = props;
  const [title, setTitle] = useState(props.project.title);
  const trimmed = title.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 120;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) void props.onSave(trimmed);
  }

  return (
    <Dialog title={ta(locale, "renameTitle")} onClose={props.onCancel} testId="rename-dialog">
      <form className="agx-form" onSubmit={submit}>
        <label className="agx-field">
          <span>{ta(locale, "renameLabel")}</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.currentTarget.value)}
            autoComplete="off"
            data-autofocus=""
          />
        </label>
        <div role="alert" className="agx-error">
          {valid ? null : ta(locale, "errTitle")}
        </div>
        <div className="agx-actions">
          <button type="submit" className="agx-primary" disabled={!valid}>
            {ta(locale, "renameSave")}
          </button>
          <button type="button" onClick={props.onCancel}>
            {ta(locale, "cancel")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
