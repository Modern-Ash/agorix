import { describe, it, expect } from "vitest";
import { simulate, computeProposal, type Block, type Mission } from "./kidsEngine";

const A: Mission = { start: [0, 2, "E"], goal: [4, 2] };
const B: Mission = { start: [0, 3, "E"], goal: [3, 1] };
const C: Mission = { start: [0, 0, "E"], goal: [3, 3] };
const mv = (n: number, id = 1): Block => ({ id, type: "move", n });

describe("paridad con el prototipo (casos calculados a mano)", () => {
  it("A: Mover 4 llega a la meta", () => {
    expect(simulate([mv(4)], A).result).toBe("success");
  });
  it("A: Mover 2 se queda corto", () => {
    expect(simulate([mv(2)], A).result).toBe("short");
  });
  it("A: Mover 5 pasa la meta", () => {
    expect(simulate([mv(5)], A).result).toBe("passed");
  });
  it("A: Mover 6 choca con el borde", () => {
    expect(simulate([mv(6)], A).result).toBe("wall");
  });
  it("B: Mover 6 choca con el borde", () => {
    expect(simulate([mv(6)], B).result).toBe("wall");
  });
  it("C: girar derecha, mover 3, girar izquierda, mover 3 llega", () => {
    const p: Block[] = [
      { id: 1, type: "turnR" },
      mv(3, 2),
      { id: 3, type: "turnL" },
      mv(3, 4),
    ];
    expect(simulate(p, C).result).toBe("success");
  });
});

describe("propuesta de Ori", () => {
  it("sin bloques propone mover la distancia que falta", () => {
    const p = computeProposal([], A, 0);
    expect(p.kind).toBe("move");
    expect(p.n).toBe(4);
  });
  it("con la meta alcanzada no propone nada", () => {
    expect(computeProposal([mv(4)], A, 0).kind).toBe("done");
  });
});
