export const BLOCK_CATEGORIES = [
  "violence",
  "sexual",
  "hate",
  "self-harm",
  "personal-data",
  "other",
] as const;
export const PII_PATTERNS = ["phone", "email", "address", "url"] as const;
export const REACTIONS = ["like", "party", "think", "heart"] as const;

const CATEGORY_LABEL: Record<(typeof BLOCK_CATEGORIES)[number], string> = {
  violence: "Violencia",
  sexual: "Contenido sexual",
  hate: "Odio",
  "self-harm": "Autolesión",
  "personal-data": "Datos personales",
  other: "Otros",
};
const PII_LABEL: Record<(typeof PII_PATTERNS)[number], string> = {
  phone: "Teléfono",
  email: "Correo",
  address: "Dirección",
  url: "Enlace",
};
const REACTION_LABEL: Record<(typeof REACTIONS)[number], string> = {
  like: "Me gusta",
  party: "Festejo",
  think: "Pensando",
  heart: "Corazón",
};

export interface GroupConfig {
  moderation: {
    image: {
      enabled: boolean;
      modelId: string;
      unsafeThreshold: number;
      uncertainThreshold: number;
      blockedCategories: string[];
      onUnavailable: "block";
    };
    text: {
      enabled: boolean;
      ruleSet: string;
      blockedTerms: { es: string[]; en: string[] };
      piiPatterns: string[];
      onUnavailable: "block";
    };
  };
  approvalQueue: { holdAll: boolean; reasonRetentionMinutes: number };
  reactions: { es: string[]; en: string[] };
  limits: {
    maxChildren: number;
    maxSessionMinutes: number;
    joinCodeMinutes: number;
    relayEnabled: boolean;
  };
}

function toggle(list: readonly string[], value: string, on: boolean): string[] {
  const without = list.filter((item) => item !== value);
  return on ? [...without, value] : without;
}

/** One term per line; the server trims nothing, so blank lines are dropped here. */
function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

interface Props {
  readonly group: GroupConfig;
  readonly onChange: (next: GroupConfig) => void;
}

/**
 * Settings of the closed same-room groups (ADR 0010). Every value is stored in the registry with
 * its history; the rule "if the model is missing or unsure, nothing is shared" is fixed and has no
 * control here on purpose.
 */
export function GroupSettings({ group, onChange }: Props) {
  const set = (patch: (draft: GroupConfig) => void) => {
    const next = structuredClone(group);
    patch(next);
    onChange(next);
  };
  const { image, text } = group.moderation;
  return (
    <div className="ai-admin-card">
      <p className="ai-admin-note">
        Modo en la misma sala. Todo se procesa en el dispositivo; acá no hay claves. Si el modelo
        falta, falla o duda, el contenido no se comparte: esa regla no se puede desactivar.
      </p>

      <h3>Imágenes</h3>
      <label className="ai-admin-toggle">
        <input
          type="checkbox"
          checked={image.enabled}
          onChange={(event) => set((d) => void (d.moderation.image.enabled = event.target.checked))}
        />{" "}
        Revisar imágenes antes de compartirlas
      </label>
      <div className="ai-admin-grid">
        <label>
          Modelo local
          <input
            value={image.modelId}
            onChange={(event) => set((d) => void (d.moderation.image.modelId = event.target.value))}
          />
        </label>
        <label>
          Umbral de riesgo (bloquea desde)
          <input
            type="number"
            min={0.001}
            max={1}
            step={0.01}
            value={image.unsafeThreshold}
            onChange={(event) =>
              set((d) => void (d.moderation.image.unsafeThreshold = Number(event.target.value)))
            }
          />
        </label>
        <label>
          Umbral de duda (también bloquea)
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={image.uncertainThreshold}
            onChange={(event) =>
              set((d) => void (d.moderation.image.uncertainThreshold = Number(event.target.value)))
            }
          />
        </label>
      </div>
      <fieldset>
        <legend>Categorías bloqueadas</legend>
        {BLOCK_CATEGORIES.map((category) => (
          <label key={category} className="ai-admin-toggle">
            <input
              type="checkbox"
              checked={image.blockedCategories.includes(category)}
              onChange={(event) =>
                set(
                  (d) =>
                    void (d.moderation.image.blockedCategories = toggle(
                      d.moderation.image.blockedCategories,
                      category,
                      event.target.checked,
                    )),
                )
              }
            />{" "}
            {CATEGORY_LABEL[category]}
          </label>
        ))}
      </fieldset>

      <h3>Textos</h3>
      <label className="ai-admin-toggle">
        <input
          type="checkbox"
          checked={text.enabled}
          onChange={(event) => set((d) => void (d.moderation.text.enabled = event.target.checked))}
        />{" "}
        Revisar nombres antes de compartirlos
      </label>
      <label>
        Conjunto de reglas
        <input
          value={text.ruleSet}
          onChange={(event) => set((d) => void (d.moderation.text.ruleSet = event.target.value))}
        />
      </label>
      <fieldset>
        <legend>Datos personales que se detectan</legend>
        {PII_PATTERNS.map((pattern) => (
          <label key={pattern} className="ai-admin-toggle">
            <input
              type="checkbox"
              checked={text.piiPatterns.includes(pattern)}
              onChange={(event) =>
                set(
                  (d) =>
                    void (d.moderation.text.piiPatterns = toggle(
                      d.moderation.text.piiPatterns,
                      pattern,
                      event.target.checked,
                    )),
                )
              }
            />{" "}
            {PII_LABEL[pattern]}
          </label>
        ))}
      </fieldset>
      <div className="ai-admin-grid">
        {(["es", "en"] as const).map((locale) => (
          <label key={locale}>
            Términos bloqueados ({locale}), uno por línea
            <textarea
              rows={4}
              value={text.blockedTerms[locale].join("\n")}
              onChange={(event) =>
                set(
                  (d) => void (d.moderation.text.blockedTerms[locale] = lines(event.target.value)),
                )
              }
            />
          </label>
        ))}
      </div>

      <h3>Cola de aprobación</h3>
      <label className="ai-admin-toggle">
        <input
          type="checkbox"
          checked={group.approvalQueue.holdAll}
          onChange={(event) => set((d) => void (d.approvalQueue.holdAll = event.target.checked))}
        />{" "}
        El organizador aprueba todo lo que se comparte
      </label>
      <label>
        Minutos que se guarda el motivo de un rechazo (nunca el contenido)
        <input
          type="number"
          min={0}
          max={60}
          value={group.approvalQueue.reasonRetentionMinutes}
          onChange={(event) =>
            set((d) => void (d.approvalQueue.reasonRetentionMinutes = Number(event.target.value)))
          }
        />
      </label>

      <h3>Reacciones</h3>
      {(["es", "en"] as const).map((locale) => (
        <fieldset key={locale}>
          <legend>Disponibles ({locale})</legend>
          {REACTIONS.map((reaction) => (
            <label key={reaction} className="ai-admin-toggle">
              <input
                type="checkbox"
                checked={group.reactions[locale].includes(reaction)}
                onChange={(event) =>
                  set(
                    (d) =>
                      void (d.reactions[locale] = toggle(
                        d.reactions[locale],
                        reaction,
                        event.target.checked,
                      )),
                  )
                }
              />{" "}
              {REACTION_LABEL[reaction]}
            </label>
          ))}
        </fieldset>
      ))}

      <h3>Límites</h3>
      <div className="ai-admin-grid">
        <label>
          Niños por grupo (1 a 4)
          <input
            type="number"
            min={1}
            max={4}
            value={group.limits.maxChildren}
            onChange={(event) =>
              set((d) => void (d.limits.maxChildren = Number(event.target.value)))
            }
          />
        </label>
        <label>
          Duración máxima de la sesión (min)
          <input
            type="number"
            min={15}
            max={240}
            value={group.limits.maxSessionMinutes}
            onChange={(event) =>
              set((d) => void (d.limits.maxSessionMinutes = Number(event.target.value)))
            }
          />
        </label>
        <label>
          Vida del código de ingreso (min)
          <input
            type="number"
            min={1}
            max={10}
            value={group.limits.joinCodeMinutes}
            onChange={(event) =>
              set((d) => void (d.limits.joinCodeMinutes = Number(event.target.value)))
            }
          />
        </label>
      </div>
      <label className="ai-admin-toggle">
        <input
          type="checkbox"
          checked={group.limits.relayEnabled}
          onChange={(event) => set((d) => void (d.limits.relayEnabled = event.target.checked))}
        />{" "}
        Permitir el servicio de apoyo de conexión (apagado por defecto; requiere revisión de
        privacidad)
      </label>
      <p className="ai-admin-footnote">
        Los secretos del servicio de apoyo (por ejemplo credenciales TURN) siguen en el servidor, no
        en esta pantalla.
      </p>
    </div>
  );
}
