import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createProposalReview, createRepeatPatternProposal } from "@agorix/proposals";
import type { ProjectProgram } from "@agorix/program-model";
import { createEditorModelFromProgram } from "./editorModel.js";
import { GhostAddedBlocks } from "./GhostBlocks.js";
import { ghostMarksFor } from "./ghostMarks.js";

const program = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [1, 2, 3].flatMap(() => [
        { type: "move", steps: 20 },
        { type: "turn", degrees: 90 },
      ]),
    },
  ],
} as unknown as ProjectProgram;

function review() {
  const proposal = createRepeatPatternProposal({
    id: "repeat-pattern",
    baseProgram: program,
    purpose: "p",
    rationale: "r",
  });
  if (proposal === undefined) throw new Error("expected a repeat proposal");
  return createProposalReview(program, proposal);
}

describe("ghost marks", () => {
  it("marks existing blocks and lists added text for a repeat proposal", () => {
    const marks = ghostMarksFor(review(), createEditorModelFromProgram(program).workspace);
    expect(marks.byPath.size + marks.added.length).toBeGreaterThan(0);
  });

  it("is empty without a review and ignores nodes that no longer exist", () => {
    const workspace = createEditorModelFromProgram(program).workspace;
    expect(ghostMarksFor(undefined, workspace).byPath.size).toBe(0);
    const other = createEditorModelFromProgram({
      ...program,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
    } as unknown as ProjectProgram).workspace;
    expect(() => ghostMarksFor(review(), other)).not.toThrow();
    expect(ghostMarksFor(review(), other).byPath.size).toBe(0);
  });

  it("renders added ghosts as non-draggable, non-focusable suggestions", () => {
    const html = renderToStaticMarkup(<GhostAddedBlocks texts={["repeat(3)"]} locale="en" />);
    expect(html).toContain("ghost-added");
    expect(html).toContain("repeat(3)");
    expect(html).not.toContain("draggable");
    expect(html).not.toContain("tabindex");
    expect(renderToStaticMarkup(<GhostAddedBlocks texts={[]} locale="en" />)).toBe("");
  });
});
