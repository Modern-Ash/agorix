import { POC_TOOLBOX, getBlockDefinition, type BlockType } from "@agorix/block-editor";
import { dragPayload } from "./drag.js";
import { copyFor, type StudioUiCopy } from "./i18n.js";

export function Palette({
  onAdd,
  copy = copyFor("en"),
}: {
  readonly onAdd: (blockType: BlockType) => void;
  readonly copy?: StudioUiCopy;
}) {
  return (
    <nav className="palette" aria-label={copy.blocksLabel}>
      {POC_TOOLBOX.flatMap((section) => section.blocks)
        .filter((block) => getBlockDefinition(block.type)?.placement !== "trigger")
        .map((block) => {
          const canInsertInScript = block.placement === "statement";
          const blockLabels: Readonly<Record<string, string>> = copy.blockLabels;
          const blockAccessibleNames: Readonly<Record<string, string>> = copy.blockAccessibleNames;
          const label = blockLabels[block.type] ?? block.label;
          const accessibleName = blockAccessibleNames[block.type] ?? block.accessibleName;
          return (
            <button
              key={block.type}
              type="button"
              disabled={!canInsertInScript}
              draggable={canInsertInScript}
              title={canInsertInScript ? accessibleName : copy.insertionReason}
              aria-label={
                canInsertInScript ? accessibleName : `${accessibleName}. ${copy.insertionReason}`
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
              {label}
            </button>
          );
        })}
    </nav>
  );
}
