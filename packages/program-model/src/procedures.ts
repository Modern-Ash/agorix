import type { Procedure, ProcedureParam } from "./schema.js";

/**
 * Stable ASCII identifiers for a script's custom blocks, shared by every code
 * projection. The "my_" prefix keeps a child's name from colliding with a
 * language keyword, and a repeated name gets a numeric suffix.
 */
export function procedureIdentifiers(procedures: readonly Procedure[]): string[] {
  const used = new Set<string>();
  return procedures.map((procedure, index) => {
    const words = procedure.name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const base = words === "" ? `my_block_${index + 1}` : `my_${words}`;
    let candidate = base;
    for (let n = 2; used.has(candidate); n += 1) candidate = `${base}_${n}`;
    used.add(candidate);
    return candidate;
  });
}

/**
 * Identifiers for a custom block's numbers in generated code: `n_<title>`, accents and symbols
 * removed, a repeated title suffixed. The prefix keeps a child's title from becoming a keyword.
 */
export function paramIdentifiers(params: readonly ProcedureParam[]): string[] {
  const used = new Set<string>();
  return params.map((param, index) => {
    const words = param.name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const base = words === "" ? `n_${index + 1}` : `n_${words}`;
    let candidate = base;
    for (let n = 2; used.has(candidate); n += 1) candidate = `${base}_${n}`;
    used.add(candidate);
    return candidate;
  });
}
