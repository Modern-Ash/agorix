// Motor de reglas del prototipo Agorix Kids, sin UI. Reemplazable por program-model + runtime.
export type Dir = "E" | "S" | "W" | "N";
export type BlockType = "move" | "turnL" | "turnR" | "repeat" | "sound";
export interface Block {
  id: number;
  type: BlockType;
  n?: number;
  body?: Block[];
}
export interface Op {
  k: BlockType;
  id: number;
  type: BlockType;
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
}

export const COLS = 6;
export const ROWS = 4;
export const DIRS: Dir[] = ["E", "S", "W", "N"];
export const DV: Record<Dir, [number, number]> = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };

export function flatten(prog: Block[]): Op[] {
  const ops: Op[] = [];
  const push = (b: Block) => {
    if (b.type === "move") for (let i = 0; i < (b.n ?? 1); i++) ops.push({ k: "move", id: b.id, type: b.type });
    else ops.push({ k: b.type, id: b.id, type: b.type });
  };
  for (const b of prog) {
    if (b.type === "repeat") {
      for (let i = 0; i < (b.n ?? 1); i++) for (const c of b.body ?? []) push(c);
    } else push(b);
  }
  return ops;
}

export function idleRun(m: Mission, total = 0): RunState {
  return {
    x: m.start[0], y: m.start[1], d: m.start[2], trail: [], pc: 0, total,
    activeId: null, seen: [], result: null, status: "idle",
  };
}

export function applyOp(r: RunState, op: Op): RunState {
  let { x, y, d } = r;
  let result: RunState["result"] = null;
  if (op.k === "move") {
    const [dx, dy] = DV[d];
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) result = "wall";
    else { x = nx; y = ny; }
  } else if (op.k === "turnL") d = DIRS[(DIRS.indexOf(d) + 3) % 4];
  else if (op.k === "turnR") d = DIRS[(DIRS.indexOf(d) + 1) % 4];
  return {
    ...r, x, y, d,
    trail: [...r.trail, `${r.x},${r.y}`],
    pc: r.pc + 1,
    activeId: op.id,
    seen: [...r.seen, op.id],
    result: result ?? r.result,
  };
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
  for (const op of ops) {
    r = applyOp(r, op);
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
