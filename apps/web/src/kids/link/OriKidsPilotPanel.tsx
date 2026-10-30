import { useEffect, useState } from "react";
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

/** Adult-only Kids pilot journey; every server operation rechecks the durable allowlist. */
export function OriKidsPilotPanel({
  remoteProjectId,
  beforeRun,
  beforeEvidenceAction,
  onApplied,
}: {
  readonly remoteProjectId: string;
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

  useEffect(() => {
    let cancelled = false;
    setAllowed(false);
    setRan(false);
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

  if (!allowed) return null;

  async function run() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setIssued(null);
    setAccepted(false);
    try {
      const synced = await beforeRun();
      if (synced === "conflict" || synced === "unavailable") {
        setRan(false);
        setMessage(
          synced === "conflict"
            ? "Hay cambios distintos en este dispositivo y en tu cuenta. No se reemplazó ninguno. Resolvé la diferencia antes de usar Ori."
            : "No se pudo actualizar el proyecto de tu cuenta. Ori no usó una versión anterior.",
        );
        return;
      }
      const recorded = await recordOriKidsPilotRun();
      setRan(recorded);
      setMessage(
        recorded
          ? "Ori ejecutó tu proyecto actualizado y guardó la evidencia durante esta sesión."
          : "No se pudo verificar esta ejecución. Tu proyecto no cambió.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function askHint() {
    if (busy || !ran) return;
    setBusy(true);
    try {
      if (!(await evidenceIsCurrent())) return;
      const next = await requestOriKidsPilotHint();
      setHint(next);
      if (!next) setMessage("No hay otra pista disponible para esta ejecución.");
    } finally {
      setBusy(false);
    }
  }

  async function propose() {
    if (busy || !ran) return;
    setBusy(true);
    setMessage("");
    setIssued(null);
    setAccepted(false);
    setPreview(null);
    try {
      if (!(await evidenceIsCurrent())) return;
      const remote = await createHttpBackend().projects.get(remoteProjectId);
      if (
        remote.projectId !== remoteProjectId ||
        remote.semanticHash !== semanticProjectHash(remote.storedProject) ||
        remote.storedProject.program.scripts.length !== 1
      ) {
        setMessage("La copia de cuenta cambió o no tiene un único programa compatible.");
        return;
      }
      const script = remote.storedProject.program.scripts[0];
      if (!script) return;
      const proposal = await requestOriProposal();
      if (!proposal) {
        setMessage("Ori no tiene una propuesta disponible para esta copia.");
        return;
      }
      setPreview({
        scriptId: script.id,
        code: projectAgorixCode(remote.storedProject.program).text,
      });
      setIssued(proposal);
    } catch {
      setMessage("No se pudo preparar la propuesta. Tu proyecto no cambió.");
    } finally {
      setBusy(false);
    }
  }

  async function evidenceIsCurrent(): Promise<boolean> {
    const result = await beforeEvidenceAction();
    if (result === "unchanged") return true;
    setRan(false);
    setHint(null);
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

  return (
    <section className="kids-adult-card" aria-label="Ori en mi proyecto">
      <h3>Ori</h3>
      <p>Ori trabaja con tu proyecto de cuenta. Vos revisás la propuesta y decidís si aplicarla.</p>
      <button type="button" className="kids-button" disabled={busy} onClick={() => void run()}>
        Ejecutar proyecto con Ori
      </button>
      {ran ? (
        <>
          <button
            type="button"
            className="kids-button"
            disabled={busy}
            onClick={() => void askHint()}
          >
            Pedir pista
          </button>
          <button
            type="button"
            className="kids-button"
            disabled={busy}
            onClick={() => void propose()}
          >
            Pedir propuesta
          </button>
        </>
      ) : null}
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
