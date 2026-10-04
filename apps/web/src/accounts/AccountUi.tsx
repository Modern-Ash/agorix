import { useEffect, useState, useSyncExternalStore } from "react";
import type { StoredProject } from "@agorix/persistence";
import type { Locale } from "../i18n.js";
import { ta } from "./accountI18n.js";
import { AuthDialog, type AuthMode } from "./AuthDialog.js";
import type { ProjectDto } from "./clients.js";
import { ConflictDialog } from "./ConflictDialog.js";
import { ImportOfferDialog } from "./ImportOfferDialog.js";
import { ProjectsDialog } from "./ProjectsDialog.js";
import { SaveBadge } from "./SaveBadge.js";
import type { WorkspaceController } from "./workspace.js";

export function useWorkspace(controller: WorkspaceController) {
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}

export interface AccountUiProps {
  readonly controller: WorkspaceController;
  readonly locale: Locale;
  readonly createStarterProject: () => StoredProject;
  /** Load a server project into the editor (history is reset by the editor, never persisted). */
  readonly onProjectLoaded: (dto: ProjectDto) => void;
  /** Remove the anonymous local project from this device (explicit learner action only). */
  readonly onRemoveLocalProject: () => void;
}

type DialogState =
  { readonly kind: "auth"; readonly mode: AuthMode } | { readonly kind: "projects" } | undefined;

export function AccountUi(props: AccountUiProps) {
  const { controller, locale } = props;
  const state = useWorkspace(controller);
  const [dialog, setDialog] = useState<DialogState>();
  const [notice, setNotice] = useState<string | undefined>();
  const [projectsAfterImport, setProjectsAfterImport] = useState(false);

  // Leaving the offer (keep/imported/closed) continues to My Projects when sign-in started it.
  useEffect(() => {
    if (projectsAfterImport && state.importOffer.phase === "none") {
      setProjectsAfterImport(false);
      setDialog({ kind: "projects" });
    }
  }, [projectsAfterImport, state.importOffer.phase]);

  if (state.authStatus === "unavailable" || state.authStatus === "checking") return null;

  const authenticated = state.authStatus === "authenticated";
  const expired = state.authStatus === "session-expired";

  async function submitAuth(mode: AuthMode, alias: string, password: string) {
    const reauth = expired;
    if (mode === "register") await controller.register(alias, password);
    else await controller.signIn(alias, password);
    setNotice(undefined);
    if (reauth && controller.getState().active !== undefined) {
      setDialog(undefined);
    } else if (controller.getState().importOffer.phase === "offered") {
      setDialog(undefined);
      setProjectsAfterImport(true);
    } else {
      setDialog({ kind: "projects" });
    }
  }

  async function loadProject(run: () => Promise<{ dto: ProjectDto } | ProjectDto>) {
    const result = await run();
    props.onProjectLoaded("dto" in result ? result.dto : result);
    setDialog(undefined);
  }

  async function openImportedCopy(projectId: string) {
    try {
      await loadProject(() => controller.openProject(projectId));
    } catch {
      // The copy stays in My projects; nothing was removed.
    }
    controller.dismissImportResult();
  }

  const offer = state.importOffer;

  return (
    <>
      <div className="agx-account-bar" role="group" aria-label={ta(locale, "accountMenu")}>
        {authenticated && state.account !== undefined ? (
          <span className="agx-alias" data-testid="account-alias">
            {ta(locale, "signedInAs", { alias: state.account.alias })}
          </span>
        ) : null}
        {authenticated || expired ? (
          <SaveBadge
            locale={locale}
            state={state.saveState}
            deviceDraftOk={state.deviceDraftOk}
            onResolveConflict={() => controller.reopenConflictDialog()}
            onSignIn={() => setDialog({ kind: "auth", mode: "sign-in" })}
          />
        ) : null}
        {authenticated ? (
          <>
            <button
              type="button"
              onClick={() => {
                setDialog({ kind: "projects" });
                void controller.loadProjects();
              }}
            >
              {ta(locale, "myProjects")}
            </button>
            <button
              type="button"
              onClick={() => {
                setDialog(undefined);
                void controller.signOut().then(() => setNotice(ta(locale, "signedOutNotice")));
              }}
            >
              {ta(locale, "signOut")}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setDialog({ kind: "auth", mode: "sign-in" })}>
              {ta(locale, "signIn")}
            </button>
            {expired ? null : (
              <button type="button" onClick={() => setDialog({ kind: "auth", mode: "register" })}>
                {ta(locale, "createAccount")}
              </button>
            )}
          </>
        )}
        <span className="visually-hidden" role="status" data-testid="account-notice">
          {notice}
        </span>
      </div>

      {dialog?.kind === "auth" ? (
        <AuthDialog
          locale={locale}
          initialMode={dialog.mode}
          sessionExpired={expired}
          prefillAlias={expired ? state.account?.alias : undefined}
          onSubmit={submitAuth}
          onClose={() => setDialog(undefined)}
        />
      ) : null}

      {dialog?.kind === "projects" && authenticated ? (
        <ProjectsDialog
          locale={locale}
          projects={state.projects}
          activeProjectId={state.active?.projectId}
          onClose={() => setDialog(undefined)}
          onRetry={() => void controller.loadProjects()}
          onOpen={(projectId) => loadProject(() => controller.openProject(projectId))}
          onCreate={() =>
            loadProject(() =>
              controller.createProject(ta(locale, "newProjectTitle"), props.createStarterProject()),
            )
          }
          onRename={(projectId, title) => controller.renameProject(projectId, title)}
          onDuplicate={async (project) => {
            await controller.duplicateProject(
              project.projectId,
              `${project.title} (${ta(locale, "copySuffix")})`.slice(0, 120),
            );
          }}
          onDelete={(projectId) => controller.deleteProject(projectId)}
        />
      ) : null}

      {authenticated ? (
        <ImportOfferDialog
          locale={locale}
          offer={offer}
          onImport={() => void controller.importLocalProject(ta(locale, "defaultProjectTitle"))}
          onKeepLocal={() => controller.keepLocalOnly()}
          onOpenCopy={() => {
            if (offer.phase === "imported") void openImportedCopy(offer.projectId);
          }}
          onRemoveLocal={() => {
            if (offer.phase !== "imported") return;
            props.onRemoveLocalProject();
            void openImportedCopy(offer.projectId);
          }}
          onDone={() => controller.dismissImportResult()}
        />
      ) : null}

      {state.conflictDialogOpen ? (
        <ConflictDialog
          locale={locale}
          onCancel={() => void controller.resolveConflict("cancel")}
          onReload={() => {
            void controller
              .resolveConflict("reload")
              .then((dto) => {
                if (dto !== undefined) props.onProjectLoaded(dto);
              })
              .catch(() => undefined);
          }}
          onCopy={() => {
            void controller
              .resolveConflict(
                "copy",
                ta(locale, "conflictCopyTitle", { title: state.active?.title ?? "" }).slice(0, 120),
              )
              .catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}
