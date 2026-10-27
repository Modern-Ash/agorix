import { bumpIndicator } from "../kidsIndicators.js";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ORI_CHAT_FALLBACK, ORI_CHAT_MAX_CHARS, isOriChatReply } from "@agorix/ori-agent";
import type { KidsCell } from "@agorix/curriculum";
import type { ProjectProgram } from "@agorix/program-model";
import { ORI_BROWSER_TIMEOUT_MS } from "../oriRequestBudget.js";

interface Props {
  readonly locale: "es" | "en";
  readonly missionId: string;
  readonly goalCell?: KidsCell | undefined;
  readonly program: ProjectProgram;
}

export function KidsOriChat({ locale, missionId, goalCell, program }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function close() {
    request.current?.abort();
    request.current = null;
    setPending(false);
    setText("");
    setAnswer("");
    setOpen(false);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = text.trim();
    if (!submitted || pending) return;
    const controller = new AbortController();
    request.current = controller;
    setText("");
    setAnswer("");
    setPending(true);
    const timer = setTimeout(() => controller.abort(), ORI_BROWSER_TIMEOUT_MS);
    try {
      const response = await fetch("/api/tutor/chat", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          missionId,
          locale,
          text: submitted,
          program,
          ...(goalCell ? { goalCell } : {}),
        }),
      });
      if (!response.ok) throw new Error("chat unavailable");
      const raw: unknown = await response.json();
      const message =
        raw &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        Object.keys(raw).join(",") === "message"
          ? (raw as { message: unknown }).message
          : undefined;
      if (!isOriChatReply(message, locale)) throw new Error("unsafe reply");
      if (request.current === controller) setAnswer(message);
    } catch {
      if (request.current === controller) {
        bumpIndicator("chatFallbacks");
        setAnswer(ORI_CHAT_FALLBACK[locale]);
      }
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }

  return (
    <aside
      className="kids-ori-chat"
      aria-label={locale === "es" ? "Chat con Ori" : "Chat with Ori"}
    >
      <div className="kids-ori-chat-heading">
        <strong>✦ Ori</strong>
        <button type="button" className="kids-button" onClick={open ? close : () => setOpen(true)}>
          {open
            ? locale === "es"
              ? "Cerrar chat"
              : "Close chat"
            : locale === "es"
              ? "Preguntale a Ori"
              : "Ask Ori"}
        </button>
      </div>
      {open ? (
        <>
          <p className="kids-note">
            {locale === "es"
              ? "Preguntá sobre tus bloques, la meta o Agorix. El chat se borra al salir."
              : "Ask about blocks, your goal, or Agorix. Chat clears when you leave."}
          </p>
          <form onSubmit={(event) => void send(event)} className="kids-ori-chat-form">
            <label htmlFor="kids-ori-chat-input">
              {locale === "es" ? "Tu pregunta" : "Your question"}
            </label>
            <input
              id="kids-ori-chat-input"
              value={text}
              maxLength={ORI_CHAT_MAX_CHARS}
              autoComplete="off"
              onChange={(event) => setText(event.target.value)}
              disabled={pending}
            />
            <button
              type="submit"
              className="kids-button kids-primary"
              disabled={pending || !text.trim()}
            >
              {locale === "es" ? "Enviar" : "Send"}
            </button>
          </form>
          <p role="status" aria-live="polite">
            {pending ? (locale === "es" ? "Ori piensa…" : "Ori is thinking…") : answer}
          </p>
        </>
      ) : null}
    </aside>
  );
}
