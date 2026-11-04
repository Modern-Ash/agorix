/**
 * Conservative, fail-closed output guard for the early Ori MVP.
 * A heuristic is NOT a complete child-safety classifier. Only short
 * pedagogical questions pass; all other output uses deterministic fallback.
 */
const PERSONAL = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\+?\d[\d .()-]{8,}\d)\b|\b(?:nombre completo|domicilio|direcci[oó]n|tel[eé]fono|contrase(?:ñ|n)a|password|correo personal)\b)/i;
const CODE = /(?:```|[{};]|\b(?:function|console\.log|import\s|class\s|def\s|print\s*\(|while\s*\(|for\s*\(|if\s*\()\b)/i;
const SPOILER = /\b(?:soluci[oó]n (?:es|completa)|agreg[aá] (?:exactamente|estos)|pon[eé] (?:exactamente|estos)|mover\s+\d+|repetir\s+\d+|ya (?:lo )?(?:resolv[ií]|ejecut[eé])(?:\b|\s+tu)|prob[eé] (?:tu|el) programa|lleg[oó] a la meta)\b/i;
const UNSAFE = /\b(?:suicid|autolesi[oó]n|pornograf|arma|violencia|odio|secreto entre nosotros|no le digas a tus padres)\b/i;
const MARKUP = /<[^>]+>|https?:\/\/|www\.|\[[^\]]+\]\([^)]+\)/i;
export function validatePedagogicalHint(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > 180 || text.split(/\s+/).length > 25) return null;
  if (/[\r\n]/.test(text) || PERSONAL.test(text) || CODE.test(text) ||
      SPOILER.test(text) || UNSAFE.test(text) || MARKUP.test(text)) return null;
  if (!text.endsWith("?") && !text.endsWith("¿")) return null;
  if (!text.includes("¿")) return null;
  return text;
}
