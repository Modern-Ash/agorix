// Motor de reglas del prototipo Agorix Kids, sin UI. Reemplazable por program-model + runtime.
// Fuente de verdad: lógica de la clase Component en "Agorix Kids App.dc.html" (copia en handoff/).
export type Dir = "E" | "S" | "W" | "N";
export type BlockType =
  | "move" | "turnL" | "turnR" | "repeat" | "sound"
  | "if" | "ifCnt" | "ifEq"
  | "chgVar" | "setVar" | "subVar" | "moveVar" | "costume";

export interface Block {
  id: number;
  type: BlockType;
  n?: number;
  sk?: number;
  body?: Block[];
}

export interface Op {
  k: "move" | "turnL" | "turnR" | "sound" | "ifEdge" | "chgVar" | "setVar" | "subVar" | "moveVar" | "costume";
  id: number;
  type: BlockType;
  n?: number;
  sk?: number;
  cond?: "edge" | "cnt" | "eq";
  skip?: number;
}

export interface Mission {
  start: [number, number, Dir];
  goal: [number, number];
}

export interface RunState {
  x: number;
  y: number;
  d: Dir;
  trail: string[];
  pc: number;
  total: number;
  activeId: number | null;
  seen: number[];
  result: "success" | "wall" | "passed" | "short" | null;
  status: "idle" | "stepping" | "running" | "done" | "stopped";
  vars: { c: number; d: number };
}

export const COLS = 6;
export const ROWS = 4;
export const DIRS: Dir[] = ["E", "S", "W", "N"];
export const DV: Record<Dir, [number, number]> = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };

/** Aplana el programa en operaciones lineales. Los "si" saltan con `skip` si la condición es falsa. */
export function flatten(prog: Block[]): Op[] {
  const ops: Op[] = [];
  const push = (b: Block) => {
    if (b.type === "move") for (let i = 0; i < (b.n ?? 1); i++) ops.push({ k: "move", id: b.id, type: b.type });
    else if (b.type === "turnL" || b.type === "turnR" || b.type === "sound" || b.type === "costume" || b.type === "moveVar")
      ops.push({ k: b.type === "sound" ? "sound" : b.type, id: b.id, type: b.type, sk: b.sk });
    else ops.push({ k: b.type as Op["k"], id: b.id, type: b.type, n: b.n });
  };
  const emit = (list: Block[]) => {
    for (const b of list) {
      if (b.type === "repeat") {
        for (let i = 0; i < (b.n ?? 1); i++) emit(b.body ?? []);
      } else if (b.type === "if" || b.type === "ifCnt" || b.type === "ifEq") {
        const at = ops.length;
        ops.push({ k: "ifEdge", id: b.id, type: b.type, cond: b.type === "ifCnt" ? "cnt" : b.type === "ifEq" ? "eq" : "edge", n: b.n, skip: 0 });
        emit(b.body ?? []);
        ops[at].skip = ops.length;
      } else push(b);
    }
  };
  emit(prog);
  return ops;
}

export function idleRun(m: Mission, total = 0): RunState {
  return {
    x: m.start[0], y: m.start[1], d: m.start[2], trail: [], pc: 0, total,
    activeId: null, seen: [], result: null, status: "idle", vars: { c: 0, d: 0 },
  };
}

export function applyOp(r: RunState, op: Op): RunState {
  const base = { ...r, activeId: op.id, seen: [...r.seen, op.id], pc: r.pc + 1 };
  switch (op.k) {
    case "ifEdge": {
      const [ex, ey] = DV[r.d];
      const border = r.x + ex < 0 || r.y + ey < 0 || r.x + ex >= COLS || r.y + ey >= ROWS;
      const run = op.cond === "cnt" ? r.vars.c >= (op.n ?? 0) : op.cond === "eq" ? r.vars.c === (op.n ?? 0) : border;
      return { ...r, activeId: op.id, seen: [...r.seen, op.id], pc: run ? r.pc + 1 : (op.skip ?? r.pc + 1) };
    }
    case "setVar": return { ...base, vars: { ...r.vars, c: op.n ?? 0 } };
    case "chgVar": return { ...base, vars: { ...r.vars, c: r.vars.c + (op.n ?? 0) } };
    case "subVar": return { ...base, vars: { ...r.vars, c: r.vars.c - (op.n ?? 0) } };
    case "costume": return { ...base, vars: { ...r.vars, d: r.vars.d ? 0 : 1 } };
    case "moveVar": {
      let { x, y } = r;
      const trail = [...r.trail];
      let result: RunState["result"] = r.result;
      for (let i = 0; i < r.vars.c; i++) {
        const [dx, dy] = DV[r.d];
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { result = "wall"; break; }
        trail.push(`${x},${y}`); x = nx; y = ny;
      }
      return { ...base, x, y, trail, result };
    }
    case "move": {
      const [dx, dy] = DV[r.d];
      const nx = r.x + dx, ny = r.y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return { ...base, result: "wall" };
      return { ...base, x: nx, y: ny, trail: [...r.trail, `${r.x},${r.y}`] };
    }
    case "turnL": return { ...base, d: DIRS[(DIRS.indexOf(r.d) + 3) % 4] };
    case "turnR": return { ...base, d: DIRS[(DIRS.indexOf(r.d) + 1) % 4] };
    case "sound": return base; // el audio es efecto de UI; el motor no lo modela
  }
}

export function finishRun(r: RunState, m: Mission): RunState {
  let result = r.result;
  if (!result) {
    if (r.x === m.goal[0] && r.y === m.goal[1]) result = "success";
    else if (r.trail.includes(`${m.goal[0]},${m.goal[1]}`)) result = "passed";
    else result = "short";
  }
  return { ...r, status: "done", result, activeId: null };
}

export function simulate(prog: Block[], m: Mission): RunState {
  const ops = flatten(prog);
  let r: RunState = { ...idleRun(m, ops.length), status: "stepping" };
  while (r.pc < ops.length) {
    r = applyOp(r, ops[r.pc]);
    if (r.result) break;
  }
  return finishRun(r, m);
}

export type Proposal =
  | { kind: "done" | "wall" | "passed" | "turn"; blocks: Block[]; n?: number }
  | { kind: "move"; blocks: Block[]; n: number }
  | { kind: "repeat"; blocks: Block[]; n: number };

/** Propuesta de Ori: reglas deterministas. La UI la muestra; nunca la aplica sola. */
export function computeProposal(prog: Block[], m: Mission, mIdx: number): Proposal {
  const r = simulate(prog, m);
  if (r.result === "success") return { kind: "done", blocks: [] };
  if (r.result === "wall") return { kind: "wall", blocks: [] };
  if (r.result === "passed") return { kind: "passed", blocks: [] };
  const dx = m.goal[0] - r.x, dy = m.goal[1] - r.y;
  const [fx, fy] = DV[r.d];
  let n = 0;
  if (fx !== 0 && Math.sign(dx) === fx) n = Math.abs(dx);
  else if (fy !== 0 && Math.sign(dy) === fy) n = Math.abs(dy);
  if (n > 0) {
    if (n >= 3 && mIdx === 2) return { kind: "repeat", n, blocks: [{ id: 0, type: "repeat", n, body: [{ id: 0, type: "move", n: 1 }] }] };
    return { kind: "move", n: Math.min(5, n), blocks: [{ id: 0, type: "move", n: Math.min(5, n) }] };
  }
  const target: Dir = dx !== 0 ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");
  const i = DIRS.indexOf(r.d);
  const type: BlockType = DIRS[(i + 3) % 4] === target ? "turnL" : "turnR";
  return { kind: "turn", blocks: [{ id: 0, type }] };
}
