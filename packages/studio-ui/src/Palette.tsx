import { useMemo, useState } from "react";
import { POC_TOOLBOX, getBlockDefinition, type BlockType } from "@agorix/block-editor";
import { dragPayload } from "./drag.js";
import { copyFor, type StudioUiCopy } from "./i18n.js";

function sectionLabel(name: string, copy: StudioUiCopy): string {
  if (name === "Move") return copy.paletteMotion;
  if (name === "Repeat & Decide") return copy.paletteControl;
  if (name === "Check") return copy.paletteSensing;
  return name;
}

export function Palette({
  copy = copyFor("en"),
  onAdd,
}: {
  readonly copy?: StudioUiCopy;
  readonly onAdd: (blockType: BlockType) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      POC_TOOLBOX.map((section) => ({
        name: sectionLabel(section.name, copy),
        blocks: section.blocks
          .filter((block) => getBlockDefinition(block.type)?.placement !== "trigger")
          .filter((block) =>
            normalizedQuery.length === 0
              ? true
              : `${block.label} ${block.accessibleName} ${section.name}`
                  .toLowerCase()
                  .includes(normalizedQuery),
          ),
      })).filter((section) => section.blocks.length > 0),
    [copy, normalizedQuery],
  );
  return (
    <nav className="palette" aria-label={copy.paletteBlocks}>
      <label className="palette-search">
        <span>{copy.paletteSearch}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      {sections.map((section) => (
        <section key={section.name} className="palette-section">
          <h2>{section.name}</h2>
          {section.blocks.map((block) => {
            const canInsertInScript = block.placement === "statement";
            const labels: Readonly<Record<string, string>> = copy.blockLabels;
            const accessibleNames: Readonly<Record<string, string>> = copy.blockAccessibleNames;
            const label = labels[block.type] ?? block.label;
            const accessibleName = accessibleNames[block.type] ?? block.accessibleName;
            return (
              <button
                key={block.type}
                type="button"
                disabled={!canInsertInScript}
                draggable={canInsertInScript}
                title={canInsertInScript ? accessibleName : copy.paletteNestedOnly}
                aria-label={
                  canInsertInScript
                    ? accessibleName
                    : `${accessibleName}. ${copy.paletteNestedOnly}`
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
        </section>
      ))}
    </nav>
  );
}
