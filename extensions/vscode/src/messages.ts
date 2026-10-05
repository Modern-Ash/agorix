/** Marks a static user-facing string for localization; returns it unchanged. The consumer calls `t()`. */
export function msg(text: string): string {
  return text;
}
