import type { DragEvent } from "react";
import {
  getBlockDefinition,
  type BlockNode,
  type BlockWorkspaceSnapshot,
  type StatementLocation,
} from "@agorix/block-editor";
import { type Intent } from "@agorix/interaction-core";
import { MAX_NESTING_DEPTH } from "@agorix/program-model";
import type { ActorView } from "@agorix/studio-protocol";
import { parseDragPayload } from "./drag.js";
import type { StudioUiCopy } from "./i18n.js";
import { numericReporterForBlock } from "./numericPalette.js";

type Side = "left" | "right" | "min" | "max" | "value";
type NestedSource =
  | "number"
  | "variable"
  | "listLength"
  | "xPosition"
  | "yPosition"
  | "distanceToActor"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "modulo"
  | "random"
  | "randomInteger"
  | "mathFunction";

const SOURCES: readonly NestedSource[] = [
  "number",
  "variable",
  "listLength",
  "xPosition",
  "yPosition",
  "distanceToActor",
  "add",
  "subtract",
  "multiply",
  "divide",
  "modulo",
  "random",
  "randomInteger",
  "mathFunction",
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
  workspace,
  actors,
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
  readonly workspace: BlockWorkspaceSnapshot;
  readonly actors: readonly ActorView[];
  readonly onIntent: (intent: Intent) => void;
}) {
  if (node === undefined) return null;
  const source = numericReporterForBlock(node.type);
  const selectedSource =
    source !== undefined && SOURCES.includes(source as NestedSource) ? source : "other";
  const canEdit = path.length < MAX_NESTING_DEPTH;
  const canReplace = canEdit && side !== "value";
  const ariaPath = `${label}: ${operandLabel} ${[rootSideLabel, ...path.slice(1), side].join(" ")}`;
  const choose = (reporter: NestedSource, referenceId?: string) => {
    if (!canReplace) return;
    onIntent({
      type: "setArithmeticOperandSource",
      location,
      input,
      path,
      side,
      reporter,
      ...(referenceId === undefined ? {} : { referenceId }),
    });
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = parseDragPayload(event.dataTransfer.getData("application/x-agorix-drag"));
    if (payload?.kind !== "palette") return;
    const reporter = numericReporterForBlock(payload.blockType);
    if (reporter !== undefined && SOURCES.includes(reporter as NestedSource))
      choose(
        reporter as NestedSource,
        reporter === "variable"
          ? workspace.variables?.[0]?.id
          : reporter === "listLength"
            ? workspace.lists?.[0]?.id
            : reporter === "distanceToActor"
              ? actors[0]?.id
              : undefined,
      );
  };
  const children = operandSides(node);
  const referenceChoices =
    selectedSource === "variable"
      ? workspace.variables
      : selectedSource === "listLength"
        ? workspace.lists
        : selectedSource === "distanceToActor"
          ? actors
          : undefined;
  const selectedReference =
    selectedSource === "variable"
      ? node.fields?.variableId
      : selectedSource === "listLength"
        ? node.fields?.listId
        : node.fields?.actorId;
  const content = (
    <>
      {canReplace ? (
        <select
          aria-label={`${ariaPath} ${copy.numericSource}`}
          value={selectedSource}
          onChange={(event) => {
            const next = event.currentTarget.value as NestedSource;
            choose(
              next,
              next === "variable"
                ? workspace.variables?.[0]?.id
                : next === "listLength"
                  ? workspace.lists?.[0]?.id
                  : next === "distanceToActor"
                    ? actors[0]?.id
                    : undefined,
            );
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <option value="number">{copy.numericLiteral}</option>
          {workspace.variables?.length ? (
            <option value="variable">{copy.variableValue}</option>
          ) : null}
          {workspace.lists?.length ? <option value="listLength">{copy.listLength}</option> : null}
          <option value="xPosition">{copy.positionX}</option>
          <option value="yPosition">{copy.positionY}</option>
          {actors.length ? <option value="distanceToActor">{copy.distanceToActor}</option> : null}
          <option value="add">{copy.operatorAdd}</option>
          <option value="subtract">{copy.operatorSubtract}</option>
          <option value="multiply">{copy.operatorMultiply}</option>
          <option value="divide">{copy.operatorDivide}</option>
          <option value="modulo">{copy.operatorModulo}</option>
          <option value="random">{copy.operatorRandom}</option>
          <option value="randomInteger">{copy.operatorRandomInteger}</option>
          <option value="mathFunction">{copy.operatorMathFunction}</option>
          {selectedSource === "other" ? (
            <option value="other">{getBlockDefinition(node.type)?.label ?? node.type}</option>
          ) : null}
        </select>
      ) : null}
      {referenceChoices !== undefined && canReplace ? (
        <select
          aria-label={`${ariaPath} ${copy.numericReference}`}
          value={String(selectedReference ?? "")}
          onChange={(event) =>
            choose(
              selectedSource as "variable" | "listLength" | "distanceToActor",
              event.currentTarget.value,
            )
          }
          onKeyDown={(event) => event.stopPropagation()}
        >
          {referenceChoices.some((choice) => choice.id === selectedReference) ? null : (
            <option value={String(selectedReference ?? "")}>
              {String(selectedReference ?? "")}
            </option>
          )}
          {referenceChoices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.name}
            </option>
          ))}
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
              workspace={workspace}
              actors={actors}
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
