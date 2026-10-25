import type { Procedure } from "./schema.js";

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
