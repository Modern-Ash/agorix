import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProposalEvidenceView } from "@agorix/proposals";
import { ProposalEvidence } from "./ProposalEvidence.js";

const none = { actorIds: [], scriptIds: [], assetIds: [], variableIds: [], nodeIds: [] };
const base: ProposalEvidenceView = {
  proposalId: "p1",
  suggested: {
    ...none,
    actorIds: ["actor:explorer"],
    scriptIds: ["explorer-script"],
    nodeIds: ["scripts[0]/statements[0]"],
    expected: [],
  },
};
const accepted = { decision: "accept" as const, resultProgramHash: "fnv1a32:00000001" };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("ProposalEvidence", () => {
  it("shows only the suggested row before any decision", () => {
    const out = text(renderToStaticMarkup(<ProposalEvidence view={base} locale="en" />));
    expect(out).toContain("Suggested by AI: actor:explorer, explorer-script");
    expect(out).not.toContain("Accepted by you");
    expect(out).not.toContain("Proved by the run");
  });

  it("shows accepted and proved rows with the status", () => {
    const view: ProposalEvidenceView = {
      ...base,
      accepted,
      proved: { status: "proved", matched: base.suggested, missing: none },
    };
    const out = text(renderToStaticMarkup(<ProposalEvidence view={view} locale="en" />));
    expect(out).toContain("Accepted by you (accept)");
    expect(out).toContain("Proved by the run: proved");
  });

  it("lists missing ids when the proof is partial and speaks Spanish", () => {
    const view: ProposalEvidenceView = {
      ...base,
      accepted,
      proved: {
        status: "partial",
        matched: none,
        missing: { ...none, actorIds: ["actor:explorer"] },
      },
    };
    const en = text(renderToStaticMarkup(<ProposalEvidence view={view} locale="en" />));
    expect(en).toContain("partly proved");
    expect(en).toContain("missing: actor:explorer");
    const es = text(renderToStaticMarkup(<ProposalEvidence view={view} locale="es" />));
    expect(es).toContain("Sugerido por la IA");
    expect(es).toContain("Aceptado por vos");
    expect(es).toContain("falta: actor:explorer");
  });

  it("never shows a proved row for a rejection", () => {
    const view: ProposalEvidenceView = {
      ...base,
      accepted: { decision: "reject", resultProgramHash: "fnv1a32:00000000" },
    };
    const out = text(renderToStaticMarkup(<ProposalEvidence view={view} locale="en" />));
    expect(out).toContain("Accepted by you (reject)");
    expect(out).not.toContain("Proved by the run");
  });
});
