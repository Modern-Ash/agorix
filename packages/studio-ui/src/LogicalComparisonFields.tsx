import type { BlockNode, BlockWorkspaceSnapshot, StatementLocation } from "@agorix/block-editor";
import { STUDIO_COMPARISON_OPERAND_SOURCES, type Intent } from "@agorix/interaction-core";
import type { ActorView } from "@agorix/studio-protocol";
import type { StudioUiCopy } from "./i18n.js";

/** Direct controls for the numeric sources of one comparison nested in And/Or/Not. */
export function LogicalComparisonFields({
  comparison,
  side,
  path,
  location,
  workspace,
  actors,
  copy,
  onIntent,
  pos,
  isTabbable,
}: {
  readonly comparison: BlockNode;
  readonly side: "left" | "right" | "value";
  readonly path?: readonly ("left" | "right" | "value")[];
  readonly location: StatementLocation;
  readonly workspace: BlockWorkspaceSnapshot;
  readonly actors: readonly ActorView[];
  readonly copy: StudioUiCopy;
  readonly onIntent: (intent: Intent) => void;
  readonly pos: string;
  readonly isTabbable: boolean;
}) {
  return (
    <span className="logical-comparison-fields">
      {(["left", "right"] as const).map((operandSide) => {
        const numeric = comparison.inputs?.[operandSide];
        if (numeric === undefined || Array.isArray(numeric)) return null;
        const source =
          numeric.type === "literal_number"
            ? "number"
            : numeric.type === "variables_value"
              ? "variable"
              : numeric.type === "lists_length"
                ? "listLength"
                : numeric.type === "lists_item"
                  ? "listItem"
                  : numeric.type === "sensing_x_position"
                    ? "xPosition"
                    : numeric.type === "sensing_y_position"
                      ? "yPosition"
                      : numeric.type === "sensing_distance_to_actor"
                        ? "distanceToActor"
                        : numeric.type === "operator_random_integer"
                          ? "randomInteger"
                          : numeric.type === "operator_math_function"
                            ? "mathFunction"
                            : "other";
        const label = operandSide === "left" ? copy.conditionLeft : copy.conditionRight;
        const referenceId =
          source === "variable"
            ? numeric.fields?.variableId
            : source === "distanceToActor"
              ? numeric.fields?.actorId
              : numeric.fields?.listId;
        const choose = (
          next: (typeof STUDIO_COMPARISON_OPERAND_SOURCES)[number],
          reference?: string,
        ) =>
          onIntent({
            type: "setLogicalComparisonSource",
            location,
            side,
            ...(path === undefined ? {} : { path }),
            operand: operandSide,
            source: next,
            ...(reference === undefined ? {} : { referenceId: reference }),
          });
        const references =
          source === "variable"
            ? (workspace.variables ?? [])
            : source === "distanceToActor"
              ? actors
              : (workspace.lists ?? []);
        return (
          <span key={operandSide} className="block-field logical-comparison-operand">
            <label>
              <span>{label}</span>
              <select
                aria-label={`${copy.condition}: ${side} ${label} ${copy.numericSource}`}
                value={source}
                onChange={(event) => {
                  const next = event.currentTarget
                    .value as (typeof STUDIO_COMPARISON_OPERAND_SOURCES)[number];
                  choose(
                    next,
                    next === "variable"
                      ? workspace.variables?.[0]?.id
                      : next === "listLength" || next === "listItem"
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
                {workspace.lists?.length ? (
                  <option value="listLength">{copy.listLength}</option>
                ) : null}
                {workspace.lists?.length ? <option value="listItem">{copy.listItem}</option> : null}
                <option value="xPosition">{copy.positionX}</option>
                <option value="yPosition">{copy.positionY}</option>
                {actors.length ? (
                  <option value="distanceToActor">{copy.distanceToActor}</option>
                ) : null}
                <option value="randomInteger">{copy.operatorRandomInteger}</option>
                <option value="mathFunction">{copy.operatorMathFunction}</option>
                {source === "other" ? <option value="other">{numeric.type}</option> : null}
              </select>
            </label>
            {source === "variable" ||
            source === "listLength" ||
            source === "listItem" ||
            source === "distanceToActor" ? (
              <label>
                <span>
                  {source === "distanceToActor" ? copy.conditionActor : copy.numericReference}
                </span>
                <select
                  aria-label={`${copy.condition}: ${side} ${label} ${source === "distanceToActor" ? copy.conditionActor : copy.numericReference}`}
                  value={String(referenceId ?? "")}
                  onChange={(event) => choose(source, event.currentTarget.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {references.some((entry) => entry.id === referenceId) ? null : (
                    <option value={String(referenceId ?? "")}>{String(referenceId ?? "")}</option>
                  )}
                  {references.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {source === "mathFunction" ? (
              <label>
                <span>{copy.mathFunction}</span>
                <select
                  aria-label={`${copy.condition}: ${side} ${label} ${copy.mathFunction}`}
                  value={String(numeric.fields?.function ?? "abs")}
                  onChange={(event) =>
                    onIntent({
                      type: "setComparisonMathFunction",
                      location,
                      logicalSide: side,
                      ...(path === undefined ? {} : { path }),
                      side: operandSide,
                      function: event.currentTarget.value as "abs" | "round" | "floor" | "ceiling",
                    })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <option value="abs">{copy.mathAbs}</option>
                  <option value="round">{copy.mathRound}</option>
                  <option value="floor">{copy.mathFloor}</option>
                  <option value="ceiling">{copy.mathCeiling}</option>
                </select>
              </label>
            ) : null}
            {source === "number" ||
            source === "listItem" ||
            source === "randomInteger" ||
            source === "mathFunction"
              ? (source === "number"
                  ? (["value"] as const)
                  : source === "listItem"
                    ? (["index"] as const)
                    : source === "mathFunction"
                      ? (["value"] as const)
                      : (["min", "max"] as const)
                ).map((field) => {
                  const literal =
                    field === "value" && source === "number" ? numeric : numeric.inputs?.[field];
                  if (
                    literal === undefined ||
                    Array.isArray(literal) ||
                    literal.type !== "literal_number" ||
                    typeof literal.fields?.value !== "number"
                  )
                    return null;
                  const fieldLabel =
                    field === "value"
                      ? source === "mathFunction"
                        ? copy.mathValue
                        : label
                      : field === "index"
                        ? copy.listIndex
                        : field === "min"
                          ? copy.rangeMin
                          : copy.rangeMax;
                  return (
                    <label key={field}>
                      <span>{fieldLabel}</span>
                      <input
                        key={`${pos}:${path?.join(".") ?? ""}:${side}:${operandSide}:${field}:${literal.fields.value}`}
                        type="number"
                        tabIndex={isTabbable ? 0 : -1}
                        aria-label={`${copy.condition}: ${side} ${fieldLabel}`}
                        defaultValue={literal.fields.value}
                        draggable={false}
                        onDragStart={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        onBlur={(event) => {
                          const raw = event.currentTarget.value.trim();
                          const next = Number(raw);
                          if (
                            raw !== "" &&
                            Number.isFinite(next) &&
                            next !== literal.fields?.value
                          ) {
                            onIntent(
                              field === "value" && source === "number"
                                ? {
                                    type: "setLogicalComparisonNumber",
                                    location,
                                    side,
                                    ...(path === undefined ? {} : { path }),
                                    operand: operandSide,
                                    value: next,
                                  }
                                : {
                                    type: "setLogicalComparisonNestedNumber",
                                    location,
                                    side,
                                    ...(path === undefined ? {} : { path }),
                                    operand: operandSide,
                                    field,
                                    value: next,
                                  },
                            );
                          }
                          event.currentTarget.value = String(literal.fields?.value);
                        }}
                      />
                    </label>
                  );
                })
              : null}
          </span>
        );
      })}
    </span>
  );
}
