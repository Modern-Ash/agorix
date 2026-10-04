import { POC_TOOLBOX, getBlockDefinition, type BlockType } from "@agorix/block-editor";
import { dragPayload } from "./drag.js";

export function Palette({ onAdd }: { readonly onAdd: (blockType: BlockType) => void }) {
  return (
    <nav className="palette" aria-label="Blocks">
      {POC_TOOLBOX.flatMap((section) => section.blocks)
        .filter((block) => getBlockDefinition(block.type)?.placement !== "trigger")
        .map((block) => (
          <button
            key={block.type}
            type="button"
            draggable
            aria-label={block.accessibleName}
            onClick={() => onAdd(block.type)}
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "application/x-agorix-drag",
                dragPayload({ kind: "palette", blockType: block.type }),
              );
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            {block.label}
          </button>
        ))}
    </nav>
  );
}
