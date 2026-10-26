import { useEffect, useMemo, useState } from "react";
import type { LearningEvidenceEvent } from "@agorix/learning-evidence";
import type { Locale } from "../../i18n.js";
import { fetchAdultAiHealth, type AdultAiHealth } from "../kidsAdultHealth.js";
import { AGE_BANDS } from "../kidsAgeBand.js";
import { setKidsV2Feature, useKidsFlag } from "../kidsFlags.js";
import { GroupPanel } from "../group/GroupPanel.js";
import { LinkPanel } from "../link/LinkPanel.js";
import { KidsImagesPanel } from "./KidsImagesPanel.js";
import { KidsAudioPanel } from "./KidsAudioPanel.js";
import { adultSummary, readTodaySeconds, type AdultSettings } from "../kidsAdults.js";
import {
  PIN_MAX_DIGITS,
  canKeepPin,
  checkPin,
  hasPin,
  makeChallenge,
  pinProblem,
  savePin,
} from "../kidsAdultPin.js";
import type { KidsProgress } from "../kidsProgress.js";
import { readKidsEvidenceEvents } from "../kidsEvidence.js";
import type { KidsText } from "../useKidsText.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly progress: KidsProgress;
  readonly settings: AdultSettings;
  readonly onSettings: (settings: AdultSettings) => void;
}

const COPY = {
  es: {
    gate: "Solo para adultos",
    question: "¿Cuánto es {a} × {b}?",
    check: "Comprobar",
    wrong: "Probá otra vez.",
    hint: "Esto mantiene los ajustes lejos de los más chicos.",
    pinCreate: "Elegí un PIN de adulto (4 a 6 números)",
    pinConfirm: "Repetí el PIN",
    pinEnter: "Ingresá tu PIN de adulto",
    pinForgot: "Me olvidé el PIN",
    pinLength: "Usá entre 4 y 6 números.",
    pinObvious: "Ese PIN es muy fácil de adivinar. Probá con otro.",
    pinMismatch: "No coinciden. Elegí el PIN de nuevo.",
    pinWrong: "PIN incorrecto. Intentos antes de esperar:",
    pinWait: "Esperá un momento antes de probar de nuevo:",
    pinSeconds: "segundos",
    pinKept: "El PIN se guarda solo en este dispositivo, nunca el número en sí.",
    exit: "Salir",
    today: "Tiempo de hoy",
    goal: "Meta diaria",
    minutes: "min",
    completed: "Misiones completadas",
    understanding: "Comprensión observada",
    observed: "Hay señales registradas",
    notObserved: "Todavía no hay evidencia suficiente",
    practice: "Conceptos practicados",
    world: "mundo",
    worlds: "mundos",
    decisions: "Decisiones sobre Ori",
    used: "usadas",
    changed: "cambiadas",
    rejected: "rechazadas",
    settings: "Ajustes",
    ori: "Ideas de Ori",
    oriNote: "Mostrar u ocultar a Ori y sus ideas",
    read: "Lectura en voz alta",
    readNote: "Activar los botones de escuchar",
    customImages: "Imágenes propias",
    customImagesNote: "Permitir que el niño agregue exploradores y fondos propios",
    ageBand: "Franja de edad",
    ageBandNote: "Ajusta la herramienta a la edad. Se guarda solo en este dispositivo.",
    ai: "Estado de la IA",
    provider: "Proveedor en uso",
    configured: "Configurado",
    available: "Disponible",
    lastError: "Última clase de error",
    none: "Ninguno",
    yes: "Sí",
    no: "No",
    deterministic: "Ayuda determinística",
    compatible: "Proveedor compatible",
    refresh: "Actualizar estado",
    privacy: "Privacidad",
    privacyNote:
      "No pedimos nombre, escuela ni ubicación. Los proyectos y el tiempo agregado quedan en este navegador. Las respuestas de reflexión no guardan texto ni caritas. No hay chat público.",
  },
  en: {
    gate: "Grown-ups only",
    question: "What is {a} × {b}?",
    check: "Check",
    wrong: "Try again.",
    hint: "This keeps settings away from little hands.",
    pinCreate: "Choose a grown-up PIN (4 to 6 numbers)",
    pinConfirm: "Repeat the PIN",
    pinEnter: "Enter your grown-up PIN",
    pinForgot: "I forgot the PIN",
    pinLength: "Use 4 to 6 numbers.",
    pinObvious: "That PIN is too easy to guess. Try another.",
    pinMismatch: "They do not match. Choose the PIN again.",
    pinWrong: "Wrong PIN. Tries before waiting:",
    pinWait: "Wait a moment before trying again:",
    pinSeconds: "seconds",
    pinKept: "The PIN stays on this device only, and never the number itself.",
    exit: "Exit",
    today: "Time today",
    goal: "Daily goal",
    minutes: "min",
    completed: "Missions completed",
    understanding: "Observed understanding",
    observed: "Evidence has been recorded",
    notObserved: "Not enough evidence yet",
    practice: "Concepts practised",
    world: "world",
    worlds: "worlds",
    decisions: "Decisions about Ori",
    used: "used",
    changed: "changed",
    rejected: "rejected",
    settings: "Settings",
    ori: "Ori's ideas",
    oriNote: "Show or hide Ori and its ideas",
    read: "Read aloud",
    readNote: "Enable the listen buttons",
    customImages: "Custom images",
    customImagesNote: "Let the child add custom explorers and backdrops",
    ageBand: "Age band",
    ageBandNote: "Matches the tool to the age. Stored only on this device.",
    ai: "AI status",
    provider: "Provider in use",
    configured: "Configured",
    available: "Available",
    lastError: "Last error class",
    none: "None",
    yes: "Yes",
    no: "No",
    deterministic: "Deterministic help",
    compatible: "Compatible provider",
    refresh: "Refresh status",
    privacy: "Privacy",
    privacyNote:
      "We do not ask for a name, school or location. Projects and aggregate time stay in this browser. Reflection answers keep no text or face choice. There is no public chat.",
  },
} as const;

export function ParentsScreen({ t, locale, progress, settings, onSettings }: Props) {
  const [digits, setDigits] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("");
  // Who is at the door: someone with a PIN, someone who must first solve the adult calculation to
  // start one, or a browser that cannot keep a PIN (it keeps only the calculation).
  const pinKept = useMemo(() => canKeepPin(), []);
  const [step, setStep] = useState<"enter" | "challenge" | "create" | "confirm">(() =>
    pinKept && hasPin() ? "enter" : "challenge",
  );
  const [challenge, setChallenge] = useState(() => makeChallenge());
  const [firstPin, setFirstPin] = useState("");
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  const [events, setEvents] = useState<readonly LearningEvidenceEvent[]>([]);
  const [health, setHealth] = useState<AdultAiHealth | null>(null);
  const copy = COPY[locale];
  const ageBandsEnabled = useKidsFlag("ageBands");
  const customImagesEnabled = useKidsFlag("customImages");
  const customAudioEnabled = useKidsFlag("customAudio");
  const adultLinkEnabled = useKidsFlag("adultLink");
  const groupModeEnabled = useKidsFlag("groupMode");

  useEffect(() => {
    if (!unlocked) return;
    const refresh = () => {
      setSeconds(readTodaySeconds());
      setEvents(readKidsEvidenceEvents());
    };
    refresh();
    const id = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(id);
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    void fetchAdultAiHealth().then(setHealth);
  }, [unlocked]);

  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [waitUntil]);
  // The wait applies to guessing the PIN; the fresh calculation to reset it is always available.
  const waiting = step === "enter" ? Math.max(0, Math.ceil((waitUntil - now) / 1000)) : 0;
  const secret = step !== "challenge";
  const limit = step === "challenge" ? 3 : PIN_MAX_DIGITS;

  async function submit() {
    const entered = digits;
    setDigits("");
    if (step === "challenge") {
      if (entered === challenge.answer) {
        setMessage("");
        if (pinKept) setStep("create");
        else setUnlocked(true);
      } else {
        setChallenge(makeChallenge());
        setMessage(copy.wrong);
      }
    } else if (step === "create") {
      const problem = pinProblem(entered);
      if (problem) setMessage(problem === "length" ? copy.pinLength : copy.pinObvious);
      else {
        setFirstPin(entered);
        setMessage("");
        setStep("confirm");
      }
    } else if (step === "confirm") {
      if (entered !== firstPin) {
        setFirstPin("");
        setMessage(copy.pinMismatch);
        setStep("create");
        return;
      }
      await savePin(entered);
      setMessage("");
      setUnlocked(true);
    } else {
      const result = await checkPin(entered, Date.now());
      if (result.status === "ok") {
        setMessage("");
        setUnlocked(true);
      } else if (result.status === "locked") {
        setWaitUntil(Date.now() + result.seconds * 1000);
        setNow(Date.now());
        setMessage("");
      } else setMessage(`${copy.pinWrong} ${result.triesBeforeWait}`);
    }
  }

  function press(label: string) {
    if (waiting > 0) return;
    if (label === "⌫") {
      setDigits((value) => value.slice(0, -1));
      setMessage("");
    } else if (label === "✓") {
      void submit();
    } else if (digits.length < limit) {
      setDigits((value) => value + label);
      setMessage("");
    }
  }

  const heading =
    step === "challenge"
      ? copy.question.replace("{a}", String(challenge.a)).replace("{b}", String(challenge.b))
      : step === "create"
        ? copy.pinCreate
        : step === "confirm"
          ? copy.pinConfirm
          : copy.pinEnter;

  if (!unlocked)
    return (
      <section className="kids-screen kids-parents-gate" aria-labelledby="kids-parents-title">
        <p className="kids-parents-kicker">🔒 {copy.gate}</p>
        <h1 id="kids-parents-title">{heading}</h1>
        <output className="kids-gate-display" aria-label={heading}>
          {digits ? (secret ? "•".repeat(digits.length) : digits) : "_ _"}
        </output>
        <div className="kids-gate-pad" role="group" aria-label={heading}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((label) => (
            <button
              key={label}
              type="button"
              disabled={waiting > 0}
              onClick={() => press(label)}
              aria-label={label === "✓" ? copy.check : label === "⌫" ? t("back") : label}
            >
              {label}
            </button>
          ))}
        </div>
        <p role="status" className="kids-note">
          {waiting > 0
            ? `${copy.pinWait} ${waiting} ${copy.pinSeconds}.`
            : message || (step === "create" || step === "confirm" ? copy.pinKept : copy.hint)}
        </p>
        {step === "enter" ? (
          <button
            type="button"
            className="kids-button"
            onClick={() => {
              setDigits("");
              setMessage("");
              setChallenge(makeChallenge());
              setStep("challenge");
            }}
          >
            {copy.pinForgot}
          </button>
        ) : null}
      </section>
    );

  const summary = adultSummary(progress, events);
  const minutes = Math.floor(seconds / 60);
  const percent = Math.min(100, Math.round((seconds / (settings.dailyLimitMinutes * 60)) * 100));
  const yesNo = (value: boolean) => (value ? copy.yes : copy.no);
  return (
    <section className="kids-screen kids-parents" aria-labelledby="kids-parents-title">
      <header className="kids-parents-header">
        <h1 id="kids-parents-title">{t("grownups")}</h1>
        <button
          className="kids-button"
          type="button"
          onClick={() => {
            setUnlocked(false);
            // Back at the door: with a PIN kept, ask for it; the old steps are forgotten.
            setStep(pinKept && hasPin() ? "enter" : "challenge");
            setChallenge(makeChallenge());
            setFirstPin("");
            setDigits("");
            setMessage("");
            setWaitUntil(0);
            setHealth(null);
          }}
        >
          🔒 {copy.exit}
        </button>
      </header>
      <div className="kids-adult-grid">
        <section className="kids-adult-card" aria-labelledby="kids-time-title">
          <h2 id="kids-time-title">{copy.today}</h2>
          <strong className="kids-adult-number">
            {minutes} / {settings.dailyLimitMinutes} {copy.minutes}
          </strong>
          <div
            className="kids-time-track"
            role="progressbar"
            aria-label={copy.today}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="kids-note">
            {copy.goal}: {settings.dailyLimitMinutes} {copy.minutes}
          </p>
        </section>
        <section className="kids-adult-card" aria-labelledby="kids-progress-title">
          <h2 id="kids-progress-title">{copy.completed}</h2>
          <strong className="kids-adult-number">{summary.completedMissions}</strong>
          <p>
            <strong>{copy.understanding}:</strong>{" "}
            {summary.understandingObserved ? copy.observed : copy.notObserved}
          </p>
        </section>
        <section className="kids-adult-card" aria-labelledby="kids-concepts-title">
          <h2 id="kids-concepts-title">{copy.practice}</h2>
          <ul className="kids-adult-concepts">
            {(["conceptSeq", "conceptTurn", "conceptLoop"] as const).map((key, index) => (
              <li key={key}>
                <span>{t(key)}</span>
                <strong>
                  {summary.practicedConcepts[index]}{" "}
                  {summary.practicedConcepts[index] === 1 ? copy.world : copy.worlds}
                </strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="kids-adult-card kids-adult-ai" aria-labelledby="kids-decisions-title">
          <h2 id="kids-decisions-title">{copy.decisions}</h2>
          <div className="kids-adult-decisions">
            {(["used", "changed", "rejected"] as const).map((key) => (
              <div key={key}>
                <strong>{summary.decisions[key]}</strong>
                <span>{copy[key]}</span>
              </div>
            ))}
          </div>
          <p className="kids-note">{t("aiNote")}</p>
        </section>
        <section className="kids-adult-card" aria-labelledby="kids-settings-title">
          <h2 id="kids-settings-title">{copy.settings}</h2>
          <button
            type="button"
            className="kids-adult-switch"
            role="switch"
            aria-checked={settings.oriSuggestions}
            onClick={() => onSettings({ ...settings, oriSuggestions: !settings.oriSuggestions })}
          >
            <span>
              <strong>{copy.ori}</strong>
              <small>{copy.oriNote}</small>
            </span>
            <i aria-hidden="true" />
          </button>
          <button
            type="button"
            className="kids-adult-switch"
            role="switch"
            aria-checked={settings.readAloud}
            onClick={() => onSettings({ ...settings, readAloud: !settings.readAloud })}
          >
            <span>
              <strong>{copy.read}</strong>
              <small>{copy.readNote}</small>
            </span>
            <i aria-hidden="true" />
          </button>
          <button
            type="button"
            className="kids-adult-switch"
            role="switch"
            aria-checked={customImagesEnabled}
            onClick={() => setKidsV2Feature("customImages", !customImagesEnabled)}
          >
            <span>
              <strong>{copy.customImages}</strong>
              <small>{copy.customImagesNote}</small>
            </span>
            <i aria-hidden="true" />
          </button>
          {ageBandsEnabled ? (
            <fieldset className="kids-adult-band">
              <legend>{copy.ageBand}</legend>
              <small>{copy.ageBandNote}</small>
              {AGE_BANDS.map((band) => (
                <label key={band}>
                  <input
                    type="radio"
                    name="kids-age-band"
                    value={band}
                    checked={settings.ageBand === band}
                    onChange={() => onSettings({ ...settings, ageBand: band })}
                  />{" "}
                  {band.replace("-", "–")}
                </label>
              ))}
            </fieldset>
          ) : null}
          <div className="kids-adult-limit">
            <span>{copy.goal}</span>
            <button
              type="button"
              aria-label={`${copy.goal} −`}
              disabled={settings.dailyLimitMinutes <= 10}
              onClick={() =>
                onSettings({ ...settings, dailyLimitMinutes: settings.dailyLimitMinutes - 5 })
              }
            >
              −
            </button>
            <strong>
              {settings.dailyLimitMinutes} {copy.minutes}
            </strong>
            <button
              type="button"
              aria-label={`${copy.goal} +`}
              disabled={settings.dailyLimitMinutes >= 120}
              onClick={() =>
                onSettings({ ...settings, dailyLimitMinutes: settings.dailyLimitMinutes + 5 })
              }
            >
              +
            </button>
          </div>
        </section>
        {adultLinkEnabled ? <LinkPanel locale={locale} /> : null}
        {adultLinkEnabled && groupModeEnabled ? <GroupPanel locale={locale} /> : null}
        <section className="kids-adult-card" aria-labelledby="kids-ai-title">
          <h2 id="kids-ai-title">{copy.ai}</h2>
          <dl className="kids-health-list">
            <div>
              <dt>{copy.provider}</dt>
              <dd>
                {health?.providerInUse === "codex"
                  ? "Codex"
                  : health?.providerInUse === "opencode"
                    ? "OpenCode"
                    : health?.providerInUse === "openai-compatible"
                      ? copy.compatible
                      : copy.deterministic}
              </dd>
            </div>
            <div>
              <dt>{copy.configured}</dt>
              <dd>{health ? yesNo(health.configured) : "…"}</dd>
            </div>
            <div>
              <dt>{copy.available}</dt>
              <dd>{health ? yesNo(health.available) : "…"}</dd>
            </div>
            <div>
              <dt>{copy.lastError}</dt>
              <dd>{health?.lastErrorClass ?? copy.none}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="kids-button"
            onClick={() => void fetchAdultAiHealth().then(setHealth)}
          >
            {copy.refresh}
          </button>
        </section>
        {customImagesEnabled ? <KidsImagesPanel locale={locale} t={t} /> : null}
        {customAudioEnabled ? <KidsAudioPanel t={t} locale={locale} /> : null}
      </div>
      <aside className="kids-adult-privacy">
        <strong>🔒 {copy.privacy}</strong>
        <p>{copy.privacyNote}</p>
      </aside>
    </section>
  );
}
