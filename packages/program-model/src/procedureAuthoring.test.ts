import { describe, expect, it } from "vitest";
import { editProgramProcedure } from "./procedureAuthoring.js";
import { SCHEMA_VERSION, type ProjectProgram } from "./schema.js";

const base: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 3 },
        { type: "turn", degrees: 90 },
      ],
    },
  ],
};

describe("canonical custom-block authoring", () => {
  it("adds and removes a parameter with every call in one validated edit", () => {
    const created = editProgramProcedure(base, {
      type: "create",
      scriptIndex: 0,
      name: "Wave",
      count: 1,
      id: "proc:wave",
    });
    const added = editProgramProcedure(created, {
      type: "addParameter",
      scriptIndex: 0,
      procedureId: "proc:wave",
      id: "param:steps",
      name: "Steps",
    });
    expect(added.scripts[0]?.procedures?.[0]?.parameters).toEqual([
      { id: "param:steps", name: "Steps" },
    ]);
    expect(added.scripts[0]?.statements[1]).toEqual({
      type: "callProcedure",
      procedureId: "proc:wave",
      args: [{ type: "numericLiteral", value: 0 }],
    });
    expect(
      editProgramProcedure(added, {
        type: "removeParameter",
        scriptIndex: 0,
        procedureId: "proc:wave",
        parameterId: "param:steps",
      }).scripts[0]?.statements[1],
    ).toEqual({ type: "callProcedure", procedureId: "proc:wave", args: [] });
    expect(() =>
      editProgramProcedure(added, {
        type: "addParameter",
        scriptIndex: 0,
        procedureId: "proc:wave",
        id: "param:other",
        name: "steps",
      }),
    ).toThrow();
    expect(() =>
      editProgramProcedure(added, {
        type: "removeParameter",
        scriptIndex: 0,
        procedureId: "proc:wave",
        parameterId: "missing",
      }),
    ).toThrow();
  });
  it("extracts the last blocks atomically, renames and inlines calls", () => {
    const created = editProgramProcedure(base, {
      type: "create",
      scriptIndex: 0,
      name: "Wave",
      count: 2,
      id: "proc:wave",
    });
    expect(created.scripts[0]?.statements).toEqual([
      { type: "callProcedure", procedureId: "proc:wave" },
    ]);
    expect(created.scripts[0]?.procedures?.[0]?.body).toEqual(base.scripts[0]?.statements);
    const renamed = editProgramProcedure(created, {
      type: "rename",
      scriptIndex: 0,
      procedureId: "proc:wave",
      name: "Wave again",
    });
    expect(renamed.scripts[0]?.procedures?.[0]?.name).toBe("Wave again");
    expect(
      editProgramProcedure(renamed, {
        type: "delete",
        scriptIndex: 0,
        procedureId: "proc:wave",
        inlineCalls: true,
      }),
    ).toEqual(base);
    expect(base.scripts[0]?.procedures).toBeUndefined();
  });

  it("refuses invalid extraction and deletion without an explicit inline decision", () => {
    for (const edit of [
      { type: "create" as const, scriptIndex: 0, name: "", count: 1, id: "proc:a" },
      { type: "create" as const, scriptIndex: 0, name: "Wave", count: 3, id: "proc:a" },
      { type: "create" as const, scriptIndex: 1, name: "Wave", count: 1, id: "proc:a" },
    ])
      expect(() => editProgramProcedure(base, edit)).toThrow();
    const created = editProgramProcedure(base, {
      type: "create",
      scriptIndex: 0,
      name: "Wave",
      count: 1,
      id: "proc:a",
    });
    expect(() =>
      editProgramProcedure(created, {
        type: "delete",
        scriptIndex: 0,
        procedureId: "proc:a",
        inlineCalls: false,
      }),
    ).toThrow();
    expect(() =>
      editProgramProcedure(created, {
        type: "rename",
        scriptIndex: 0,
        procedureId: "proc:a",
        name: "!",
      }),
    ).toThrow();
    expect(created.scripts[0]?.statements).toEqual([
      { type: "move", steps: 3 },
      { type: "callProcedure", procedureId: "proc:a" },
    ]);
  });

  it("inlines nested calls but rejects direct recursion before deletion", () => {
    const created = editProgramProcedure(base, {
      type: "create",
      scriptIndex: 0,
      name: "Wave",
      count: 1,
      id: "proc:a",
    });
    const nested: ProjectProgram = {
      ...created,
      scripts: [
        {
          ...created.scripts[0]!,
          statements: [
            { type: "repeat", count: 2, body: [{ type: "callProcedure", procedureId: "proc:a" }] },
          ],
        },
      ],
    };
    expect(
      editProgramProcedure(nested, {
        type: "delete",
        scriptIndex: 0,
        procedureId: "proc:a",
        inlineCalls: true,
      }).scripts[0]?.statements,
    ).toEqual([{ type: "repeat", count: 2, body: [{ type: "turn", degrees: 90 }] }]);
    const recursive: ProjectProgram = {
      ...created,
      scripts: [
        {
          ...created.scripts[0]!,
          procedures: [
            {
              ...created.scripts[0]!.procedures![0]!,
              body: [{ type: "callProcedure", procedureId: "proc:a" }],
            },
          ],
        },
      ],
    };
    expect(() =>
      editProgramProcedure(recursive, {
        type: "delete",
        scriptIndex: 0,
        procedureId: "proc:a",
        inlineCalls: true,
      }),
    ).toThrow();
  });
});
