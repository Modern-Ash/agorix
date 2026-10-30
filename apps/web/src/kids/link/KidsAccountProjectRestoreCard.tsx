import { useEffect, useState } from "react";
import { ProjectStore, validateKidsProjectView, type KidsProjectView } from "@agorix/persistence";
import type { ProjectSummaryDto } from "../../accounts/clients.js";
import { createHttpBackend } from "../../accounts/httpClient.js";
import type { Locale } from "../../i18n.js";
import { KIDS_AVATARS, KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "../kidsState.js";
import { kidsAccountCopyByRemote, restoreKidsAccountProject } from "./kidsAccountProjectCopy.js";

/** Adult-only recovery of an existing account project on another browser or device. */
export function KidsAccountProjectRestoreCard({
  locale,
  accountAlias,
}: {
  readonly locale: Locale;
  readonly accountAlias: string;
}) {
  const [items, setItems] = useState<readonly ProjectSummaryDto[]>([]);
  const [selected, setSelected] = useState("");
  const [world, setWorld] = useState<KidsWorld>("ocean");
  const [avatar, setAvatar] = useState<KidsAvatar>("🦊");
  const [savedView, setSavedView] = useState<KidsProjectView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const spanish = locale === "es";

  useEffect(() => {
    let cancelled = false;
    void createHttpBackend()
      .projects.list()
      .then((projects) => {
        if (cancelled) return;
        setItems(projects);
        setSelected(projects[0]?.projectId ?? "");
      })
      .catch(() => {
        if (!cancelled)
          setMessage(
            spanish
              ? "No se pudieron cargar tus proyectos de cuenta."
              : "Could not load your account projects.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [accountAlias, spanish]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setSavedView(null);
    void createHttpBackend()
      .projects.get(selected)
      .then((project) => {
        if (cancelled || !project.storedProject.metadata.kidsView) return;
        const view = validateKidsProjectView(project.storedProject.metadata.kidsView);
        setWorld(view.world);
        setAvatar(view.avatar);
        setSavedView(view);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function restore() {
    if (busy || !selected) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await restoreKidsAccountProject({
        accountAlias,
        remoteProjectId: selected,
        world,
        avatar,
        store: new ProjectStore(),
        projects: createHttpBackend().projects,
        storage: window.localStorage,
      });
      setMessage(
        result.status === "restored"
          ? spanish
            ? `Proyecto ${result.localProjectId} listo en Mis proyectos. El vínculo con tu cuenta está activo.`
            : `Project ${result.localProjectId} is ready in My projects and remains linked to your account.`
          : result.status === "already-linked"
            ? spanish
              ? `Este proyecto ya está en Mis proyectos como ${result.localProjectId}.`
              : `This project is already in My projects as ${result.localProjectId}.`
            : result.status === "invalid-project"
              ? spanish
                ? "Ese proyecto de cuenta no es un proyecto libre de Kids compatible. No se cambió nada."
                : "That account project is not a compatible Kids free project. Nothing changed."
              : spanish
                ? "Este dispositivo no pudo guardar el proyecto. No se creó otro proyecto de cuenta."
                : "This device could not save the project. No new account project was created.",
      );
    } catch {
      setMessage(
        spanish
          ? "No se pudo recuperar el proyecto. Tus proyectos existentes siguen intactos."
          : "Could not recover the project. Your existing projects are unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0 && !message) return null;
  return (
    <section
      className="kids-link-card"
      aria-label={spanish ? "Proyectos de mi cuenta" : "My account projects"}
    >
      <h3>{spanish ? "Proyectos de mi cuenta" : "My account projects"}</h3>
      <p>
        {spanish
          ? "Si usás otro dispositivo, recuperá aquí tu programa. Si la cuenta conserva el mundo y personaje, también se recuperan."
          : "On another device, recover your program here. Its saved world and character return when available."}
      </p>
      {items.length > 0 ? (
        <>
          <label>
            {spanish ? "Proyecto de cuenta" : "Account project"}
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {items.map((item) => (
                <option key={item.projectId} value={item.projectId}>
                  {item.title}
                  {kidsAccountCopyByRemote(window.localStorage, accountAlias, item.projectId)
                    ? spanish
                      ? " · ya está en este dispositivo"
                      : " · already on this device"
                    : ""}
                </option>
              ))}
            </select>
          </label>
          {savedView ? (
            <p>
              {spanish ? "Mundo y personaje guardados" : "Saved world and character"}:{" "}
              {savedView.world} {savedView.avatar}
            </p>
          ) : (
            <>
              <label>
                {spanish ? "Mundo en este dispositivo" : "World on this device"}
                <select
                  value={world}
                  onChange={(event) => setWorld(event.target.value as KidsWorld)}
                >
                  {KIDS_WORLDS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {spanish ? "Personaje en este dispositivo" : "Character on this device"}
                <select
                  value={avatar}
                  onChange={(event) => setAvatar(event.target.value as KidsAvatar)}
                >
                  {KIDS_AVATARS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button
            type="button"
            className="kids-button"
            disabled={busy}
            onClick={() => void restore()}
          >
            {spanish ? "Abrir en este dispositivo" : "Open on this device"}
          </button>
        </>
      ) : null}
      <p role="status" className="kids-note">
        {message}
      </p>
    </section>
  );
}
