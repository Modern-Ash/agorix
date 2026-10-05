import { POC_TOOLBOX, getBlockDefinition, type BlockType } from "@agorix/block-editor";
import { dragPayload } from "./drag.js";

const INSERTION_REASON = "This block fits inside another block, not directly in the script.";

export function Palette({ onAdd }: { readonly onAdd: (blockType: BlockType) => void }) {
  return (
    <nav className="palette" aria-label="Blocks">
      {POC_TOOLBOX.flatMap((section) => section.blocks)
        .filter((block) => getBlockDefinition(block.type)?.placement !== "trigger")
        .map((block) => {
          const canInsertInScript = block.placement === "statement";
          return (
            <button
              key={block.type}
              type="button"
              disabled={!canInsertInScript}
              draggable={canInsertInScript}
              title={canInsertInScript ? block.accessibleName : INSERTION_REASON}
              aria-label={
                canInsertInScript
                  ? block.accessibleName
                  : `${block.accessibleName}. ${INSERTION_REASON}`
              }
              onClick={() => {
                if (canInsertInScript) onAdd(block.type);
              }}
              onDragStart={(event) => {
                if (!canInsertInScript) return;
                event.dataTransfer.setData(
                  "application/x-agorix-drag",
                  dragPayload({ kind: "palette", blockType: block.type }),
                );
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              {block.label}
            </button>
          );
        })}
    </nav>
  );
}
