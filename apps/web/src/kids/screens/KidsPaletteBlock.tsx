import type { ReactNode } from "react";

/** Block-shaped palette tools. Only the two basic categories are migrated in this pilot. */
export type KidsPaletteTone = "looks" | "motion";

export interface KidsPaletteAction {
  readonly label: string;
  readonly onAdd: () => void;
  readonly disabled?: boolean;
}

/**
 * One snap-together block in the free-scene palette.
 *
 * The block is a group, not a button: a native button adds the block and native values
 * (selects, inputs) stay inside the same shape. That keeps the keyboard path and the
 * closed value lists while the visible form row disappears. Grouping two actions
 * (`say`/`think`, `move`/`move backward`, `turn left`/`turn right`) shares one value
 * slot, as the old form did.
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
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="kids-palette-tool-add"
            data-kids-add="true"
            data-kids-add-label={action.label}
            disabled={action.disabled ?? false}
            onClick={action.onAdd}
          >
            <span className="kids-visually-hidden">+ </span>
            {action.label}
          </button>
        ))}
      </span>
      {children === undefined ? null : <span className="kids-palette-tool-slots">{children}</span>}
    </div>
  );
}
