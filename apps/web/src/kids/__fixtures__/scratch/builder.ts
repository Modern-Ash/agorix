/**
 * Builds Scratch 3 `project.json` documents from a small nested description, so the corpus stays
 * readable. The output has the real shape (targets, blocks with next/parent/inputs/fields, menu
 * shadows, literal primitives), because the importer must be measured on that shape, not on a
 * convenient one. Nothing here is copied from a real project: the team wrote every script.
 */
export type Val = number | string | Node;

export interface Node {
  readonly op: string;
  /** Inputs: a number or string is a literal, a node is a reporter or a condition. */
  readonly in?: Readonly<Record<string, Val>>;
  /** Fields: a plain value, or [name, id] for a variable, list or broadcast. */
  readonly f?: Readonly<Record<string, string | readonly [string, string]>>;
  /** Menu shadows: input name to the shadow block's opcode, field and value. */
  readonly menu?: Readonly<Record<string, readonly [string, string, string]>>;
  readonly sub?: readonly Node[];
  readonly sub2?: readonly Node[];
}

export const n = (op: string, rest: Omit<Node, "op"> = {}): Node => ({ op, ...rest });

type Raw = Record<string, unknown>;

class Compiler {
  readonly blocks: Record<string, Raw> = {};
  /** Statement blocks (not hats, not values) a person placed inside stacks. */
  statements = 0;
  private next = 0;

  private id(): string {
    this.next += 1;
    return `b${this.next}`;
  }

  /** Compiles one stack; returns the id of its first block. */
  stack(nodes: readonly Node[], parent: string | null, top: boolean): string | null {
    let previous: string | null = null;
    let first: string | null = null;
    for (const node of nodes) {
      const isHat = top && previous === null;
      if (!isHat) this.statements += 1;
      const id = this.node(node, previous ?? parent, isHat);
      if (first === null) first = id;
      else (this.blocks[previous!] as Raw)["next"] = id;
      previous = id;
    }
    return first;
  }

  node(node: Node, parent: string | null, topLevel: boolean): string {
    const id = this.id();
    const inputs: Record<string, unknown> = {};
    const fields: Record<string, unknown> = {};
    const block: Raw = {
      opcode: node.op,
      next: null,
      parent,
      inputs,
      fields,
      shadow: false,
      topLevel,
    };
    this.blocks[id] = block;
    for (const [name, value] of Object.entries(node.in ?? {})) {
      if (typeof value === "number") inputs[name] = [1, [4, String(value)]];
      else if (typeof value === "string") inputs[name] = [1, [10, value]];
      else if (value.op === "data_variable") {
        // Scratch writes a variable inside a slot as a primitive, not as a block.
        const [variableName, variableId] = value.f!["VARIABLE"] as readonly [string, string];
        inputs[name] = [3, [12, variableName, variableId], [10, ""]];
      } else {
        const child = this.node(value, id, false);
        inputs[name] = [3, child, [4, "0"]];
      }
    }
    for (const [name, [op, field, value]] of Object.entries(node.menu ?? {})) {
      const menuId = this.id();
      this.blocks[menuId] = {
        opcode: op,
        next: null,
        parent: id,
        inputs: {},
        fields: { [field]: [value, null] },
        shadow: true,
        topLevel: false,
      };
      inputs[name] = [1, menuId];
    }
    for (const [name, value] of Object.entries(node.f ?? {}))
      fields[name] = typeof value === "string" ? [value, null] : [value[0], value[1]];
    if (node.sub !== undefined) {
      const first = this.stack(node.sub, id, false);
      if (first !== null) inputs["SUBSTACK"] = [2, first];
    }
    if (node.sub2 !== undefined) {
      const first = this.stack(node.sub2, id, false);
      if (first !== null) inputs["SUBSTACK2"] = [2, first];
    }
    // A condition or reporter given as an input is compiled by `node`, which marks it [3|2, id].
    for (const [name, value] of Object.entries(inputs)) {
      const entry = value as unknown[];
      if (entry[0] === 3 && typeof entry[1] === "string" && this.isBoolean(entry[1]))
        inputs[name] = [2, entry[1]];
    }
    return id;
  }

  private isBoolean(id: string): boolean {
    const opcode = (this.blocks[id] as Raw)["opcode"] as string;
    return /^(operator_(equals|gt|lt|and|or|not|contains)|sensing_(touchingobject|touchingcolor|keypressed|mousedown|coloristouchingcolor))$/.test(
      opcode,
    );
  }
}

export interface SpriteSpec {
  readonly name: string;
  readonly x?: number;
  readonly y?: number;
  readonly direction?: number;
  readonly size?: number;
  readonly variables?: Readonly<Record<string, readonly [string, number | string]>>;
  /** Lists the sprite declares: id to [name, starting items]. */
  readonly lists?: Readonly<Record<string, readonly [string, readonly (number | string)[]]>>;
  /** Each script is a stack whose first node is the hat. */
  readonly scripts: readonly (readonly Node[])[];
}

export interface ScratchJson {
  targets: Raw[];
  /** Counted while building, for the measurement only; the importer ignores it. */
  stats: { scripts: number; statements: number };
}

export function scratchProject(
  sprites: readonly SpriteSpec[],
  stage: { variables?: SpriteSpec["variables"]; scripts?: readonly (readonly Node[])[] } = {},
): ScratchJson {
  const stats = { scripts: 0, statements: 0 };
  const target = (spec: Omit<SpriteSpec, "name"> & { name: string }, isStage: boolean): Raw => {
    const compiler = new Compiler();
    for (const script of spec.scripts) compiler.stack(script, null, true);
    stats.scripts += spec.scripts.length;
    stats.statements += compiler.statements;
    return {
      isStage,
      name: spec.name,
      variables: spec.variables ?? {},
      lists: spec.lists ?? {},
      blocks: compiler.blocks,
      ...(isStage
        ? {}
        : {
            x: spec.x ?? 0,
            y: spec.y ?? 0,
            direction: spec.direction ?? 90,
            size: spec.size ?? 100,
          }),
    };
  };
  return {
    stats,
    targets: [
      target(
        { name: "Stage", variables: stage.variables ?? {}, scripts: stage.scripts ?? [] },
        true,
      ),
      ...sprites.map((sprite) => target(sprite, false)),
    ],
  };
}
