// Referencia de integración para apps/web. No verificada en ejecución: revisar tipos y estilos al integrar.
import { useState } from "react";
import {
  computeProposal,
  simulate,
  type Block,
  type BlockType,
  type Mission,
} from "../kidsEngine";

const LABEL: Record<BlockType, string> = {
  move: "Mover",
  turnL: "Girar izquierda",
  turnR: "Girar derecha",
  repeat: "Repetir",
  sound: "Sonar",
};

interface Props {
  mission: Mission;
  missionIndex: number;
  onFinish?: (completed: boolean) => void;
}

export function KidsEditor({ mission, missionIndex, onFinish }: Props) {
  const [program, setProgram] = useState<Block[]>([]);
  const [nextId, setNextId] = useState(1);
  const [result, setResult] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);

  const add = (type: BlockType) => {
    const id = nextId;
    setNextId(id + 1);
    setProgram((p) => [...p, type === "move" ? { id, type, n: 1 } : { id, type }]);
    setResult(null);
  };

  const run = () => {
    const r = simulate(program, mission);
    setResult(r.result);
    if (r.result === "success") onFinish?.(true);
  };

  const proposal = proposalOpen ? computeProposal(program, mission, missionIndex) : null;

  const acceptProposal = () => {
    if (!proposal || proposal.blocks.length === 0) return;
    const blocks = proposal.blocks.map((b) => ({ ...b, id: nextId + Math.random() }));
    setNextId((n) => n + blocks.length);
    setProgram((p) => [...p, ...blocks]);
    setProposalOpen(false);
    setResult(null);
  };

  return (
    <section aria-label={LABEL.move}>
      <ol>
        {program.map((b) => (
          <li key={b.id}>
            {LABEL[b.type]}
            {b.type === "move" ? ` ${b.n}` : ""}
          </li>
        ))}
      </ol>
      <div role="toolbar">
        {(Object.keys(LABEL) as BlockType[]).map((t) => (
          <button key={t} type="button" onClick={() => add(t)} style={{ minHeight: 56 }}>
            {LABEL[t]}
          </button>
        ))}
      </div>
      <button type="button" onClick={run} style={{ minHeight: 60 }}>
        Jugar
      </button>
      {result && <p role="status">Resultado: {result}</p>}
      <button type="button" onClick={() => setProposalOpen((o) => !o)}>
        Ver idea
      </button>
      {proposal && proposal.blocks.length > 0 && (
        <div role="dialog" aria-label="Propuesta de Ori">
          <p>Ori propone agregar {proposal.blocks.length} bloque(s). Puede estar equivocado.</p>
          <button type="button" onClick={acceptProposal}>Usar</button>
          <button type="button" onClick={() => setProposalOpen(false)}>No, gracias</button>
        </div>
      )}
    </section>
  );
}
