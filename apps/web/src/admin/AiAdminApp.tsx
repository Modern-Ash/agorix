import { useEffect, useState } from "react";
import "@fontsource/epilogue/700.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "./aiAdmin.css";
import { GroupSettings, type GroupConfig } from "./GroupSettings.js";

type Capability = "mission" | "advanced" | "studio" | "chat" | "goals" | "legacy";
type Policy = {
  enabled: boolean;
  provider: string;
  model: string;
  timeoutMs: number;
  requestsPerMinute: number;
  promptTemplate: string;
  fallback: "deterministic";
};
type Config = { schema: string; capabilities: Record<Capability, Policy>; group?: GroupConfig };
type Section = Capability | "group";
type Revision = {
  revision: number;
  author: string;
  createdAt: string;
  action: string;
  sourceRevision: number | null;
  config: Config;
};
type History = Omit<Revision, "config">;
const names: Record<Capability, string> = {
  mission: "Ori en misiones",
  advanced: "Ori avanzado",
  studio: "Ori en escenas",
  chat: "Conversación",
  goals: "Objetivos",
  legacy: "Tutor clásico",
};
const keys = Object.keys(names) as Capability[];
const sectionNames: Record<Section, string> = { ...names, group: "Modo grupo" };

async function api<T>(path: string, method = "GET", body?: unknown, csrf?: string): Promise<T> {
  const response = await fetch(`/api/tutor/admin/${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(csrf ? { "x-agorix-admin-csrf": csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
    throw new Error(error.error?.code ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function AiAdminApp() {
  const [csrf, setCsrf] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState<Revision | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [section, setSection] = useState<Section>("mission");
  const selected: Capability = section === "group" ? "mission" : section;
  const [preview, setPreview] = useState<Section[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reload() {
    const data = await api<{ current: Revision; history: History[] }>("config");
    setCurrent(data.current);
    setDraft(structuredClone(data.current.config));
    setHistory(data.history);
    setPreview(null);
  }
  useEffect(() => {
    void api<{ csrf: string }>("session")
      .then((session) => {
        setCsrf(session.csrf);
        return reload();
      })
      .catch(() => {});
  }, []);
  async function action(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la operación.");
    } finally {
      setBusy(false);
    }
  }
  function edit(patch: Partial<Policy>) {
    if (!draft) return;
    setDraft({
      ...draft,
      capabilities: {
        ...draft.capabilities,
        [selected]: { ...draft.capabilities[selected], ...patch },
      },
    });
    setPreview(null);
  }
  const changed =
    current && draft ? JSON.stringify(current.config) !== JSON.stringify(draft) : false;

  return (
    <main className="ai-admin">
      <header className="ai-admin-header">
        <div className="ai-admin-mark">
          A<span>✦</span>
        </div>
        <div>
          <p className="ai-admin-kicker">AGORIX / OPERACIONES</p>
          <h1>Centro de IA</h1>
        </div>
        <button className="ai-admin-back" onClick={() => window.location.assign("/")}>
          Volver a Agorix ↗
        </button>
      </header>
      {!csrf ? (
        <section className="ai-admin-login">
          <p className="ai-admin-kicker">ACCESO INDEPENDIENTE</p>
          <h2>Configurar a Ori</h2>
          <p>
            Ingresá con la clave de administración. La cuenta de adulto no habilita esta consola.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                const session = await api<{ csrf: string }>("session", "POST", { password });
                setPassword("");
                setCsrf(session.csrf);
                await reload();
              });
            }}
          >
            <label htmlFor="admin-password">Clave de administración</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button disabled={busy}>Ingresar</button>
          </form>
          {message && <p role="alert">{message}</p>}
        </section>
      ) : (
        <div className="ai-admin-layout">
          <aside className="ai-admin-side">
            <p className="ai-admin-kicker">CAPACIDADES</p>
            <nav aria-label="Capacidades de IA">
              {keys.map((key) => (
                <button
                  key={key}
                  className={section === key ? "selected" : ""}
                  onClick={() => setSection(key)}
                >
                  <span>{names[key]}</span>
                  <small>{draft?.capabilities[key].enabled ? "Activa" : "En pausa"}</small>
                </button>
              ))}
              {draft?.group && (
                <button
                  className={section === "group" ? "selected" : ""}
                  onClick={() => setSection("group")}
                >
                  <span>{sectionNames.group}</span>
                  <small>Sala compartida</small>
                </button>
              )}
            </nav>
            <button
              className="ai-admin-logout"
              onClick={() =>
                void action(async () => {
                  await api("session", "DELETE", undefined, csrf);
                  setCsrf(null);
                  setCurrent(null);
                  setDraft(null);
                })
              }
            >
              Cerrar sesión
            </button>
          </aside>
          <section className="ai-admin-workspace">
            <div className="ai-admin-heading">
              <div>
                <p className="ai-admin-kicker">
                  REVISIÓN {current?.revision ?? "—"} · {current?.author ?? ""}
                </p>
                <h2>{sectionNames[section]}</h2>
              </div>
              {section !== "group" && (
                <span className="ai-admin-status">
                  {draft?.capabilities[selected].enabled ? "● Disponible" : "○ En pausa"}
                </span>
              )}
            </div>
            {draft && section === "group" && draft.group && (
              <GroupSettings
                group={draft.group}
                onChange={(group) => {
                  setDraft({ ...draft, group });
                  setPreview(null);
                }}
              />
            )}
            {draft && section !== "group" && (
              <div className="ai-admin-card">
                <p className="ai-admin-note">
                  Los cambios quedan en borrador hasta que los revises y publiques. La clave del
                  proveedor permanece en el servidor.
                </p>
                <label className="ai-admin-toggle">
                  <input
                    type="checkbox"
                    checked={draft.capabilities[selected].enabled}
                    onChange={(event) => edit({ enabled: event.target.checked })}
                  />{" "}
                  Disponible para estudiantes
                </label>
                <div className="ai-admin-grid">
                  <label>
                    Proveedor
                    <select
                      value={draft.capabilities[selected].provider}
                      onChange={(event) => edit({ provider: event.target.value })}
                    >
                      {(selected === "legacy"
                        ? ["fake", "openai-compatible", "disabled"]
                        : ["auto", "codex", "opencode", "disabled"]
                      ).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modelo
                    <input
                      value={draft.capabilities[selected].model}
                      onChange={(event) => edit({ model: event.target.value })}
                    />
                  </label>
                  <label>
                    Tiempo máximo (ms)
                    <input
                      type="number"
                      min={500}
                      max={7000}
                      value={draft.capabilities[selected].timeoutMs}
                      onChange={(event) => edit({ timeoutMs: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    Solicitudes por minuto
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={draft.capabilities[selected].requestsPerMinute}
                      onChange={(event) => edit({ requestsPerMinute: Number(event.target.value) })}
                    />
                  </label>
                </div>
                <label>
                  Instrucción adicional
                  <textarea
                    maxLength={2000}
                    rows={5}
                    value={draft.capabilities[selected].promptTemplate}
                    onChange={(event) => edit({ promptTemplate: event.target.value })}
                    placeholder="Instrucción pedagógica opcional…"
                  />
                </label>
                <p className="ai-admin-footnote">
                  Ante un fallo, Agorix usa la respuesta determinista. Las reglas de seguridad y
                  autoría siguen vigentes.
                </p>
              </div>
            )}
            <div className="ai-admin-actions">
              <button
                disabled={!changed || busy || !current || !draft}
                onClick={() =>
                  void action(async () => {
                    const result = await api<{ changed: Section[] }>(
                      "preview",
                      "POST",
                      { expectedRevision: current!.revision, config: draft },
                      csrf,
                    );
                    setPreview(result.changed);
                    setMessage("Revisión válida. Podés publicar los cambios.");
                  })
                }
              >
                Validar cambios
              </button>
              <button
                className="primary"
                disabled={!changed || !preview || busy || !current || !draft}
                onClick={() =>
                  void action(async () => {
                    await api(
                      "publish",
                      "POST",
                      { expectedRevision: current!.revision, config: draft },
                      csrf,
                    );
                    await reload();
                    setMessage("Configuración publicada.");
                  })
                }
              >
                Publicar revisión
              </button>
              <button
                disabled={!changed || busy}
                onClick={() => {
                  if (current) setDraft(structuredClone(current.config));
                  setPreview(null);
                }}
              >
                Descartar
              </button>
            </div>
            {preview && (
              <p className="ai-admin-preview">
                Impacta: {preview.map((key) => sectionNames[key]).join(", ") || "sin diferencias"}
              </p>
            )}
            {message && (
              <p className="ai-admin-message" role="status">
                {message}
              </p>
            )}
            <section className="ai-admin-history">
              <h3>Historial</h3>
              <p>Cada publicación queda registrada. Restaurar crea una revisión nueva.</p>
              <ol>
                {history.map((entry) => (
                  <li key={entry.revision}>
                    <div>
                      <strong>#{entry.revision}</strong> · {entry.action} · {entry.author}
                      <small>{new Date(entry.createdAt).toLocaleString("es-AR")}</small>
                    </div>
                    <button
                      disabled={busy || entry.revision === current?.revision}
                      onClick={() => {
                        if (!window.confirm(`¿Restaurar la revisión ${entry.revision}?`)) return;
                        void action(async () => {
                          await api(
                            "rollback",
                            "POST",
                            { expectedRevision: current!.revision, sourceRevision: entry.revision },
                            csrf,
                          );
                          await reload();
                          setMessage(`Revisión ${entry.revision} restaurada.`);
                        });
                      }}
                    >
                      Restaurar
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </section>
        </div>
      )}
    </main>
  );
}
