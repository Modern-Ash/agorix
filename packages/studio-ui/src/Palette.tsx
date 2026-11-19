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
import { numericReporterForBlock } from "./numericPalette.js";

function sectionLabel(name: string, copy: StudioUiCopy): string {
  if (name === "Move") return copy.paletteMotion;
  if (name === "Looks") return copy.paletteLooks;
  if (name === "Repeat & Decide") return copy.paletteControl;
  if (name === "Check") return copy.paletteSensing;
  if (name === "Lists") return copy.lists;
  return name;
}

function searchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchesPaletteBlockSearch(
  query: string,
  block: { readonly type: string; readonly label: string; readonly accessibleName: string },
  section: string,
  copy: StudioUiCopy,
): boolean {
  const needle = searchText(query.trim());
  if (!needle) return true;
  const labels: Readonly<Record<string, string>> = copy.blockLabels;
  const accessibleNames: Readonly<Record<string, string>> = copy.blockAccessibleNames;
  return searchText(
    [block.label, block.accessibleName, labels[block.type], accessibleNames[block.type], section]
      .filter(Boolean)
      .join(" "),
  ).includes(needle);
}

export function Palette({
  copy = copyFor("en"),
  onAdd,
  onSelectExpression,
  selectedExpression,
  onSelectNumeric,
  selectedNumeric,
  hasLists = false,
  hasVariables = false,
  hasActors = false,
  hasProcedures = false,
  sectionFilter,
}: {
  readonly copy?: StudioUiCopy;
  readonly onAdd: (blockType: BlockType) => void;
  readonly onSelectExpression?: (blockType: BlockType) => void;
  readonly selectedExpression?: BlockType | undefined;
  readonly onSelectNumeric?: (blockType: BlockType) => void;
  readonly selectedNumeric?: BlockType | undefined;
  readonly hasLists?: boolean;
  readonly hasVariables?: boolean;
  readonly hasActors?: boolean;
  readonly hasProcedures?: boolean;
  readonly sectionFilter?: string | undefined;
}) {
  const [query, setQuery] = useState("");
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
          blocks: [
            ...section.blocks,
            ...POC_BLOCK_DEFINITIONS.filter(
              (definition) => definition.studioOnly && definition.section === section.name,
            ),
          ]
            .filter((block) => getBlockDefinition(block.type)?.placement !== "trigger")
            .filter((block) => hasLists || !block.type.startsWith("lists_"))
            .filter((block) => hasVariables || block.type !== "variables_value")
            .filter((block) => hasActors || block.type !== "sensing_distance_to_actor")
            .filter((block) => hasProcedures || block.type !== "procedures_call")
            .filter(
              (block) =>
                STUDIO_INSERTABLE_STATEMENTS.includes(block.type) ||
                (STUDIO_CONDITION_BLOCK_TYPES as readonly string[]).includes(block.type) ||
                numericReporterForBlock(block.type) !== undefined,
            )
            .filter((block) =>
              matchesPaletteBlockSearch(query, block, sectionLabel(section.name, copy), copy),
            ),
        }))
        .filter(
          (section) =>
            section.blocks.length > 0 && (!sectionFilter || section.name === sectionFilter),
        ),
    [copy, query, hasLists, hasVariables, hasActors, hasProcedures, sectionFilter],
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
      {sections.length === 0 && query.trim() ? <p role="status">{copy.paletteNoMatches}</p> : null}
      {sections.map((section) => (
        <section key={section.name} className="palette-section">
          <h2>{section.name}</h2>
          {section.blocks.map((block) => {
            const visual = visualBlock(block.type);
            const canInsertInScript = block.placement === "statement";
            const canUseAsCondition = (STUDIO_CONDITION_BLOCK_TYPES as readonly string[]).includes(
              block.type,
            );
            const canUseAsNumber = numericReporterForBlock(block.type) !== undefined;
            const enabled = canInsertInScript || canUseAsCondition || canUseAsNumber;
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
                aria-pressed={
                  canUseAsCondition
                    ? selectedExpression === block.type
                    : canUseAsNumber
                      ? selectedNumeric === block.type
                      : undefined
                }
                title={
                  canInsertInScript
                    ? accessibleName
                    : canUseAsCondition
                      ? `${accessibleName}: ${copy.condition}`
                      : canUseAsNumber
                        ? `${accessibleName}: ${copy.placeValue}`
                        : copy.paletteNestedOnly
                }
                aria-label={
                  enabled ? accessibleName : `${accessibleName}. ${copy.paletteNestedOnly}`
                }
                onClick={() => {
                  if (canInsertInScript) onAdd(block.type);
                  else if (canUseAsCondition) onSelectExpression?.(block.type);
                  else if (canUseAsNumber) onSelectNumeric?.(block.type);
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
