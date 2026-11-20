import {
  PROCEDURE_BODY_MAX,
  PROCEDURE_PARAMETERS_MAX,
  PROCEDURES_MAX_PER_SCRIPT,
} from "./limits.js";
import type { ProjectProgram, Statement } from "./schema.js";
import { validateProgram } from "./validate.js";

const NAME = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,19}$/u;

export type ProcedureEdit =
  | {
      readonly type: "create";
      readonly scriptIndex: number;
      readonly name: string;
      readonly count: number;
      readonly id: string;
    }
  | {
      readonly type: "rename";
      readonly scriptIndex: number;
      readonly procedureId: string;
      readonly name: string;
    }
  | {
      readonly type: "delete";
      readonly scriptIndex: number;
      readonly procedureId: string;
      readonly inlineCalls: boolean;
    }
  | {
      readonly type: "addParameter";
      readonly scriptIndex: number;
      readonly procedureId: string;
      readonly id: string;
      readonly name: string;
    }
  | {
      readonly type: "removeParameter";
      readonly scriptIndex: number;
      readonly procedureId: string;
      readonly parameterId: string;
    };

function mapCalls(
  statements: readonly Statement[],
  procedureId: string,
  transform: (call: Extract<Statement, { type: "callProcedure" }>) => Statement,
): Statement[] {
  return statements.map((statement) => {
    if (statement.type === "callProcedure" && statement.procedureId === procedureId)
      return transform(statement);
    if (statement.type === "repeat" || statement.type === "repeatUntil")
      return { ...statement, body: mapCalls(statement.body, procedureId, transform) };
    if (statement.type === "if")
      return {
        ...statement,
        then: mapCalls(statement.then, procedureId, transform),
        ...(statement.else === undefined
          ? {}
          : { else: mapCalls(statement.else, procedureId, transform) }),
      };
    return statement;
  });
}

function containsCall(statements: readonly Statement[], procedureId: string): boolean {
  return statements.some((statement) => {
    if (statement.type === "callProcedure") return statement.procedureId === procedureId;
    if (statement.type === "repeat" || statement.type === "repeatUntil")
      return containsCall(statement.body, procedureId);
    if (statement.type === "if")
      return (
        containsCall(statement.then, procedureId) || containsCall(statement.else ?? [], procedureId)
      );
    return false;
  });
}

function inlineCalls(
  statements: readonly Statement[],
  procedureId: string,
  body: readonly Statement[],
): Statement[] {
  return statements.flatMap((statement): Statement[] => {
    if (statement.type === "callProcedure" && statement.procedureId === procedureId)
      return structuredClone(body) as Statement[];
    if (statement.type === "repeat" || statement.type === "repeatUntil")
      return [{ ...statement, body: inlineCalls(statement.body, procedureId, body) }];
    if (statement.type === "if")
      return [
        {
          ...statement,
          then: inlineCalls(statement.then, procedureId, body),
          ...(statement.else === undefined
            ? {}
            : { else: inlineCalls(statement.else, procedureId, body) }),
        },
      ];
    return [statement];
  });
}

/** One learner-visible, atomic edit. Rejected edits leave the input untouched. */
export function editProgramProcedure(program: ProjectProgram, edit: ProcedureEdit): ProjectProgram {
  const script = program.scripts[edit.scriptIndex];
  if (script === undefined) throw new RangeError("unknown script");
  const procedures = script.procedures ?? [];
  if (edit.type === "create") {
    if (
      !NAME.test(edit.name) ||
      !Number.isInteger(edit.count) ||
      edit.count < 1 ||
      edit.count > PROCEDURE_BODY_MAX ||
      edit.count > script.statements.length ||
      procedures.length >= PROCEDURES_MAX_PER_SCRIPT ||
      procedures.some((procedure) => procedure.name.toLowerCase() === edit.name.toLowerCase())
    )
      throw new RangeError("invalid custom block");
    const body = script.statements.slice(-edit.count);
    const candidate = {
      ...script,
      statements: [
        ...script.statements.slice(0, -edit.count),
        { type: "callProcedure", procedureId: edit.id } as const,
      ],
      procedures: [...procedures, { id: edit.id, name: edit.name, body }],
    };
    return validateProgram({
      ...program,
      scripts: program.scripts.map((item, index) =>
        index === edit.scriptIndex ? candidate : item,
      ),
    });
  }
  const procedure = procedures.find((item) => item.id === edit.procedureId);
  if (procedure === undefined) throw new RangeError("unknown custom block");
  if (edit.type === "addParameter" || edit.type === "removeParameter") {
    const parameters = procedure.parameters ?? [];
    if (
      edit.type === "addParameter" &&
      (parameters.length >= PROCEDURE_PARAMETERS_MAX ||
        !NAME.test(edit.name) ||
        parameters.some((item) => item.name.toLowerCase() === edit.name.toLowerCase()))
    )
      throw new RangeError("invalid parameter");
    const index =
      edit.type === "removeParameter"
        ? parameters.findIndex((item) => item.id === edit.parameterId)
        : -1;
    if (edit.type === "removeParameter" && index < 0) throw new RangeError("unknown parameter");
    const nextProcedures = procedures.map((item) =>
      item.id === procedure.id
        ? {
            ...item,
            parameters:
              edit.type === "addParameter"
                ? [...parameters, { id: edit.id, name: edit.name }]
                : parameters.filter((_, position) => position !== index),
          }
        : item,
    );
    const transform = (call: Extract<Statement, { type: "callProcedure" }>): Statement => ({
      ...call,
      args:
        edit.type === "addParameter"
          ? [...(call.args ?? []), { type: "numericLiteral", value: 0 }]
          : (call.args ?? []).filter((_, position) => position !== index),
    });
    const candidate = {
      ...script,
      statements: mapCalls(script.statements, procedure.id, transform),
      procedures: nextProcedures.map((item) => ({
        ...item,
        body: mapCalls(item.body, procedure.id, transform),
      })),
    };
    return validateProgram({
      ...program,
      scripts: program.scripts.map((item, position) =>
        position === edit.scriptIndex ? candidate : item,
      ),
    });
  }
  if (edit.type === "rename") {
    if (
      !NAME.test(edit.name) ||
      procedures.some(
        (item) =>
          item.id !== edit.procedureId && item.name.toLowerCase() === edit.name.toLowerCase(),
      )
    )
      throw new RangeError("invalid custom block name");
    return validateProgram({
      ...program,
      scripts: program.scripts.map((item, index) =>
        index === edit.scriptIndex
          ? {
              ...script,
              procedures: procedures.map((entry) =>
                entry.id === edit.procedureId ? { ...entry, name: edit.name } : entry,
              ),
            }
          : item,
      ),
    });
  }
  const inUse =
    containsCall(script.statements, edit.procedureId) ||
    procedures.some(
      (item) => item.id !== edit.procedureId && containsCall(item.body, edit.procedureId),
    );
  if (inUse && !edit.inlineCalls) throw new RangeError("custom block is in use");
  if (inUse && (procedure.parameters?.length ?? 0) > 0)
    throw new RangeError("parameterized custom block cannot be inlined by this editor");
  if (edit.inlineCalls && containsCall(procedure.body, edit.procedureId))
    throw new RangeError("recursive custom block cannot be inlined");
  return validateProgram({
    ...program,
    scripts: program.scripts.map((item, index) =>
      index === edit.scriptIndex
        ? {
            ...script,
            statements: edit.inlineCalls
              ? inlineCalls(script.statements, edit.procedureId, procedure.body)
              : script.statements,
            ...(procedures.length === 1
              ? { procedures: undefined }
              : {
                  procedures: procedures
                    .filter((entry) => entry.id !== edit.procedureId)
                    .map((entry) => ({
                      ...entry,
                      body: edit.inlineCalls
                        ? inlineCalls(entry.body, edit.procedureId, procedure.body)
                        : entry.body,
                    })),
                }),
          }
        : item,
    ),
  });
}
