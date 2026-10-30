/**
 * Block categories of the free-scene palette, in the order the redesign shows them (issue #1110).
 * The jump bar lists them; each one points at its heading in the palette, which stays whole.
 */
export type StudioCategory =
  | "motion"
  | "looks"
  | "media"
  | "logic"
  | "pen"
  | "music"
  | "data"
  | "myBlocks";

const ORDER: readonly StudioCategory[] = [
  "motion",
  "looks",
  "media",
  "logic",
  "pen",
  "music",
  "data",
  "myBlocks",
];

/** The categories this child sees: Pen and Music only while a grown-up keeps their pack on. */
export function studioCategories(pack: {
  readonly pen: boolean;
  readonly music: boolean;
}): readonly StudioCategory[] {
  return ORDER.filter(
    (category) => (category !== "pen" || pack.pen) && (category !== "music" || pack.music),
  );
}

export const studioCategoryId = (category: StudioCategory) => `kids-studio-cat-${category}`;
