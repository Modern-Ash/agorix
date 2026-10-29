import { useMemo, useState } from "react";
import { ProjectStore } from "@agorix/persistence";
import type { Locale } from "../../i18n.js";
import { createHttpBackend } from "../../accounts/httpClient.js";
import { isClientError } from "../../accounts/clients.js";
import { listFreeProjects } from "../kidsProjects.js";
import {
  copyKidsProjectToAccount,
  kidsAccountCopy,
  pullKidsAccountCopy,
  updateKidsAccountCopy,
} from "./kidsAccountProjectCopy.js";

/** Adult-only, explicit first copy into the account project service. */
export function KidsAccountProjectCopyCard({
  locale,
  accountAlias,
}: {
  readonly locale: Locale;
  readonly accountAlias: string;
}) {
  const localProjects = useMemo(() => listFreeProjects(), []);
  const [selected, setSelected] = useState(localProjects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [updateUnavailable, setUpdateUnavailable] = useState(false);
  const spanish = locale === "es";
  const existing = kidsAccountCopy(window.localStorage, accountAlias, selected);
  const canUpdate = existing?.remoteRevision !== undefined && !updateUnavailable;
  const canPull = canUpdate && existing?.localSemanticHash !== undefined;
  async function copy() {
    if (busy || !selected) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await copyKidsProjectToAccount({
        accountAlias,
        localProjectId: selected,
        store: new ProjectStore(),
        projects: createHttpBackend().projects,
        storage: window.localStorage,
      });
      setUpdateUnavailable(false);
      setMessage(
        result.status === "copied-untracked"
          ? spanish
            ? "La copia se creó, pero este navegador no pudo guardar el vínculo. No repitas la acción; revisá tus proyectos de cuenta."
            : "The copy was created, but this browser could not save the link. Do not retry; check your account projects."
          : result.status === "already-copied"
            ? spanish
              ? "Este proyecto ya tiene una copia en tu cuenta. Podés actualizarla de forma explícita."
              : "This project already has an account copy. You can update it explicitly."
            : spanish
              ? "Copia creada en tu cuenta. El proyecto de este dispositivo sigue intacto."
              : "Account copy created. The project on this device is unchanged.",
      );
    } catch {
      setMessage(
        spanish
          ? "No se pudo crear la copia. Tu proyecto de este dispositivo sigue intacto."
          : "Could not create the copy. The project on this device is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function update() {
    if (busy || !canUpdate) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await updateKidsAccountCopy({
        accountAlias,
        localProjectId: selected,
        store: new ProjectStore(),
        projects: createHttpBackend().projects,
        storage: window.localStorage,
      });
      setMessage(
        result === "updated"
          ? spanish
            ? "Copia de cuenta actualizada. El proyecto de este dispositivo sigue intacto."
            : "Account copy updated. The project on this device is unchanged."
          : result === "missing"
            ? spanish
              ? "No hay una copia vinculada para actualizar. Tu proyecto de este dispositivo sigue intacto."
              : "There is no linked copy to update. The project on this device is unchanged."
            : spanish
              ? "La copia de cuenta cambió, pero este navegador no guardó la nueva revisión. No repitas la acción."
              : "The account copy changed, but this browser did not save the new revision. Do not retry.",
      );
      if (result === "updated-untracked") setUpdateUnavailable(true);
    } catch (error) {
      setMessage(
        isClientError(error, "revision-conflict")
          ? spanish
            ? "La copia de cuenta cambió en otro lugar. No se reemplazó. Tu proyecto de este dispositivo sigue intacto."
            : "The account copy changed elsewhere and was not replaced. The project on this device is unchanged."
          : spanish
            ? "No se pudo actualizar la copia. Tu proyecto de este dispositivo sigue intacto."
            : "Could not update the copy. The project on this device is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pull() {
    if (busy || !canPull) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await pullKidsAccountCopy({
        accountAlias,
        localProjectId: selected,
        store: new ProjectStore(),
        projects: createHttpBackend().projects,
        storage: window.localStorage,
      });
      setMessage(
        result === "pulled"
          ? spanish
            ? "Versión de cuenta cargada en este dispositivo. Abrí el proyecto desde Mis proyectos para verla."
            : "Account version loaded on this device. Open it from My projects to see it."
          : result === "unchanged"
            ? spanish
              ? "La copia de cuenta no tiene cambios nuevos."
              : "The account copy has no new changes."
            : result === "local-conflict"
              ? spanish
                ? "Este dispositivo tiene cambios propios. No se reemplazaron; guardá una copia antes de resolver la diferencia."
                : "This device has its own edits. They were not replaced; save a copy before resolving the difference."
              : result === "invalid-remote"
                ? spanish
                  ? "La versión de cuenta no es compatible con este proyecto libre. No se cambió nada."
                  : "The account version is not compatible with this free project. Nothing changed."
                : result === "missing"
                  ? spanish
                    ? "No hay una copia vinculada para traer."
                    : "There is no linked copy to load."
                  : spanish
                    ? "La versión de cuenta se cargó, pero no se pudo guardar el vínculo. No repitas la acción."
                    : "The account version loaded, but the link could not be saved. Do not retry.",
      );
      if (result === "pulled-untracked") setUpdateUnavailable(true);
    } catch {
      setMessage(
        spanish
          ? "No se pudo traer la versión de cuenta. Tu proyecto de este dispositivo sigue intacto."
          : "Could not load the account version. The project on this device is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="kids-link-card" aria-labelledby="kids-account-project-copy-title">
      <h3 id="kids-account-project-copy-title">
        {spanish ? "Preparar un proyecto para Ori" : "Prepare a project for Ori"}
      </h3>
      <p>
        {spanish
          ? "Elegí un proyecto libre de Kids y creá una copia en tu cuenta. Para enviar cambios posteriores, usá Actualizar copia. Si la copia cambió en otro lugar, se rechazará la actualización."
          : "Choose a Kids free project and create an account copy. Use Update copy to send later edits. If the account copy changed elsewhere, the update is rejected."}
      </p>
      {localProjects.length > 0 ? (
        <>
          <label>
            {spanish ? "Proyecto de este dispositivo" : "Project on this device"}
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {localProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.id}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="kids-button" disabled={busy} onClick={() => void copy()}>
            {busy
              ? spanish
                ? "Copiando…"
                : "Copying…"
              : spanish
                ? "Crear copia en mi cuenta"
                : "Create account copy"}
          </button>
          {canUpdate ? (
            <button
              type="button"
              className="kids-button"
              disabled={busy}
              onClick={() => void update()}
            >
              {spanish ? "Actualizar copia" : "Update copy"}
            </button>
          ) : null}
          {canPull ? (
            <button
              type="button"
              className="kids-button"
              disabled={busy}
              onClick={() => void pull()}
            >
              {spanish ? "Traer cambios de mi cuenta" : "Load account changes"}
            </button>
          ) : null}
        </>
      ) : (
        <p>
          {spanish
            ? "Creá primero un proyecto libre en Kids."
            : "Create a free Kids project first."}
        </p>
      )}
      <p role="status" className="kids-note">
        {message}
      </p>
    </section>
  );
}
