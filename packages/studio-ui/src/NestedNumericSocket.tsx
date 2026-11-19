import type { DragEvent } from "react";
import { getBlockDefinition, type BlockNode, type StatementLocation } from "@agorix/block-editor";
import { type Intent } from "@agorix/interaction-core";
import { MAX_NESTING_DEPTH } from "@agorix/program-model";
import { parseDragPayload } from "./drag.js";
import type { StudioUiCopy } from "./i18n.js";
import { numericReporterForBlock } from "./numericPalette.js";

type Side = "left" | "right" | "min" | "max" | "value";
type NestedSource =
  "number" | "add" | "subtract" | "multiply" | "divide" | "modulo" | "random" | "randomInteger";

const SOURCES: readonly NestedSource[] = [
  "number",
  "add",
  "subtract",
  "multiply",
  "divide",
  "modulo",
  "random",
  "randomInteger",
];

function operandSides(node: BlockNode): readonly Side[] {
  if (node.type === "operator_random" || node.type === "operator_random_integer")
    return ["min", "max"];
  if (node.type === "operator_math_function") return ["value"];
  if (
    [
      "operator_add",
      "operator_subtract",
      "operator_multiply",
      "operator_divide",
      "operator_modulo",
    ].includes(node.type)
  )
    return ["left", "right"];
  return [];
}

export function NestedNumericSocket({
  node,
  side,
  path,
  location,
  input,
  label,
  operandLabel,
  rootSideLabel,
  copy,
  onIntent,
}: {
  readonly node: BlockNode | undefined;
  readonly side: Side;
  /** Sides traversed from the root expression to this socket's parent. */
  readonly path: readonly Side[];
  readonly location: StatementLocation;
  readonly input: "value" | "delta" | "index";
  readonly label: string;
  readonly operandLabel: string;
  readonly rootSideLabel: string;
  readonly copy: StudioUiCopy;
  readonly onIntent: (intent: Intent) => void;
}) {
  if (node === undefined) return null;
  const source = numericReporterForBlock(node.type);
  const selectedSource =
    source !== undefined && SOURCES.includes(source as NestedSource) ? source : "other";
  const canEdit = path.length < MAX_NESTING_DEPTH;
  const canReplace = canEdit && side !== "value";
  const ariaPath = `${label}: ${operandLabel} ${[rootSideLabel, ...path.slice(1), side].join(" ")}`;
  const choose = (reporter: NestedSource) => {
    if (!canReplace) return;
    onIntent({
      type: "setArithmeticOperandSource",
      location,
      input,
      path,
      side,
      reporter,
    });
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = parseDragPayload(event.dataTransfer.getData("application/x-agorix-drag"));
    if (payload?.kind !== "palette") return;
    const reporter = numericReporterForBlock(payload.blockType);
    if (reporter !== undefined && SOURCES.includes(reporter as NestedSource))
      choose(reporter as NestedSource);
  };
  const children = operandSides(node);
  const content = (
    <>
      {canReplace ? (
        <select
          aria-label={`${ariaPath} ${copy.numericSource}`}
          value={selectedSource}
          onChange={(event) => choose(event.currentTarget.value as NestedSource)}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <option value="number">{copy.numericLiteral}</option>
          <option value="add">{copy.operatorAdd}</option>
          <option value="subtract">{copy.operatorSubtract}</option>
          <option value="multiply">{copy.operatorMultiply}</option>
          <option value="divide">{copy.operatorDivide}</option>
          <option value="modulo">{copy.operatorModulo}</option>
          <option value="random">{copy.operatorRandom}</option>
          <option value="randomInteger">{copy.operatorRandomInteger}</option>
          {selectedSource === "other" ? (
            <option value="other">{getBlockDefinition(node.type)?.label ?? node.type}</option>
          ) : null}
        </select>
      ) : null}
      {node.type === "literal_number" && typeof node.fields?.value === "number" && canEdit ? (
        <input
          key={`${node.id}:${node.fields.value}`}
          type="number"
          aria-label={ariaPath}
          defaultValue={node.fields.value}
          draggable={false}
          onDragStart={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onBlur={(event) => {
            const raw = event.currentTarget.value.trim();
            const next = Number(raw);
            if (raw !== "" && Number.isFinite(next) && next !== node.fields?.value)
              onIntent({ type: "setArithmeticOperand", location, input, path, side, value: next });
            event.currentTarget.value = String(node.fields?.value);
          }}
        />
      ) : null}
      {children.length > 0 && canEdit ? (
        <div className="numeric-nested-children">
          {children.map((childSide) => (
            <NestedNumericSocket
              key={childSide}
              node={node.inputs?.[childSide]}
              side={childSide}
              path={[...path, side]}
              location={location}
              input={input}
              label={label}
              operandLabel={operandLabel}
              rootSideLabel={rootSideLabel}
              copy={copy}
              onIntent={onIntent}
            />
          ))}
        </div>
      ) : null}
    </>
  );
  const title = getBlockDefinition(node.type)?.label ?? node.type;
  return (
    <span
      className="block-field numeric-nested-socket"
      onDragOver={canReplace ? (event) => event.preventDefault() : undefined}
      onDrop={canReplace ? onDrop : undefined}
    >
      {children.length > 0 && path.length >= 2 ? (
        <details>
          <summary>{title}</summary>
          {content}
        </details>
      ) : (
        <>
          <span>{node.type === "literal_number" ? side : title}</span>
          {content}
        </>
      )}
    </span>
  );
}
