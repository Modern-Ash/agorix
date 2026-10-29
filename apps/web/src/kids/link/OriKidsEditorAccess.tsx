import { useEffect, useState } from "react";
import { ProjectStore } from "@agorix/persistence";
import { createHttpBackend } from "../../accounts/httpClient.js";
import { kidsAccountCopy, pullKidsAccountCopy } from "./kidsAccountProjectCopy.js";
import { OriKidsPilotPanel } from "./OriKidsPilotPanel.js";

/** Editor entry point for the private pilot. The server still decides eligibility. */
export function OriKidsEditorAccess({
  localProjectId,
  onPulled,
}: {
  readonly localProjectId: string;
  readonly onPulled: () => void;
}) {
  const [copy, setCopy] = useState<{ alias: string; remoteProjectId: string } | null>(null);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    void createHttpBackend()
      .account.restore()
      .then((session) => {
        if (cancelled || !session) return;
        const linked = kidsAccountCopy(window.localStorage, session.alias, localProjectId);
        if (linked?.remoteRevision !== undefined && linked.localSemanticHash) {
          setCopy({ alias: session.alias, remoteProjectId: linked.remoteProjectId });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [localProjectId]);
  if (!copy) return null;

  async function pull() {
    if (!copy) return;
    try {
      const result = await pullKidsAccountCopy({
        accountAlias: copy.alias,
        localProjectId,
        store: new ProjectStore(),
        projects: createHttpBackend().projects,
        storage: window.localStorage,
      });
      if (result === "pulled") {
        onPulled();
        setApplied(false);
        setMessage("Cambio aprobado cargado en el editor.");
      } else {
        setMessage(
          result === "local-conflict"
            ? "Este proyecto tiene cambios locales. No se reemplazaron."
            : "No se pudo cargar el cambio aprobado en este dispositivo.",
        );
      }
    } catch {
      setMessage("No se pudo cargar el cambio aprobado en este dispositivo.");
    }
  }

  return (
    <div>
      <OriKidsPilotPanel
        remoteProjectId={copy.remoteProjectId}
        onApplied={() => setApplied(true)}
      />
      {applied ? (
        <button type="button" className="kids-button" onClick={() => void pull()}>
          Traer cambio aprobado al editor
        </button>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
