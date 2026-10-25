type Env = Readonly<Record<string, string | undefined>>;

/**
 * Reads the optional closed-group settings (issue #566). Empty values count as unset so a compose
 * file can pass them through. The feature needs the adult link (verified email) and is off by
 * default; a half configuration fails at startup instead of silently serving nothing.
 */
export function readGroupConfig(env: Env, linkEnabled: boolean): { readonly secret?: string } {
  const secret = env["AGORIX_GROUP_SECRET"] || undefined;
  if (secret === undefined) return {};
  if (secret.length < 32) throw new Error("AGORIX_GROUP_SECRET must be at least 32 characters");
  if (!linkEnabled) {
    throw new Error(
      "AGORIX_GROUP_SECRET requires AGORIX_LINK_SECRET (organizers need a verified email)",
    );
  }
  return { secret };
}
