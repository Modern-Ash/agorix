import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Issue #597: child-facing Spanish uses voseo ("Tocá", "Elegí"), never the "tú" imperative.
// "Cuenta" is left out on purpose: it is also the noun for an account.
const TUTEO_IMPERATIVES = [
  "Agrega",
  "Añade",
  "Arrastra",
  "Avanza",
  "Borra",
  "Cambia",
  "Combina",
  "Completa",
  "Continúa",
  "Dibuja",
  "Elige",
  "Escribe",
  "Fíjate",
  "Gira",
  "Guarda",
  "Haz",
  "Intenta",
  "Llega",
  "Mira",
  "Mueve",
  "Pon",
  "Prueba",
  "Pulsa",
  "Recuerda",
  "Revisa",
  "Selecciona",
  "Sigue",
  "Suelta",
  "Toca",
  "Usa",
  "Vuelve",
];
const TUTEO_FORMS = ["tienes", "puedes", "quieres", "sabes", "piensas", "necesitas", "prefieres"];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/** Spanish string literals: a sentence start is a capital after a quote, a full stop or "¿¡". */
function findings(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const match of text.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
    const literal = match[2] ?? "";
    if (!/[áéíóúñ¿¡]|\b(el|la|los|las|tu|tus|de|que|para|con)\b/.test(literal)) continue;
    for (const word of TUTEO_IMPERATIVES) {
      if (new RegExp(`(^|[.!?¿¡:]\\s*)${word}\\b`, "i").test(literal))
        out.push(`${word}: ${literal}`);
    }
    for (const form of TUTEO_FORMS) {
      if (new RegExp(`\\b${form}\\b`).test(literal)) out.push(`${form}: ${literal}`);
    }
  }
  return out;
}

describe("child-facing Spanish copy", () => {
  it("uses voseo and never the tuteo imperative or verb forms", () => {
    const root = resolve(__dirname, "../../../..");
    const files = [
      ...sources(join(root, "apps/web/src/kids")),
      ...sources(join(root, "packages/curriculum/src")),
    ];
    const bad = files.flatMap((file) =>
      findings(file).map((entry) => `${file.slice(root.length + 1)} — ${entry.slice(0, 110)}`),
    );
    expect(bad).toEqual([]);
  });
});
