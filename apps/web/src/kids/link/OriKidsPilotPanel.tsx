import { useEffect, useRef, useState } from "react";
import { projectAgorixCode } from "@agorix/agorix-code";
import { semanticProjectHash } from "@agorix/persistence";
import { createHttpBackend } from "../../accounts/httpClient.js";
import {
  OriLearnerProposalReview,
  type OriLearnerDecision,
} from "../../OriLearnerProposalReview.js";
import { requestOriProposal, type OriIssuedProposal } from "../../oriProposalIssuanceClient.js";
import { requestOriReviewDecision } from "../../oriReviewDecisionClient.js";
import { describeOriProposal } from "../../oriProposalReview.js";
import { applyOriKidsPilotProposal } from "./oriKidsPilotApply.js";
import {
  oriKidsPilotProject,
  recordOriKidsPilotRun,
  requestOriKidsPilotHint,
} from "./oriKidsPilotClient.js";
import {
  oriProposalOfferContext,
  type OriKidsActivity,
  type OriKidsHintRequest,
} from "./oriKidsActivity.js";

/** Adult-only Kids pilot journey; every server operation rechecks the durable allowlist. */
export function OriKidsPilotPanel({
  remoteProjectId,
  localSaveVersion,
  activities,
  evidenceKey,
  registerHintRequest,
  beforeRun,
  beforeEvidenceAction,
  onApplied,
}: {
  readonly remoteProjectId: string;
  readonly localSaveVersion: number;
  readonly activities: readonly OriKidsActivity[];
  readonly evidenceKey: string;
  readonly registerHintRequest: (request: OriKidsHintRequest | null) => void;
  readonly beforeRun: () => Promise<
    "unchanged" | "updated" | "pulled" | "conflict" | "unavailable"
  >;
  readonly beforeEvidenceAction: () => Promise<
    "unchanged" | "updated" | "pulled" | "conflict" | "unavailable"
  >;
  readonly onApplied?: () => Promise<boolean>;
}) {
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);
  const [hint, setHint] = useState<{ readonly level: number; readonly text: string } | null>(null);
  const [issued, setIssued] = useState<OriIssuedProposal | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{
    readonly scriptId: string;
    readonly code: string;
  } | null>(null);
  const lastQueuedActivity = useRef(activities.at(-1)?.sequence ?? 0);
  const activityQueue = useRef<Promise<void>>(Promise.resolve());
  const verifiedRun = useRef(false);
  const lastAutoOfferContext = useRef<string | null>(null);
  const currentEvidenceKey = useRef(evidenceKey);
  currentEvidenceKey.current = evidenceKey;

  useEffect(() => {
    let cancelled = false;
    setAllowed(false);
    setRan(false);
    verifiedRun.current = false;
    lastAutoOfferContext.current = null;
    setIssued(null);
    setAccepted(false);
    setPreview(null);
    void oriKidsPilotProject().then((projectId) => {
      if (!cancelled) setAllowed(projectId === remoteProjectId);
    });
    return () => {
      cancelled = true;
    };
  }, [remoteProjectId]);

  useEffect(() => {
    verifiedRun.current = false;
    setRan(false);
    setIssued(null);
    setAccepted(false);
    setPreview(null);
  }, [localSaveVersion]);

  useEffect(() => {
    if (!allowed) return;
    for (const activity of activities) {
      if (activity.sequence <= lastQueuedActivity.current) continue;
      lastQueuedActivity.current = activity.sequence;
      activityQueue.current = activityQueue.current
        .then(async () => {
          setBusy(true);
          if (activity.kind === "run") {
            verifiedRun.current = false;
            setRan(false);
            setHint(null);
            setIssued(null);
            setAccepted(false);
            setPreview(null);
            setMessage("");
            if (activity.evidenceKey !== currentEvidenceKey.current) return;
            const synced = await beforeRun();
            if (synced === "conflict" || synced === "unavailable") {
              setMessage(
                synced === "conflict"
                  ? "Hay cambios distintos en este dispositivo y en tu cuenta. No se reemplazó ninguno. Resolvé la diferencia antes de usar Ori."
                  : "No se pudo actualizar el proyecto de tu cuenta. Ori no usó una versión anterior.",
              );
              return;
            }
            if (activity.evidenceKey !== currentEvidenceKey.current) return;
            const recorded = await recordOriKidsPilotRun();
            verifiedRun.current = recorded;
            setRan(recorded);
            setMessage(
              recorded
                ? "Ori registró la ejecución de Kids y guardó la evidencia durante esta sesión."
                : "No se pudo verificar esta ejecución. Tu proyecto no cambió.",
            );
            const offerContext = recorded ? oriProposalOfferContext(activity) : null;
            if (offerContext) {
              if (lastAutoOfferContext.current !== offerContext) {
                lastAutoOfferContext.current = offerContext;
                if (!(await prepareProposal(activity.evidenceKey)))
                  lastAutoOfferContext.current = null;
              }
            }
          }
        })
        .catch(() => {
          verifiedRun.current = false;
          setRan(false);
          setMessage("No se pudo registrar la evidencia de Kids para Ori.");
        })
        .finally(() => setBusy(false));
    }
  }, [activities, allowed, beforeRun]);

  useEffect(() => {
    if (!allowed || !ran || busy) {
      registerHintRequest(null);
      return;
    }
    registerHintRequest(async (expectedLevel) => {
      setBusy(true);
      try {
        if (!(await evidenceIsCurrent())) return null;
        const next = await requestOriKidsPilotHint(fetch, expectedLevel);
        if (!next || next.level !== expectedLevel) {
          setMessage("Ori no pudo registrar esta pista. Kids sigue funcionando.");
          return null;
        }
        setHint(next);
        verifiedRun.current = false;
        setRan(false);
        setIssued(null);
        setAccepted(false);
        setPreview(null);
        setMessage("Pista registrada. Ejecutá otra vez en Kids antes de pedir una propuesta.");
        return next;
      } finally {
        setBusy(false);
      }
    });
    return () => registerHintRequest(null);
  }, [allowed, ran, busy, beforeEvidenceAction, registerHintRequest]);

  async function prepareProposal(expectedEvidenceKey: string): Promise<boolean> {
    try {
      if (!(await evidenceIsCurrent())) return false;
      if (expectedEvidenceKey !== currentEvidenceKey.current) return false;
      const remote = await createHttpBackend().projects.get(remoteProjectId);
      if (expectedEvidenceKey !== currentEvidenceKey.current) return false;
      if (
        remote.projectId !== remoteProjectId ||
        remote.semanticHash !== semanticProjectHash(remote.storedProject) ||
        remote.storedProject.program.scripts.length !== 1
      ) {
        setMessage("La copia de cuenta cambió o no tiene un único programa compatible.");
        return false;
      }
      const script = remote.storedProject.program.scripts[0];
      if (!script) return false;
      const proposal = await requestOriProposal();
      if (!proposal) return false;
      if (expectedEvidenceKey !== currentEvidenceKey.current) return false;
      setPreview({
        scriptId: script.id,
        code: projectAgorixCode(remote.storedProject.program).text,
      });
      setIssued(proposal);
      return true;
    } catch {
      setMessage("No se pudo preparar la propuesta. Tu proyecto no cambió.");
      return false;
    }
  }

  async function evidenceIsCurrent(): Promise<boolean> {
    const result = await beforeEvidenceAction();
    if (result === "unchanged") return true;
    verifiedRun.current = false;
    setRan(false);
    setHint(null);
    setIssued(null);
    setAccepted(false);
    setPreview(null);
    setMessage(
      result === "updated" || result === "pulled"
        ? "El proyecto cambió desde la última ejecución. Ejecutalo otra vez antes de pedir pistas o propuestas."
        : result === "conflict"
          ? "Hay cambios distintos en este dispositivo y en tu cuenta. Resolvé la diferencia antes de usar Ori."
          : "No se pudo verificar la versión actual del proyecto. Ori no usó evidencia anterior.",
    );
    return false;
  }

  async function decide(ticketId: string, choice: OriLearnerDecision) {
    const result = await requestOriReviewDecision(ticketId, choice);
    setAccepted(result === "accepted");
    return result;
  }

  async function apply() {
    if (busy || !issued || !accepted || !preview) return;
    setBusy(true);
    try {
      const result = await applyOriKidsPilotProposal(issued.ticketId, preview.scriptId);
      setAccepted(false);
      verifiedRun.current = false;
      setRan(false);
      setIssued(null);
      setPreview(null);
      const loaded = result === "applied" ? await onApplied?.() : false;
      setMessage(
        result === "applied"
          ? loaded
            ? "El cambio aprobado ya está en tu editor. Ejecutá el proyecto para comprobarlo."
            : "Ori aplicó el cambio a tu cuenta, pero no pudo cargarlo en este editor. Tus cambios locales siguen intactos."
          : result === "conflict"
            ? "La copia cambió antes de aplicar la propuesta. No se escribió ningún cambio de Ori."
            : "No se pudo aplicar la propuesta. Revisá la copia de cuenta antes de volver a intentar.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) return null;

  return (
    <section className="kids-adult-card" aria-label="Ori en mi proyecto">
      <h3>Ori</h3>
      <p>
        Ori usa tus ejecuciones y pistas de Kids. Vos revisás cada propuesta y decidís si aplicarla.
      </p>
      {hint ? (
        <p role="status">
          Pista {hint.level}: {hint.text}
        </p>
      ) : null}
      {issued && preview ? (
        <>
          <details>
            <summary>Ver código actual de la copia</summary>
            <pre>{preview.code}</pre>
          </details>
          <p>Cambio propuesto: {describeOriProposal(issued.proposal)}</p>
          <OriLearnerProposalReview
            key={issued.ticketId}
            input={{ ticketId: issued.ticketId, proposal: issued.proposal }}
            onDecision={decide}
          />
          {accepted ? (
            <button
              type="button"
              className="kids-button"
              disabled={busy}
              onClick={() => void apply()}
            >
              Aplicar cambio aceptado a mi proyecto
            </button>
          ) : null}
        </>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
