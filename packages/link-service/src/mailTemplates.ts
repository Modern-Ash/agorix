import type { MailMessage } from "./types.js";

export interface RenderedMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/**
 * Bilingual plain text (Spanish first): a message does not know the adult's language. The verify link
 * carries the one-time token; the "email in use" notice never carries anything secret.
 */
export function renderMail(message: MailMessage, publicOrigin: string): RenderedMail {
  const origin = publicOrigin.replace(/\/+$/, "");
  if (message.kind === "verify-email") {
    const link = `${origin}/kids?verify=${encodeURIComponent(message.token)}`;
    return {
      to: message.to,
      subject: "Confirmá tu correo en Agorix / Confirm your email on Agorix",
      text: [
        "Hola,",
        "",
        "Para confirmar tu correo y poder vincular un dispositivo en Agorix, abrí este enlace (sirve una sola vez y vence en 24 horas):",
        link,
        "",
        "Si no fuiste vos, ignorá este mensaje: no pasa nada.",
        "",
        "—",
        "",
        "Hello,",
        "",
        "To confirm your email and link a device on Agorix, open this link (it works once and expires in 24 hours):",
        link,
        "",
        "If this was not you, ignore this message: nothing will happen.",
        "",
      ].join("\r\n"),
    };
  }
  return {
    to: message.to,
    subject: "Alguien intentó usar tu correo en Agorix / Someone tried to use your email on Agorix",
    text: [
      "Hola,",
      "",
      "Alguien intentó crear o cambiar una cuenta de Agorix con este correo, pero ya está en uso. Si fuiste vos, entrá con tu usuario y contraseña. Si no, ignorá este mensaje.",
      "",
      "—",
      "",
      "Hello,",
      "",
      "Someone tried to create or change an Agorix account with this email, but it is already in use. If it was you, sign in with your username and password. If not, ignore this message.",
      "",
    ].join("\r\n"),
  };
}
