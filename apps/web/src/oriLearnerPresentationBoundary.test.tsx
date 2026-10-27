import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OriLearnerProposalReview } from "./OriLearnerProposalReview.js";

const proposal = {
  schemaVersion: "ori/proposal/v0",
  operation: "append",
  requiresLearnerApproval: true,
  blocks: [{ kind: "move", steps: 2 }],
};
describe("MIG-03 learner proposal presentation boundary", () => {
  it("renders validated proposal without treating SSR as a presentation receipt", () => {
    let presentations = 0;
    const html = renderToStaticMarkup(
      <OriLearnerProposalReview input={{ ticketId: "ticket-1", proposal }}
        onPresented={() => { presentations++; }} />,
    );
    expect(html).toContain("Ori propone un paso");
    expect(html).toContain("Aceptar propuesta");
    expect(presentations).toBe(0);
  });
  it("never reports or renders forged proposals", () => {
    let presentations = 0;
    const html = renderToStaticMarkup(
      <OriLearnerProposalReview
        input={{ ticketId: "ticket-2", proposal: { ...proposal, shell: "forged" } }}
        onPresented={() => { presentations++; }} />,
    );
    expect(html).toBe("");
    expect(presentations).toBe(0);
  });
});
