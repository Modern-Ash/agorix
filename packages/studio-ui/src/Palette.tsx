import { useMemo, useState } from "react";
import {
  POC_BLOCK_DEFINITIONS,
  POC_TOOLBOX,
  getBlockDefinition,
  type BlockType,
} from "@agorix/block-editor";
import { dragPayload } from "./drag.js";
import { STUDIO_CONDITION_BLOCK_TYPES } from "@agorix/interaction-core";
import { STUDIO_INSERTABLE_STATEMENTS } from "@agorix/studio-protocol";
import { copyFor, type StudioUiCopy } from "./i18n.js";
import { visualBlock, visualLabel } from "./visualBlocks.js";

function sectionLabel(name: string, copy: StudioUiCopy): string {
  if (name === "Move") return copy.paletteMotion;
  if (name === "Repeat & Decide") return copy.paletteControl;
  if (name === "Check") return copy.paletteSensing;
  if (name === "Lists") return copy.lists;
  return name;
}

export function Palette({
  copy = copyFor("en"),
  onAdd,
  onSelectExpression,
  selectedExpression,
  hasLists = false,
}: {
  readonly copy?: StudioUiCopy;
  readonly onAdd: (blockType: BlockType) => void;
  readonly onSelectExpression?: (blockType: BlockType) => void;
  readonly selectedExpression?: BlockType | undefined;
  readonly hasLists?: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      [
        ...POC_TOOLBOX,
        {
          name: "Lists" as const,
          blocks: POC_BLOCK_DEFINITIONS.filter((definition) => definition.section === "Lists"),
        },
      ]
        .map((section) => ({
          name: sectionLabel(section.name, copy),
          blocks: section.blocks
            .filter((block) => getBlockDefinition(block.type)?.placement !== "trigger")
            .filter((block) => hasLists || !block.type.startsWith("lists_"))
            .filter(
              (block) =>
                STUDIO_INSERTABLE_STATEMENTS.includes(block.type) ||
                (STUDIO_CONDITION_BLOCK_TYPES as readonly string[]).includes(block.type),
            )
            .filter((block) =>
              normalizedQuery.length === 0
                ? true
                : `${block.label} ${block.accessibleName} ${section.name}`
                    .toLowerCase()
                    .includes(normalizedQuery),
            ),
        }))
        .filter((section) => section.blocks.length > 0),
    [copy, normalizedQuery, hasLists],
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
            const visual = visualBlock(block.type);
            const canInsertInScript = block.placement === "statement";
            const canUseAsCondition = (STUDIO_CONDITION_BLOCK_TYPES as readonly string[]).includes(
              block.type,
            );
            const enabled = canInsertInScript || canUseAsCondition;
            const labels: Readonly<Record<string, string>> = copy.blockLabels;
            const accessibleNames: Readonly<Record<string, string>> = copy.blockAccessibleNames;
            const label = labels[block.type] ?? block.label;
            const accessibleName = accessibleNames[block.type] ?? block.accessibleName;
            return (
              <button
                key={block.type}
                data-tone={visual.tone}
                data-shape={visual.shape}
                type="button"
                disabled={!enabled}
                draggable={enabled}
                aria-pressed={canUseAsCondition ? selectedExpression === block.type : undefined}
                title={
                  canInsertInScript
                    ? accessibleName
                    : canUseAsCondition
                      ? `${accessibleName}: ${copy.condition}`
                      : copy.paletteNestedOnly
                }
                aria-label={
                  enabled ? accessibleName : `${accessibleName}. ${copy.paletteNestedOnly}`
                }
                onClick={() => {
                  if (canInsertInScript) onAdd(block.type);
                  else if (canUseAsCondition) onSelectExpression?.(block.type);
                }}
                onDragStart={(event) => {
                  if (!enabled) return;
                  event.dataTransfer.setData(
                    "application/x-agorix-drag",
                    dragPayload({ kind: "palette", blockType: block.type }),
                  );
                  event.dataTransfer.effectAllowed = "copy";
                }}
              >
                <span className="palette-grip" aria-hidden="true" />
                <span className="palette-block-label">{visualLabel(label)}</span>
                <span className="palette-block-symbol" aria-hidden="true">
                  {visual.shape === "container" ? "⌄" : visual.shape === "reporter" ? "◈" : "▸"}
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </nav>
  );
}
