# Multi-actor AI proposals, diffs and runtime evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A proposal that declares actors provably cannot touch another actor's scripts, and App and Studio show the same suggested / accepted / proved evidence for it.

**Architecture:** `packages/proposals` gains an optional creative context (`actors` with owned script ids) that `createProposalReview` uses to enforce actor scope, plus a shared `createProposalEvidenceView` builder. App and Studio both render that one view, so ids cannot diverge. No proposal schema or operation changes (`agorix/program-proposal/v1` stays).

**Tech Stack:** TypeScript, vitest, pnpm workspace (`corepack pnpm`), React (`apps/web`, `packages/studio-ui`), VS Code extension (`extensions/vscode`).

**Spec:** `docs/superpowers/specs/2026-10-10-multi-actor-proposals-design.md`

## Global Constraints

- Proposal schema stays `agorix/program-proposal/v1`; no `actorId` on operations.
- Proposals without actor context, or without `affectedActorIds`, behave exactly as today.
- No program mutation without an explicit learner accept / modify / reject.
- Provider text rendered in UI stays plain text and after deterministic content (ADR 0008).
- All new learner-facing strings exist in `en` and `es`.
- Gates before every commit that touches code: `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm test`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Script owned by two actors, proposal declares only one: must be rejected (it silently changes the other).
- Declared actor that owns no touched script (or is unknown): must be rejected, not ignored.
- Script owned by no actor while actors are declared: must be rejected.
- Actors listed in a different order, or `scripts` in a different order: same context hash.
- Rejected proposal: evidence view shows decision `rejected` and never a `proved` row.
- Empty trace after accept: status `unproven`, not `proved`.

---

## File Structure

- Modify `packages/proposals/src/index.ts`: actor scope, context hash, audit field, evidence view builder.
- Modify `packages/proposals/src/index.test.ts`: tests for the above.
- Modify `packages/studio-protocol/src/index.ts` (+ `index.test.ts`): `proposalProof` host message.
- Modify `packages/studio-ui/src/agentUi.ts`, `AgentPanel.tsx`, `i18n.ts` (+ `agent.test.tsx`): evidence inspector.
- Modify `extensions/vscode/src/studioCore.ts`, `host/agentPort.ts`, `host/agentHost.ts`, `studioRuntime.ts` (+ tests): actor context and proof emission.
- Modify `apps/web/src/App.tsx`, `i18n.ts` (+ tests): actor context and evidence rows on the card.

---

### Task 1: Actor scope enforcement and creative context hash

**Files:**

- Modify: `packages/proposals/src/index.ts` (error codes ~l.74, `ProposalAuditEvent` ~l.110, `ProposalReview` ~l.100, `createProposalReview` ~l.329, `acceptProposal`/`modifyProposal`/`rejectProposal` ~l.358-393, `createAuditEvent` ~l.976)
- Test: `packages/proposals/src/index.test.ts`

**Interfaces:**

- Produces: `ProposalCreativeContext`, `creativeContextHash(context): string`, `createProposalReview(program, proposal, context?)`, `acceptProposal(program, review, context?)`, `modifyProposal(program, review, learnerProgram, context?)`, error code `"ACTOR_SCOPE_VIOLATION"`, `ProposalReview.creativeContextHash?`, `ProposalAuditEvent.creativeContextHash?`.

- [ ] **Step 1: Write the failing tests** (append inside the top-level `describe` of `index.test.ts`; `multiScriptProgram` and imports already exist, add `creativeContextHash` to the import list)

```ts
const twoActors = [
  { id: "actor:explorer", scripts: ["explorer-script"] },
  { id: "actor:beacon", scripts: ["beacon-script"] },
];

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof ProposalValidationError ? error.code : "OTHER";
  }
  return undefined;
}

function actorProposal(input: {
  readonly actors: readonly string[];
  readonly scriptIndex: 0 | 1;
}): ProgramProposal {
  const scriptId = input.scriptIndex === 0 ? "explorer-script" : "beacon-script";
  const field = input.scriptIndex === 0 ? "steps" : "degrees";
  const nodeId = `scripts[${input.scriptIndex}]/statements[0]`;
  return createProgramProposal({
    id: `proposal-actor-${input.scriptIndex}`,
    baseProgram: multiScriptProgram,
    source: { kind: "learning-companion", capability: "multi-actor-review" },
    purpose: "Change one actor.",
    rationale: "Only the declared actor should change.",
    affectedActorIds: input.actors,
    affectedScriptIds: [scriptId],
    affectedNodeIds: [nodeId],
    operations: [{ type: "replaceStatementField", nodeId, field, value: 25 }],
  });
}

describe("actor scope", () => {
  it("accepts a proposal whose touched script belongs to the declared actor", () => {
    const review = createProposalReview(
      multiScriptProgram,
      actorProposal({ actors: ["actor:explorer"], scriptIndex: 0 }),
      { actors: twoActors },
    );
    expect(review.creativeContextHash).toBe(creativeContextHash({ actors: twoActors }));
  });

  it("rejects a proposal that declares one actor but edits another actor's script", () => {
    expect(
      codeOf(() =>
        createProposalReview(
          multiScriptProgram,
          actorProposal({ actors: ["actor:explorer"], scriptIndex: 1 }),
          { actors: twoActors },
        ),
      ),
    ).toBe("ACTOR_SCOPE_VIOLATION");
  });

  it("rejects a declared actor that owns no touched script, or is unknown", () => {
    expect(
      codeOf(() =>
        createProposalReview(
          multiScriptProgram,
          actorProposal({ actors: ["actor:explorer", "actor:beacon"], scriptIndex: 0 }),
          { actors: twoActors },
        ),
      ),
    ).toBe("ACTOR_SCOPE_VIOLATION");
    expect(
      codeOf(() =>
        createProposalReview(
          multiScriptProgram,
          actorProposal({ actors: ["actor:ghost"], scriptIndex: 0 }),
          { actors: twoActors },
        ),
      ),
    ).toBe("ACTOR_SCOPE_VIOLATION");
  });

  it("rejects when a touched script is shared with an undeclared actor", () => {
    const shared = [
      { id: "actor:explorer", scripts: ["explorer-script"] },
      { id: "actor:beacon", scripts: ["beacon-script", "explorer-script"] },
    ];
    expect(
      codeOf(() =>
        createProposalReview(
          multiScriptProgram,
          actorProposal({ actors: ["actor:explorer"], scriptIndex: 0 }),
          { actors: shared },
        ),
      ),
    ).toBe("ACTOR_SCOPE_VIOLATION");
  });

  it("rejects a touched script that no actor owns", () => {
    expect(
      codeOf(() =>
        createProposalReview(
          multiScriptProgram,
          actorProposal({ actors: ["actor:explorer"], scriptIndex: 1 }),
          { actors: [{ id: "actor:explorer", scripts: ["explorer-script"] }] },
        ),
      ),
    ).toBe("ACTOR_SCOPE_VIOLATION");
  });

  it("behaves as before without context or without declared actors", () => {
    const proposal = actorProposal({ actors: ["actor:explorer"], scriptIndex: 1 });
    expect(createProposalReview(multiScriptProgram, proposal).creativeContextHash).toBeUndefined();
    const undeclared = createProgramProposal({
      id: "proposal-no-actors",
      baseProgram: multiScriptProgram,
      source: { kind: "learning-companion" },
      purpose: "p",
      rationale: "r",
      affectedNodeIds: ["scripts[1]/statements[0]"],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[1]/statements[0]",
          field: "degrees",
          value: 45,
        },
      ],
    });
    expect(() =>
      createProposalReview(multiScriptProgram, undeclared, { actors: twoActors }),
    ).not.toThrow();
  });

  it("hashes the context independent of ordering and changes with ownership", () => {
    const reordered = [
      { id: "actor:beacon", scripts: ["beacon-script"] },
      { id: "actor:explorer", scripts: ["explorer-script"] },
    ];
    expect(creativeContextHash({ actors: reordered })).toBe(
      creativeContextHash({ actors: twoActors }),
    );
    const moved = [
      { id: "actor:explorer", scripts: ["explorer-script", "beacon-script"] },
      { id: "actor:beacon", scripts: [] },
    ];
    expect(creativeContextHash({ actors: moved })).not.toBe(
      creativeContextHash({ actors: twoActors }),
    );
  });

  it("goes stale on accept when ownership changed and records the hash in the audit", () => {
    const review = createProposalReview(
      multiScriptProgram,
      actorProposal({ actors: ["actor:explorer"], scriptIndex: 0 }),
      { actors: twoActors },
    );
    const moved = [{ id: "actor:explorer", scripts: [] }, ...twoActors.slice(1)];
    expect(codeOf(() => acceptProposal(multiScriptProgram, review, { actors: moved }))).toBe(
      "STALE_PROPOSAL",
    );
    const accepted = acceptProposal(multiScriptProgram, review, { actors: twoActors });
    expect(accepted.audit.creativeContextHash).toBe(review.creativeContextHash);
    expect(rejectProposal(multiScriptProgram, review).audit.creativeContextHash).toBe(
      review.creativeContextHash,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `corepack pnpm exec vitest run packages/proposals/src/index.test.ts -t "actor scope"`
Expected: FAIL (`creativeContextHash` is not exported / third argument ignored).

- [ ] **Step 3: Implement** in `packages/proposals/src/index.ts`

Add `| "ACTOR_SCOPE_VIOLATION"` to `ProposalErrorCode`. Add `readonly creativeContextHash?: string;` to `ProposalReview` and `ProposalAuditEvent`. Add after `ProposalDecisionResult`:

```ts
export interface ProposalCreativeContext {
  readonly actors?: readonly {
    readonly id: string;
    readonly scripts?: readonly string[];
  }[];
}

const CREATIVE_CONTEXT_CONTRACT = "agorix/proposal-creative-context/v1";

export function creativeContextHash(context: ProposalCreativeContext): string {
  const actors = [...(context.actors ?? [])]
    .map((actor) => ({ id: actor.id, scripts: [...(actor.scripts ?? [])].sort() }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return stableHash(stableStringify({ contractVersion: CREATIVE_CONTEXT_CONTRACT, actors }));
}
```

Add the check next to `assertProposalScope`:

```ts
function assertActorScope(
  program: ProjectProgram,
  proposal: ProgramProposal,
  context: ProposalCreativeContext | undefined,
): void {
  const actors = context?.actors;
  const declared = proposal.affectedActorIds;
  if (actors === undefined || declared === undefined) {
    return;
  }
  const derived = new Set<string>();
  proposal.operations.forEach((operation, index) => {
    const script = scriptForOperation(program, operation);
    if (script === undefined) {
      return;
    }
    const owners = actors
      .filter((actor) => actor.scripts?.includes(script.id) === true)
      .map((actor) => actor.id);
    if (!owners.some((id) => declared.includes(id))) {
      throw new ProposalValidationError(
        "ACTOR_SCOPE_VIOLATION",
        `$.operations[${index}]`,
        `operation targets script ${JSON.stringify(script.id)} not owned by a declared actor`,
      );
    }
    owners.forEach((id) => derived.add(id));
  });
  const undeclared = [...derived].filter((id) => !declared.includes(id));
  const untouched = declared.filter((id) => !derived.has(id));
  if (undeclared.length > 0 || untouched.length > 0) {
    throw new ProposalValidationError(
      "ACTOR_SCOPE_VIOLATION",
      "$.affectedActorIds",
      `declared actors differ from touched actors (undeclared: ${undeclared.join(",") || "none"}; untouched: ${untouched.join(",") || "none"})`,
    );
  }
}

function assertFreshContext(
  review: ProposalReview,
  context: ProposalCreativeContext | undefined,
): void {
  if (review.creativeContextHash === undefined || context === undefined) {
    return;
  }
  const current = creativeContextHash(context);
  if (current !== review.creativeContextHash) {
    throw new ProposalValidationError(
      "STALE_PROPOSAL",
      "$.creativeContext",
      `proposal context ${review.creativeContextHash} does not match current ${current}`,
    );
  }
}
```

Change `createProposalReview` signature to `(acceptedProgram, proposal, context?: ProposalCreativeContext)`; call `assertActorScope(accepted, proposal, context);` right after `assertProposalScope(accepted, proposal);`; add to the returned object `...(context === undefined ? {} : { creativeContextHash: creativeContextHash(context) }),`.

Change `acceptProposal(acceptedProgram, review, context?)` and `modifyProposal(acceptedProgram, review, learnerReviewedProgram, context?)` to call `assertFreshContext(review, context);` after `assertFreshBase`, and pass `review.creativeContextHash` as a new 4th argument to every `createAuditEvent(...)` call (accept, reject, modify). In `createAuditEvent` add parameter `creativeContext?: string` and spread `...(creativeContext === undefined ? {} : { creativeContextHash: creativeContext }),` before `baseProgramHash`.

- [ ] **Step 4: Run to verify pass**

Run: `corepack pnpm exec vitest run packages/proposals`
Expected: all proposals tests PASS.

- [ ] **Step 5: Gates and commit**

```bash
corepack pnpm lint && corepack pnpm format:check
git add packages/proposals/src
git commit -m "feat(proposals): enforce actor scope with a creative context hash

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared proposal evidence view

**Files:**

- Modify: `packages/proposals/src/index.ts` (add after `createProposalComparisonView`)
- Test: `packages/proposals/src/index.test.ts`

**Interfaces:**

- Consumes: `bindProposalRuntimeEvidence`, `ProposalReview`, `ProposalAuditEvent`, `RuntimeEvidenceTraceEntry`.
- Produces: `ProposalEvidenceIds`, `ProposalProofStatus`, `ProposalEvidenceView`, `createProposalEvidenceView(review, options?)`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("proposal evidence view", () => {
  const review = () =>
    createProposalReview(
      multiScriptProgram,
      actorProposal({ actors: ["actor:explorer"], scriptIndex: 0 }),
      { actors: twoActors },
    );
  const trace = [
    { nodeId: "scripts[0]/statements[0]", actorId: "actor:explorer", scriptId: "explorer-script" },
  ];

  it("shows only the suggested row before a decision", () => {
    const view = createProposalEvidenceView(review());
    expect(view.suggested.actorIds).toEqual(["actor:explorer"]);
    expect(view.suggested.scriptIds).toEqual(["explorer-script"]);
    expect(view.accepted).toBeUndefined();
    expect(view.proved).toBeUndefined();
  });

  it("marks accepted and proved when the trace covers the declared ids", () => {
    const r = review();
    const { audit } = acceptProposal(multiScriptProgram, r, { actors: twoActors });
    const view = createProposalEvidenceView(r, { audit, trace });
    expect(view.accepted).toEqual({
      decision: "accept",
      resultProgramHash: audit.resultProgramHash,
    });
    expect(view.proved?.status).toBe("proved");
    expect(view.proved?.matched.actorIds).toEqual(["actor:explorer"]);
    expect(view.proved?.missing.nodeIds).toEqual([]);
  });

  it("is partial when the trace misses a declared id and unproven when empty", () => {
    const r = review();
    const { audit } = acceptProposal(multiScriptProgram, r, { actors: twoActors });
    const partial = createProposalEvidenceView(r, {
      audit,
      trace: [{ nodeId: "scripts[0]/statements[0]" }],
    });
    expect(partial.proved?.status).toBe("partial");
    expect(partial.proved?.missing.actorIds).toEqual(["actor:explorer"]);
    expect(createProposalEvidenceView(r, { audit, trace: [] }).proved?.status).toBe("unproven");
  });

  it("never proves a rejected proposal", () => {
    const r = review();
    const { audit } = rejectProposal(multiScriptProgram, r);
    const view = createProposalEvidenceView(r, { audit, trace });
    expect(view.accepted?.decision).toBe("reject");
    expect(view.proved).toBeUndefined();
  });
});
```

Add `createProposalEvidenceView` to the test imports.

- [ ] **Step 2: Run to verify failure**

Run: `corepack pnpm exec vitest run packages/proposals -t "evidence view"`
Expected: FAIL (`createProposalEvidenceView` not exported).

- [ ] **Step 3: Implement**

```ts
export interface ProposalEvidenceIds {
  readonly actorIds: readonly string[];
  readonly scriptIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly variableIds: readonly string[];
  readonly nodeIds: readonly string[];
}

export type ProposalProofStatus = "proved" | "partial" | "unproven";

export interface ProposalEvidenceView {
  readonly proposalId: string;
  readonly suggested: ProposalEvidenceIds & {
    readonly expected: readonly ProposalExpectedRuntimeEvidence[];
  };
  readonly accepted?: {
    readonly decision: ProposalAuditEvent["decision"];
    readonly resultProgramHash: string;
  };
  readonly proved?: {
    readonly status: ProposalProofStatus;
    readonly matched: ProposalEvidenceIds;
    readonly missing: ProposalEvidenceIds;
  };
}

export function createProposalEvidenceView(
  review: ProposalReview,
  options: {
    readonly audit?: ProposalAuditEvent;
    readonly trace?: readonly RuntimeEvidenceTraceEntry[];
  } = {},
): ProposalEvidenceView {
  const proposal = review.proposal;
  const view: ProposalEvidenceView = {
    proposalId: proposal.id,
    suggested: {
      actorIds: proposal.affectedActorIds ?? [],
      scriptIds: proposal.affectedScriptIds ?? [],
      assetIds: proposal.affectedAssetIds ?? [],
      variableIds: proposal.affectedVariableIds ?? [],
      nodeIds: proposal.affectedNodeIds,
      expected: proposal.expectedRuntimeEvidence ?? [],
    },
  };
  const audit = options.audit;
  if (audit === undefined) {
    return view;
  }
  const accepted = { decision: audit.decision, resultProgramHash: audit.resultProgramHash };
  if (audit.decision === "reject" || options.trace === undefined) {
    return { ...view, accepted };
  }
  const binding = bindProposalRuntimeEvidence(proposal, options.trace);
  const matched: ProposalEvidenceIds = {
    actorIds: binding.matchedActorIds,
    scriptIds: binding.matchedScriptIds,
    assetIds: binding.matchedAssetIds,
    variableIds: binding.matchedVariableIds,
    nodeIds: binding.matchedNodeIds,
  };
  const missing: ProposalEvidenceIds = {
    actorIds: binding.missingActorIds,
    scriptIds: binding.missingScriptIds,
    assetIds: binding.missingAssetIds,
    variableIds: binding.missingVariableIds,
    nodeIds: binding.missingNodeIds,
  };
  const nothingMissing = Object.values(missing).every((ids) => ids.length === 0);
  const status: ProposalProofStatus =
    binding.observedNodeIds.length === 0 ? "unproven" : nothingMissing ? "proved" : "partial";
  return { ...view, accepted, proved: { status, matched, missing } };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `corepack pnpm exec vitest run packages/proposals`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
corepack pnpm lint && corepack pnpm format:check
git add packages/proposals/src
git commit -m "feat(proposals): shared suggested/accepted/proved evidence view

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Studio protocol message and evidence inspector UI

**Files:**

- Modify: `packages/studio-protocol/src/index.ts` (`HostMessage` union near l.365; parser near the `"help"` case l.1471)
- Modify: `packages/studio-ui/src/agentUi.ts` (`AgentUiState`, `reduceAgentUi`), `AgentPanel.tsx`, `i18n.ts` (en ~l.121, es ~l.389 and the copy type)
- Test: `packages/studio-protocol/src/index.test.ts`, `packages/studio-ui/src/agent.test.tsx`

**Interfaces:**

- Produces: `ProofIdsView`, `HostMessage` variant `proposalProof`, `AgentUiState.proof?`, copy keys `evidenceSuggested`, `evidenceAccepted`, `evidenceProved`, `proofProved`, `proofPartial`, `proofUnproven`, `proofMissing`.

- [ ] **Step 1: Failing protocol test** (`index.test.ts`, use `parseHostMessage`)

```ts
it("parses and rejects proposalProof messages", () => {
  const ids = {
    actorIds: ["actor:explorer"],
    scriptIds: [],
    assetIds: [],
    variableIds: [],
    nodeIds: ["scripts[0]/statements[0]"],
  };
  const message = {
    schema: STUDIO_PROTOCOL_VERSION,
    type: "proposalProof",
    proposalId: "p1",
    decision: "accepted",
    resultProgramHash: "fnv1a32:00000000",
    proof: { status: "proved", matched: ids, missing: { ...ids, actorIds: [], nodeIds: [] } },
  };
  expect(parseHostMessage(message)).toEqual(message);
  expect(parseHostMessage({ ...message, decision: "maybe" })).toBeUndefined();
  expect(
    parseHostMessage({ ...message, proof: { ...message.proof, status: "great" } }),
  ).toBeUndefined();
  expect(parseHostMessage({ ...message, proposalId: "bad id!" })).toBeUndefined();
});
```

Run: `corepack pnpm exec vitest run packages/studio-protocol -t proposalProof` → FAIL.

- [ ] **Step 2: Implement protocol.** Add near the other view types:

```ts
export interface ProofIdsView {
  readonly actorIds: readonly string[];
  readonly scriptIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly variableIds: readonly string[];
  readonly nodeIds: readonly string[];
}
```

Add to `HostMessage` after `proposalCleared`:

```ts
  | {
      readonly schema: Schema;
      readonly type: "proposalProof";
      readonly proposalId: string;
      readonly decision: Decision;
      readonly resultProgramHash?: string;
      readonly proof?: {
        readonly status: "proved" | "partial" | "unproven";
        readonly matched: ProofIdsView;
        readonly missing: ProofIdsView;
      };
    }
```

Add parser helper and case (before `case "help"`):

```ts
const PROOF_ID_KEYS = ["actorIds", "scriptIds", "assetIds", "variableIds", "nodeIds"] as const;

function parseProofIds(raw: unknown): ProofIdsView | undefined {
  if (!isObject(raw)) return undefined;
  const out: Record<string, readonly string[]> = {};
  for (const key of PROOF_ID_KEYS) {
    const list = parseIdList(raw[key]);
    if (list === undefined) return undefined;
    out[key] = list;
  }
  return out as unknown as ProofIdsView;
}
```

```ts
    case "proposalProof": {
      const decision = value["decision"];
      const hash =
        value["resultProgramHash"] === undefined
          ? undefined
          : boundedString(value["resultProgramHash"], 1, 120);
      const rawProof = value["proof"];
      let proof: Extract<HostMessage, { type: "proposalProof" }>["proof"];
      if (rawProof !== undefined) {
        if (!isObject(rawProof)) return undefined;
        const matched = parseProofIds(rawProof["matched"]);
        const missing = parseProofIds(rawProof["missing"]);
        const status = rawProof["status"];
        if (
          matched === undefined ||
          missing === undefined ||
          (status !== "proved" && status !== "partial" && status !== "unproven")
        ) {
          return undefined;
        }
        proof = { status, matched, missing };
      }
      if (
        !isSafeId(value["proposalId"]) ||
        !(DECISIONS as readonly unknown[]).includes(decision) ||
        (value["resultProgramHash"] !== undefined && hash === undefined)
      ) {
        return undefined;
      }
      return {
        schema,
        type: "proposalProof",
        proposalId: value["proposalId"],
        decision: decision as Decision,
        ...(hash === undefined ? {} : { resultProgramHash: hash }),
        ...(proof === undefined ? {} : { proof }),
      };
    }
```

If `parseIdList` does not accept an empty array, check its definition and use the same permissive helper that `parseOptionalIdList` wraps. Run the protocol test → PASS.

- [ ] **Step 3: Failing UI test** (`agent.test.tsx`, reuse its `html`, `stageState`, `schema` helpers)

```ts
it("shows suggested, accepted and proved rows from a proposalProof", () => {
  const withProposal = reduceAgentUi(stageState("proposal"), {
    schema,
    type: "proposal",
    proposalId: "p1",
    purpose: "p",
    rationale: "r",
    affectedActorIds: ["actor:explorer"],
    affectedNodeIds: ["scripts[0]/statements[0]"],
    changes: [],
  });
  const ids = {
    actorIds: ["actor:explorer"],
    scriptIds: [],
    assetIds: [],
    variableIds: [],
    nodeIds: ["scripts[0]/statements[0]"],
  };
  const empty = { actorIds: [], scriptIds: [], assetIds: [], variableIds: [], nodeIds: [] };
  const state = reduceAgentUi(withProposal, {
    schema,
    type: "proposalProof",
    proposalId: "p1",
    decision: "accepted",
    proof: { status: "proved", matched: ids, missing: empty },
  });
  const markup = html(state);
  expect(markup).toContain("Suggested by AI");
  expect(markup).toContain("Accepted by you");
  expect(markup).toContain("Proved by the runtime");
  expect(markup).toContain("actor:explorer");
});
```

Run → FAIL.

- [ ] **Step 4: Implement UI.** In `agentUi.ts` add `readonly proof?: Extract<HostMessage, { type: "proposalProof" }>;` to `AgentUiState`; add reducer case `case "proposalProof": return { ...state, proof: message };`; make `proposalCleared` keep `proof` (it must survive until the run) and clear it on a new `proposal` message (`without(state, "notice", "selectionEvidence", "help", "proof")`). In `AgentPanel.tsx` add:

```tsx
function ProposalProof({
  proof,
  suggested,
  copy,
}: {
  readonly proof: NonNullable<AgentUiState["proof"]>;
  readonly suggested: readonly string[];
  readonly copy: StudioUiCopy;
}) {
  const status =
    proof.proof === undefined
      ? undefined
      : { proved: copy.proofProved, partial: copy.proofPartial, unproven: copy.proofUnproven }[
          proof.proof.status
        ];
  const missing = proof.proof === undefined ? [] : Object.values(proof.proof.missing).flat();
  return (
    <section aria-label={copy.evidenceInspector}>
      <ol>
        <li>
          {copy.evidenceSuggested}: {suggested.join(", ")}
        </li>
        <li>
          {copy.evidenceAccepted}: {proof.decision}
        </li>
        {status === undefined ? null : (
          <li>
            {copy.evidenceProved}: {status}
            {missing.length === 0 ? null : (
              <small>
                {" "}
                {copy.proofMissing}: {missing.join(", ")}
              </small>
            )}
          </li>
        )}
      </ol>
    </section>
  );
}
```

Render it where the compare stage renders (`stage === "compare"` block ~l.540) when `state.proof !== undefined`, passing `suggested` from the proposal ids kept in state; to keep ids after `proposalCleared`, store the suggested ids inside the reducer: in the `proposalProof` case copy `proposal` ids into `proof` by extending state with `proofSuggested: readonly string[]` computed from the current `state.proposal` (`[...(affectedActorIds ?? []), ...(affectedScriptIds ?? []), ...(affectedAssetIds ?? []), ...(affectedVariableIds ?? [])]`). Add to `i18n.ts` en: `evidenceInspector: "Evidence"`, `evidenceSuggested: "Suggested by AI"`, `evidenceAccepted: "Accepted by you"`, `evidenceProved: "Proved by the runtime"`, `proofProved: "proved"`, `proofPartial: "partly proved"`, `proofUnproven: "not proved yet"`, `proofMissing: "missing"`; es: `"Evidencia"`, `"Sugerido por la IA"`, `"Aceptado por vos"`, `"Probado por el runtime"`, `"probado"`, `"probado en parte"`, `"todavía sin probar"`, `"falta"`. Add the keys to the copy type the file declares.

- [ ] **Step 5: Run and commit**

Run: `corepack pnpm exec vitest run packages/studio-protocol packages/studio-ui` → PASS.

```bash
corepack pnpm lint && corepack pnpm format:check
git add packages/studio-protocol packages/studio-ui
git commit -m "feat(studio): proposalProof message and evidence inspector

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Studio host wiring (actor context and proof emission)

**Files:**

- Modify: `extensions/vscode/src/studioCore.ts` (`createProposalReview` ~l.1201, `createProposalSession` ~l.1208, `assertProposalFresh` ~l.1239, `actorsForProject` ~l.1375)
- Modify: `extensions/vscode/src/host/agentPort.ts` (`AgentPortDeps`, `applyPending`, `applySelection`, `rejectPending`, `run`), `host/agentHost.ts` (`AgentPort`, `decide`, `run` case), `studioRuntime.ts` l.331
- Test: `extensions/vscode/src/host/agentPort.test.ts`, `host/agentHost.test.ts`, `studioCore` tests

**Interfaces:**

- Consumes: Task 1 `createProposalReview(..., context)`, Task 2 `createProposalEvidenceView`.
- Produces: `AgentPort.proofFor(): ProposalProofSeed | undefined` and `AgentPort.run()` returning optional `trace`.

- [ ] **Step 1: Failing core test.** In the studioCore test file add: a project whose `metadata.actors` has two actors owning two scripts, a proposal declaring `actor:explorer` but editing the beacon script, and expect `createProposalSession(project, proposal)` to throw `ProposalValidationError` with code `ACTOR_SCOPE_VIOLATION`. Build the project with the same fixture helper that file's neighbouring `createProposalSession` tests use. Run `corepack pnpm exec vitest run extensions/vscode -t "actor scope"` → FAIL.

- [ ] **Step 2: Implement core.** In `studioCore.ts` import `type ProposalCreativeContext` from `@agorix/proposals` and change:

```ts
export function createProposalReview(
  acceptedProgram: ProjectProgram,
  proposal: ProgramProposal,
  context?: ProposalCreativeContext,
): ProposalReview {
  return createSharedProposalReview(acceptedProgram, proposal, context);
}

export function creativeContextForProject(project: StudioProject): ProposalCreativeContext {
  return { actors: actorsForProject(project.stored) };
}
```

In `createProposalSession` call `createProposalReview(project.stored.program, proposal, creativeContextForProject(project))`. In `assertProposalFresh(program, session)` keep the signature but add an optional third `context?: ProposalCreativeContext` forwarded to `createProposalReview`; in `agentPort.applyPending` and `applySelection` pass `creativeContextForProject(project)`. Run the step-1 test → PASS; run the whole `extensions/vscode` suite to catch fixtures whose actors do not own the proposal's scripts (fixtures without `affectedActorIds` are unaffected).

- [ ] **Step 3: Failing host test.** In `agentHost.test.ts`, using the fake port the file already builds, add a case: after `decideProposal` accepted and a `run` message, the returned messages include a `proposalProof` with `decision: "accepted"` and `proof.status: "proved"` when the fake `port.proofFor` returns a proved view; and after `decideProposal` rejected the host emits `proposalProof` with `decision: "rejected"` and no `proof`. Run → FAIL.

- [ ] **Step 4: Implement host + port.**
  1. In `agentHost.ts` extend `AgentPort` with:

  ```ts
  /** Evidence of the last decided proposal; `trace` binds it to the run that just happened. */
  proofFor?(input: { withRun: boolean }): HostProofSeed | undefined;
  ```

  and define `type HostProofSeed = Omit<Extract<HostMessage, { type: "proposalProof" }>, "schema" | "type">` (it is exactly the message body). 2. In `decide`, after the rejected branch's `port.rejectPending()` and after a successful apply, build `const proof = port.proofFor?.({ withRun: false })`; append `{ schema, type: "proposalProof", ...proof }` to the returned array when defined. Keep the message order: `cleared(), wf(), proposalProof` (and `predictionMsg()` last when predicting). 3. In the `run` case, after computing `observed`, call `const proof = port.proofFor?.({ withRun: true })` and append its `proposalProof` message after the `comparison` message. 4. In `agentPort.ts` keep `let lastDecision: { review: ProposalReview; audit: ProposalAuditEvent } | undefined` set in `applyPending` (from the `acceptProposalSession` result already used by `applyActiveProposal`: if that path does not return the audit, compute it with `acceptProposal(project.stored.program, session.review, creativeContextForProject(project)).audit` before applying), in `applySelection` (the `modifyProposalSession` decision's `audit`) and in `rejectPending` (`rejectProposal(...)`.audit). Implement `proofFor` with `createProposalEvidenceView(lastDecision.review, { audit: lastDecision.audit, ...(withRun ? { trace: lastRunTrace } : {}) })` and map the view to the message body (`decision`: `accepted|modified|rejected` from `audit.decision` `accept|modify|reject`; `proof` only when `view.proved` exists; `resultProgramHash` from `view.accepted`). 5. `lastRunTrace`: extend `AgentPortDeps.runAndGetResult` to return `{ world, stepsUsed, trace?: readonly RuntimeEvidenceTraceEntry[] }`, store the trace in `run()`. In `studioRuntime.ts` l.331 map the execution view's multi-actor trace: `trace: view.trace?.map((entry) => ({ nodeId: entry.nodeId, actorId: entry.actorId, scriptId: entry.scriptId }))`. If the execution view returned by `executionCommands.runExecution()` does not expose trace rows, add `trace: result.trace` (the `MultiActorRunResult.trace` used by `studioCore.ts` ~l.995) to that view type and its constructor.

- [ ] **Step 5: Run and commit**

Run: `corepack pnpm exec vitest run extensions/vscode` → PASS.

```bash
corepack pnpm lint && corepack pnpm format:check && corepack pnpm test
git add extensions/vscode
git commit -m "feat(studio): enforce actor scope and emit proposal proof

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: App actor context and evidence rows on the proposal card

**Files:**

- Modify: `apps/web/src/App.tsx` (`createProposalReview` calls ~l.3869, 3900, 3910; card ~l.4955; `proposalScopeRows` ~l.2851; run flow `createRuntimeFrames` ~l.3683)
- Modify: `apps/web/src/i18n.ts` (en ~l.53, es ~l.354)
- Test: `apps/web/src/App.test.tsx` or a new `apps/web/src/proposalEvidence.test.tsx`, `apps/web/src/crossSurfaceParity.test.ts`

**Interfaces:**

- Consumes: Task 1 context argument, Task 2 `createProposalEvidenceView`.
- Produces: i18n keys `proposalEvidenceSuggested`, `proposalEvidenceAccepted`, `proposalEvidenceProved`.

- [ ] **Step 1: Failing parity test** in `crossSurfaceParity.test.ts`: build one proposal with `affectedActorIds`/`affectedScriptIds`, call `createWebProposalCardView(review)` and `createProposalEvidenceView(review).suggested`, and assert the actor, script, asset and variable id arrays are equal. Also add an App-level test (copy the render/setup pattern of the existing `proposal-preview` tests) that a proposal for an actor the active project does not own is not shown (App falls back to the existing error message path). Run → FAIL where the new behavior is missing.

- [ ] **Step 2: Implement.** In `App.tsx`, derive the context once next to `creativeState`: `const proposalContext = useMemo(() => ({ actors: creativeState.actors ?? [] }), [creativeState.actors]);` and pass it as the third argument at all three `createProposalReview(...)` calls. Existing App proposals declare no `affectedActorIds`, so they are unaffected. Keep the last decision for the card: add `const [proposalDecision, setProposalDecision] = useState<{ review: ProposalReview; audit: ProposalAuditEvent } | undefined>()`; set it in `acceptDeterministicProposal` and `rejectDeterministicProposal` from the `ProposalDecisionResult.audit` they already receive (`acceptProposal(model.program, review, proposalContext)`); clear it when a new proposal review is created. Compute:

```ts
const proposalEvidence =
  proposalDecision === undefined
    ? undefined
    : createProposalEvidenceView(proposalDecision.review, {
        audit: proposalDecision.audit,
        ...(lastRunResult === undefined
          ? {}
          : {
              trace: lastRunResult.trace.map((entry) => ({
                nodeId: entry.nodeId,
                ...(entry.actorId === undefined ? {} : { actorId: entry.actorId }),
                ...(entry.scriptId === undefined ? {} : { scriptId: entry.scriptId }),
              })),
            }),
      });
```

Render under the card (the card disappears on decision, so render this block in the companion panel after `proposalCard`): a three-item list using `t(locale, "proposalEvidenceSuggested" | "proposalEvidenceAccepted" | "proposalEvidenceProved", { ids })` where the proved line is shown only when `proposalEvidence.proved` exists, with the status word and missing ids. Add i18n: en `"Suggested by AI: {ids}"`, `"Accepted by you ({decision})"`, `"Proved by the run: {status}"`; es `"Sugerido por la IA: {ids}"`, `"Aceptado por vos ({decision})"`, `"Probado por la ejecución: {status}"`.

- [ ] **Step 3: Failing then passing render test.** Accept a proposal in the App test harness, run the program, and expect the evidence list to show the three lines; reject a proposal and expect only the first two lines. Run `corepack pnpm exec vitest run apps/web` → PASS.

- [ ] **Step 4: Full gates and commit**

```bash
corepack pnpm lint && corepack pnpm format:check && corepack pnpm test && corepack pnpm build
git add apps/web
git commit -m "feat(app): actor-scoped proposals and suggested/accepted/proved evidence

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verification and PR

- [ ] **Step 1:** `corepack pnpm verify` on the branch (skip `pnpm install --frozen-lockfile` failures only if the lockfile is unchanged; report otherwise).
- [ ] **Step 2:** Update `docs/architecture/PROGRAMMING_MODEL.md` or `docs/architecture/adr/0007-shared-core-and-two-experiences.md` with a short "Actor-scoped proposals" paragraph (context argument, `ACTOR_SCOPE_VIOLATION`, `creativeContextHash`) and commit as `docs:`.
- [ ] **Step 3:** Push and open a PR titled `feat: actor-scoped proposals and evidence inspector (#319)` with the spec link and the checked acceptance list; report CI result.
