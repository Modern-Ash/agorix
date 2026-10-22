/** Fills `{name}` placeholders (the prototype's `fmt`). Missing values become an empty string. */
export function kidsFormat(
  template: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ""));
}
