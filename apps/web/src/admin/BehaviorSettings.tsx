import {
  ORI_INTERVENTION_LIMITS,
  simulateOriIntervention,
  type OriInterventionPolicy,
} from "@agorix/ori-agent";

export interface BehaviorConfig {
  intervention: OriInterventionPolicy;
}

const FIELDS: readonly {
  readonly key: keyof OriInterventionPolicy;
  readonly label: string;
  readonly help: string;
}[] = [
  {
    key: "minFailedRuns",
    label: "Corridas que no llegan a la meta",
    help: "Cuántas veces debe fallar el chico antes de que Ori ofrezca una idea con bloques.",
  },
  {
    key: "minHints",
    label: "Pistas abiertas",
    help: "Desde qué pista Ori puede ofrecer una idea. Nunca menos de 2: la primera pista no alcanza.",
  },
  {
    key: "maxProposalBlocks",
    label: "Bloques por idea",
    help: "Tamaño máximo de una idea. Las metas más largas dejan de ofrecerse.",
  },
];

const LEARNERS: Record<string, string> = {
  "just-arrived": "Recién entra",
  "first-miss": "Primera corrida fallida",
  "two-misses": "Dos corridas fallidas",
  "first-hint": "Abrió la pista 1",
  "second-hint": "Abrió la pista 2",
  "stuck-with-hints": "Trabado, con 3 pistas",
};

export function BehaviorSettings({
  behavior,
  onChange,
}: {
  readonly behavior: BehaviorConfig;
  readonly onChange: (next: BehaviorConfig) => void;
}) {
  const policy = behavior.intervention;
  return (
    <div className="ai-admin-card">
      <p className="ai-admin-note">
        Cuándo ofrece Ori una idea hecha de bloques. Los límites son el piso de seguridad: Ori nunca
        ofrece una solución al entrar y los validadores siguen decidiendo qué se acepta.
      </p>
      {FIELDS.map((field) => {
        const limit = ORI_INTERVENTION_LIMITS[field.key];
        return (
          <label key={field.key}>
            {field.label} ({limit.min} a {limit.max})
            <input
              type="number"
              min={limit.min}
              max={limit.max}
              step={1}
              value={policy[field.key]}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isInteger(next)) return;
                onChange({
                  intervention: {
                    ...policy,
                    [field.key]: Math.min(limit.max, Math.max(limit.min, next)),
                  },
                });
              }}
            />
            <small>{field.help}</small>
          </label>
        );
      })}
      <h3>Con aprendices simulados</h3>
      <p className="ai-admin-footnote">
        Situaciones inventadas, nunca datos de chicos reales. Mostrar esto no publica nada.
      </p>
      <table aria-label="Aprendices simulados">
        <thead>
          <tr>
            <th scope="col">Situación</th>
            <th scope="col">¿Ori ofrece una idea?</th>
          </tr>
        </thead>
        <tbody>
          {simulateOriIntervention(policy).map((row) => (
            <tr key={row.learner}>
              <th scope="row">{LEARNERS[row.learner]}</th>
              <td>{row.offersIdea ? `Sí, hasta ${row.maxBlocks} bloques` : "No, todavía no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ai-admin-footnote">
        Metas disponibles con este tamaño: {simulateOriIntervention(policy)[0]?.goals} de 7.
      </p>
    </div>
  );
}
