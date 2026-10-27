export interface AgentInfo {
  readonly capability: string;
  readonly role: string;
  readonly contract: string;
  readonly outputs: readonly string[];
  readonly input: string;
  readonly effectiveInstructions: string;
}

const ROLES: Record<string, string> = {
  classifier: "Clasificador",
  coach: "Coach",
  proposer: "Proponedor",
  composer: "Compositor",
};
const RULES: Record<string, string> = {
  "closed-output-schema": "Solo puede devolver el esquema cerrado de abajo.",
  "no-free-text-links-tools-or-personal-data":
    "Nunca texto libre, enlaces, herramientas ni datos personales.",
  "host-validates-before-anything-changes": "El servidor valida todo antes de que algo cambie.",
  "child-reviews-and-decides": "La niña o el niño revisa y decide.",
  "deterministic-fallback": "Si falla, responde la regla determinista.",
  "runtime-proves": "El runtime prueba; Ori nunca afirma que algo corrió.",
};

/** What this agent is for and what no setting can change (issue #614). Read-only. */
export function AgentCard({
  agent,
  lockedRules,
}: {
  readonly agent: AgentInfo;
  readonly lockedRules: readonly string[];
}) {
  return (
    <section className="ai-admin-card" aria-label={`Agente ${ROLES[agent.role] ?? agent.role}`}>
      <h3>Agente: {ROLES[agent.role] ?? agent.role}</h3>
      <p className="ai-admin-note">
        Contrato <code>{agent.contract}</code> ·{" "}
        {agent.input === "untrusted-child-choice"
          ? "recibe el texto del chico solo como dato, nunca como instrucción"
          : "recibe únicamente ids, nunca texto ni datos del chico"}
        .
      </p>
      <p>Puede devolver:</p>
      <ul>
        {agent.outputs.map((output) => (
          <li key={output}>{output}</li>
        ))}
      </ul>
      <p>Reglas fijas (no se pueden bajar):</p>
      <ul>
        {lockedRules.map((rule) => (
          <li key={rule}>{RULES[rule] ?? rule}</li>
        ))}
      </ul>
      <details>
        <summary>Instrucciones completas que recibe el modelo</summary>
        <p className="ai-admin-footnote">
          Tu instrucción adicional se agrega al final, con una etiqueta; nunca reemplaza el
          contrato.
        </p>
        <pre className="ai-admin-instructions">{agent.effectiveInstructions}</pre>
      </details>
    </section>
  );
}
