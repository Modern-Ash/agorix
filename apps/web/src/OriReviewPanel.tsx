import {useState} from "react";
import {requestOriReviewPreview,type OriReviewPreview} from "./oriReviewClient.js";

export function OriReviewPanel(){
  const [result,setResult]=useState<OriReviewPreview|null>(null);
  const [loading,setLoading]=useState(false);
  return <section aria-label="Vista previa experimental de Ori" data-testid="ori-review-panel">
    <h3>Ori · Vista previa educativa</h3>
    <p>Esta vista es experimental. Ori propone una pista para revisar; no modifica tu programa.</p>
    <button type="button" disabled={loading} onClick={async()=>{
      setLoading(true);
      try{setResult(await requestOriReviewPreview("help"));}finally{setLoading(false);}
    }}>Pedir una pista</button>
    {result?.status==="ready"?
      <div role="status"><p>{result.hint}</p><p>Siguiente paso: {result.nextStep}</p>
      <p>Solo para revisión. No se aplicaron cambios.</p></div>:
      result?<p role="status">Ori no está disponible en este momento.</p>:null}
  </section>;
}
