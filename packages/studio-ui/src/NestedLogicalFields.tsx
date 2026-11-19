import type { DragEvent } from "react";
import { getBlockDefinition, type BlockNode, type StatementLocation } from "@agorix/block-editor";
import { STUDIO_LOGICAL_OPERAND_TYPES, type Intent } from "@agorix/interaction-core";
import { MAX_NESTING_DEPTH } from "@agorix/program-model";
import type { ActorView } from "@agorix/studio-protocol";
import { parseDragPayload } from "./drag.js";
import type { StudioUiCopy } from "./i18n.js";

type Side = "left" | "right" | "value";

export function NestedLogicalFields({
  condition,
  path,
  location,
  actors,
  copy,
  onIntent,
}: {
  readonly condition: BlockNode;
  /** Path from the root condition to this logical operator. */
  readonly path: readonly Side[];
  readonly location: StatementLocation;
  readonly actors: readonly ActorView[];
  readonly copy: StudioUiCopy;
  readonly onIntent: (intent: Intent) => void;
}) {
  if (path.length >= MAX_NESTING_DEPTH) return null;
  const sides: readonly Side[] = condition.type === "operator_not" ? ["value"] : ["left", "right"];
  return (
    <span className="nested-logical-fields">
      {sides.map((side) => {
        const operand = condition.inputs?.[side];
        if (operand === undefined) return null;
        const replace = (blockType: (typeof STUDIO_LOGICAL_OPERAND_TYPES)[number]) =>
          onIntent({
            type: "setLogicalOperand",
            location,
            path,
            side,
            blockType,
            ...(blockType === "sensing_touching_actor" && actors[0] !== undefined
              ? { actorId: actors[0].id }
              : {}),
          });
        const onDrop = (event: DragEvent<HTMLElement>) => {
          event.preventDefault();
          event.stopPropagation();
          const source = parseDragPayload(event.dataTransfer.getData("application/x-agorix-drag"));
          if (
            source?.kind === "palette" &&
            (STUDIO_LOGICAL_OPERAND_TYPES as readonly string[]).includes(source.blockType)
          )
            replace(source.blockType as (typeof STUDIO_LOGICAL_OPERAND_TYPES)[number]);
        };
        const nested = ["operator_and", "operator_or", "operator_not"].includes(operand.type);
        const label = `${copy.condition}: ${path.join(" ")} ${side}`.trim();
        return (
          <span
            key={side}
            className="block-field nested-logical-socket"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
          >
            <label>
              <span>
                {side === "left"
                  ? copy.conditionLeft
                  : side === "right"
                    ? copy.conditionRight
                    : copy.conditionValue}
              </span>
              <select
                aria-label={`${label} ${copy.numericSource}`}
                value={
                  (STUDIO_LOGICAL_OPERAND_TYPES as readonly string[]).includes(operand.type)
                    ? operand.type
                    : "other"
                }
                onChange={(event) =>
                  replace(
                    event.currentTarget.value as (typeof STUDIO_LOGICAL_OPERAND_TYPES)[number],
                  )
                }
                onKeyDown={(event) => event.stopPropagation()}
              >
                {STUDIO_LOGICAL_OPERAND_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {getBlockDefinition(type)?.label ?? type}
                  </option>
                ))}
                {(STUDIO_LOGICAL_OPERAND_TYPES as readonly string[]).includes(
                  operand.type,
                ) ? null : (
                  <option value="other">
                    {getBlockDefinition(operand.type)?.label ?? operand.type}
                  </option>
                )}
              </select>
            </label>
            {operand.type === "literal_boolean" ? (
              <label>
                <span>{copy.conditionValue}</span>
                <select
                  aria-label={`${label} ${copy.conditionValue}`}
                  value={String(operand.fields?.value === true)}
                  onChange={(event) =>
                    onIntent({
                      type: "setLogicalBoolean",
                      location,
                      path,
                      side,
                      value: event.currentTarget.value === "true",
                    })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <option value="true">{copy.trueLabel}</option>
                  <option value="false">{copy.falseLabel}</option>
                </select>
              </label>
            ) : null}
            {operand.type === "sensing_touching_actor" ? (
              <label>
                <span>{copy.conditionActor}</span>
                <select
                  aria-label={`${label} ${copy.conditionActor}`}
                  value={String(operand.fields?.actorId ?? "")}
                  onChange={(event) =>
                    onIntent({
                      type: "setLogicalActor",
                      location,
                      path,
                      side,
                      actorId: event.currentTarget.value,
                    })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {nested ? (
              <details open={path.length < 2}>
                <summary>{getBlockDefinition(operand.type)?.label ?? operand.type}</summary>
                <NestedLogicalFields
                  condition={operand}
                  path={[...path, side]}
                  location={location}
                  actors={actors}
                  copy={copy}
                  onIntent={onIntent}
                />
              </details>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
