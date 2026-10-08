import * as vscode from "vscode";

/**
 * Localizes a user-facing message. The English text is the key, so `l10n/bundle.l10n.<locale>.json`
 * maps English to the translation. Placeholders are `{0}`, `{1}`. Falls back to the English text
 * (formatted) when `vscode.l10n` is unavailable, for example in unit tests.
 */
export function t(message: string, ...args: (string | number)[]): string {
  const l10n = localization();
  if (l10n !== undefined) {
    return l10n.t(message, ...args);
  }
  return message.replace(/\{(\d+)\}/g, (_match, index: string) =>
    String(args[Number(index)] ?? ""),
  );
}

type Localization = { t(message: string, ...args: (string | number)[]): string };

function localization(): Localization | undefined {
  try {
    return (vscode as { l10n?: Localization }).l10n;
  } catch {
    // Strict module mocks throw on a missing export instead of returning undefined.
    return undefined;
  }
}
