import { useState } from "react";
import { describeOriProposal,parseOriReviewableProposal } from "./oriProposalReview.js";
export interface OriLearnerProposalInput {
  readonly proposal:unknown;
  readonly revision:string;
  readonly currentRevision:string;
}
export function OriLearnerProposalReview({input}:{
  readonly input:OriLearnerProposalInput|undefined
}) {
  const [decision,setDecision]=useState<"accept"|"edit"|"reject"|null>(null);
  const proposal=input?parseOriReviewableProposal(input.proposal):null;
  if(!input || !proposal)return null;
  const stale=input.revision!==input.currentRevision;
  return (
    <section aria-label="Propuesta de Ori" data-testid="ori-proposal-review">
      <h3>Ori propone un paso</h3>
      <p>{describeOriProposal(proposal)}</p>
      <p>Esta propuesta no modifica tu programa. Primero tenés que revisarla.</p>
      {stale ? <p role="alert">El programa cambió. Pedí una propuesta nueva.</p> : null}
      {decision ? <p role="status">Decisión registrada: {decision==="accept"?"aceptar":decision==="edit"?"editar":"rechazar"}. No se aplicaron cambios.</p> : (
        <div>
          <button type="button" disabled={stale} onClick={()=>setDecision("accept")}>Aceptar propuesta</button>
          <button type="button" disabled={stale} onClick={()=>setDecision("edit")}>Quiero editarla</button>
          <button type="button" onClick={()=>setDecision("reject")}>Rechazar propuesta</button>
        </div>
      )}
    </section>
  );
}
