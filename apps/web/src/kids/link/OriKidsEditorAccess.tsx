import { useCallback, useEffect, useRef, useState } from "react";
import { ProjectStore } from "@agorix/persistence";
import { createHttpBackend } from "../../accounts/httpClient.js";
import {
  kidsAccountCopy,
  pullKidsAccountCopy,
  reconcileKidsAccountProject,
} from "./kidsAccountProjectCopy.js";
import { OriKidsPilotPanel } from "./OriKidsPilotPanel.js";
import type { OriKidsActivity, OriKidsHintRequest } from "./oriKidsActivity.js";

/** Editor entry point for the private pilot. The server still decides eligibility. */
export function OriKidsEditorAccess({
  localProjectId,
  localSaveVersion,
  activities,
  evidenceKey,
  registerHintRequest,
  onPulled,
}: {
  readonly localProjectId: string;
  readonly localSaveVersion: number;
  readonly activities: readonly OriKidsActivity[];
  readonly evidenceKey: string;
  readonly registerHintRequest: (request: OriKidsHintRequest | null) => void;
  readonly onPulled: () => void;
}) {
  const [copy, setCopy] = useState<{ alias: string; remoteProjectId: string } | null>(null);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState("");
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const onPulledRef = useRef(onPulled);
  onPulledRef.current = onPulled;
  useEffect(() => {
    let cancelled = false;
    setCopy(null);
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

  const enqueueReconcile = useCallback(() => {
    const task = syncQueue.current.then(() => {
      if (!copy) return "missing" as const;
      return reconcileKidsAccountProject({
        accountAlias: copy.alias,
        localProjectId,
        store: new ProjectStore(),
        projects: createHttpBackend().projects,
        storage: window.localStorage,
      });
    });
    syncQueue.current = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }, [copy, localProjectId]);

  useEffect(() => {
    if (!copy) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void enqueueReconcile()
        .then((result) => {
          if (cancelled) return;
          if (result === "pulled") onPulledRef.current();
          setMessage(
            result === "conflict"
              ? "Este proyecto cambió en este dispositivo y en tu cuenta. No se reemplazó ninguno."
              : result === "updated"
                ? "Proyecto guardado en tu cuenta."
                : result === "pulled"
                  ? "Se cargó la versión más reciente de tu cuenta."
                  : result === "invalid-remote" || result === "untracked"
                    ? "No se pudo sincronizar este proyecto. Tus cambios locales siguen intactos."
                    : "",
          );
        })
        .catch(() => {
          if (!cancelled)
            setMessage(
              "No se pudo sincronizar este proyecto. Tus cambios locales siguen intactos.",
            );
        });
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [copy, enqueueReconcile, localSaveVersion]);

  if (!copy) return null;

  async function prepareRun(): Promise<
    "unchanged" | "updated" | "pulled" | "conflict" | "unavailable"
  > {
    if (!copy) return "unavailable";
    try {
      const result = await enqueueReconcile();
      if (result === "pulled") onPulled();
      return result === "unchanged" ||
        result === "updated" ||
        result === "pulled" ||
        result === "conflict"
        ? result
        : "unavailable";
    } catch {
      return "unavailable";
    }
  }

  async function pull(): Promise<boolean> {
    if (!copy) return false;
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
        return true;
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
    return false;
  }

  return (
    <div>
      <OriKidsPilotPanel
        remoteProjectId={copy.remoteProjectId}
        activities={activities}
        evidenceKey={evidenceKey}
        registerHintRequest={registerHintRequest}
        beforeRun={prepareRun}
        beforeEvidenceAction={prepareRun}
        onApplied={async () => {
          const loaded = await pull();
          if (!loaded) setApplied(true);
          return loaded;
        }}
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
