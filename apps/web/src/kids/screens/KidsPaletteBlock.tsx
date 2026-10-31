import type { ReactNode } from "react";
import type { StudioBlockKind } from "../kidsPaletteCatalog.js";

/** Block-shaped palette tools. Looks, Motion, Media and Logic are migrated. */
export type KidsPaletteTone = "looks" | "motion" | "sound" | "control";

export interface KidsPaletteAction {
  readonly label: string;
  readonly onAdd: () => void;
  /** The engine block this action adds, so the palette can be checked against the catalog (#1133). */
  readonly block?: StudioBlockKind;
  readonly disabled?: boolean;
  /**
   * `add` (the default) adds a block and can start a drag. `tool` shares the block's
   * values but does not add anything (sound preview, group the last blocks), so it must
   * stay out of the drag path.
   */
  readonly kind?: "add" | "tool";
}

/**
 * One snap-together block in the free-scene palette.
 *
 * The block is a group, not a button: a native button adds the block and native values
 * (selects, inputs) stay inside the same shape. That keeps the keyboard path and the
 * closed value lists while the visible form row disappears. Actions that share a value
 * slot (`say`/`think`, `move`/`move backward`, sound preview/play, repeat/group) live in
 * the same block, as the old form did.
 */
export function KidsPaletteBlock({
  actions,
  tone,
  children,
}: {
  readonly actions: readonly KidsPaletteAction[];
  readonly tone: KidsPaletteTone;
  readonly children?: ReactNode;
}) {
  return (
    <div className={`kids-palette-tool kids-palette-tool-${tone}`} data-kids-palette-tool={tone}>
      <span className="kids-palette-tool-actions">
        {actions.map((action) => {
          const adds = action.kind !== "tool";
          return (
            <button
              key={action.label}
              type="button"
              className="kids-palette-tool-add"
              data-kids-palette-action={adds ? "add" : "tool"}
              data-kids-block={adds ? action.block : undefined}
              data-kids-add={adds ? "true" : undefined}
              data-kids-add-label={adds ? action.label : undefined}
              disabled={action.disabled ?? false}
              onClick={action.onAdd}
            >
              {adds ? <span className="kids-visually-hidden">+ </span> : null}
              {action.label}
            </button>
          );
        })}
      </span>
      {children === undefined ? null : <span className="kids-palette-tool-slots">{children}</span>}
    </div>
  );
}
