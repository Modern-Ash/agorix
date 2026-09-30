import { describe, expect, it } from "vitest";
import {
  ASSISTANCE_CREDIT,
  ASSISTANCE_LEVELS,
  COMPETENCIES,
  MissionAssessmentError,
  SYNTHETIC_ASSISTED_ATTEMPT,
  SYNTHETIC_FIRST_MISSION_ATTEMPT,
  SYNTHETIC_REPORTS,
  SYNTHETIC_SCORES,
  assessMission,
  assertAssistanceCreditMonotonic,
  describeRetention,
  understandingScore,
  type AssistanceLevel,
  type LearningEvidenceEvent,
  type MissionAssessmentReport,
} from "./index.js";

const indicatorFor = (report: MissionAssessmentReport, competencyId: string) => {
  const indicator = report.understanding.indicators.find(
    (candidate) => candidate.competencyId === competencyId,
  );
  if (indicator === undefined) {
    throw new Error(`missing indicator ${competencyId}`);
  }
  return indicator;
};

const retag = (
  events: readonly LearningEvidenceEvent[],
  assistanceLevel: AssistanceLevel,
): readonly LearningEvidenceEvent[] =>
  events.map((event) => ({ ...event, assistanceLevel }) as LearningEvidenceEvent);

const assess = (events: readonly LearningEvidenceEvent[]): MissionAssessmentReport =>
  assessMission({ missionId: "first-mission.reach-goal", missionVersion: 1, events });

describe("assessMission input validation", () => {
  it("requires a mission id", () => {
    expect(() => assessMission({ missionId: "", missionVersion: 1, events: [] })).toThrow(
      MissionAssessmentError,
    );
  });

  it("requires a positive mission version", () => {
    expect(() => assessMission({ missionId: "m", missionVersion: 0, events: [] })).toThrow(
      /positive integer/,
    );
  });

  it("propagates evidence validation failures", () => {
    expect(() =>
      assessMission({
        missionId: "m",
        missionVersion: 1,
        events: [{ schema: "agorix/learning-evidence-event/v1", id: "x", sequence: 0 }],
      }),
    ).toThrow(/expected one of/);
  });

  it("assesses an empty history without claiming completion or understanding", () => {
    const report = assess([]);
    expect(report.completion.completed).toBe(false);
    expect(report.completion.runtimeOutcome).toBe("notRun");
    expect(report.understanding.demonstrated).toEqual([]);
    expect(report.understanding.notObserved).toHaveLength(COMPETENCIES.length - 1);
    expect(report.peakAssistanceLevel).toBe("independent");
  });
});

describe("AC-001 evidence maps to competencies from #70", () => {
  it("emits one indicator per catalog competency", () => {
    const report = assess(SYNTHETIC_FIRST_MISSION_ATTEMPT);
    expect(report.understanding.indicators).toHaveLength(COMPETENCIES.length);
    expect(report.understanding.indicators.map((indicator) => indicator.competencyId)).toEqual(
      COMPETENCIES.map((competency) => competency.id),
    );
  });

  it("demonstrates only competencies with learner-authored evidence", () => {
    const report = assess(SYNTHETIC_FIRST_MISSION_ATTEMPT);
    expect(indicatorFor(report, "collaboration.predictingBehavior").status).toBe("demonstrated");
    expect(indicatorFor(report, "programming.sequence").status).toBe("demonstrated");
    expect(indicatorFor(report, "programming.debugging").status).toBe("demonstrated");
    expect(indicatorFor(report, "programming.readingCode").status).toBe("demonstrated");
    expect(indicatorFor(report, "collaboration.expressingIntent").status).toBe("demonstrated");
    expect(indicatorFor(report, "aiLiteracy.runtimeEvidenceMatters").status).toBe("demonstrated");
  });

  it("leaves competencies without evidence unobserved", () => {
    const report = assess(SYNTHETIC_FIRST_MISSION_ATTEMPT);
    expect(indicatorFor(report, "collaboration.comparingAlternatives").status).toBe("notObserved");
    expect(indicatorFor(report, "aiLiteracy.modelsCanDisagree").status).toBe("notObserved");
    expect(indicatorFor(report, "programming.state.variables").status).toBe("notObserved");
  });

  it("derives competencies from the revision kind, not the whole trace", () => {
    const report = assess(SYNTHETIC_FIRST_MISSION_ATTEMPT);
    expect(indicatorFor(report, "programming.repetition").status).toBe("notObserved");
    expect(indicatorFor(report, "programming.conditions").status).toBe("notObserved");
  });

  it("records the supporting event ids for every demonstrated competency", () => {
    const report = assess(SYNTHETIC_FIRST_MISSION_ATTEMPT);
    const indicator = indicatorFor(report, "programming.debugging");
    expect(indicator.supportingEventIds).toContain("ev-8");
    expect(indicator.rationale).toContain("using runtime evidence");
    expect(indicator.source).toBe("learnerEvidence");
  });

  it("credits authorship for an explicit decision even when the diff was not opened", () => {
    // Regression: signals were once matched to competencies by array position, so
    // `learnerIsAuthor` inherited the diff-inspection signal and scored `partial`
    // for a plain accept. The spec says authorship follows the decision itself.
    const report = assess([
      {
        schema: "agorix/learning-evidence-event/v1",
        id: "p-3",
        sequence: 1,
        kind: "proposalDecided",
        decision: "accept",
        inspectedDiff: false,
        testedWithRuntime: false,
        challengedCompanion: false,
        assistanceLevel: "proposed",
      },
    ]);
    expect(indicatorFor(report, "aiLiteracy.learnerIsAuthor").status).toBe("demonstrated");
    expect(indicatorFor(report, "collaboration.decidingOnProposals").status).toBe("demonstrated");
    // Accepting without checking is still not skepticism.
    expect(indicatorFor(report, "aiLiteracy.aiCanBeWrong").status).toBe("partial");
    expect(indicatorFor(report, "collaboration.inspectingProposals").status).toBe("partial");
  });

  it("counts a revision that followed a failed run as debugging", () => {
    const report = assess([
      {
        schema: "agorix/learning-evidence-event/v1",
        id: "r-1",
        sequence: 1,
        kind: "programRevisedAfterExecution",
        revisionKind: "loopChange",
        changedNodeCount: 2,
        afterUnsuccessfulRun: true,
        assistanceLevel: "independent",
      },
    ]);
    expect(indicatorFor(report, "programming.debugging").status).toBe("demonstrated");
    expect(indicatorFor(report, "programming.repetition").status).toBe("demonstrated");
  });

  it("does not count a revision that followed a successful run as debugging", () => {
    const report = assess([
      {
        schema: "agorix/learning-evidence-event/v1",
        id: "r-2",
        sequence: 1,
        kind: "programRevisedAfterExecution",
        revisionKind: "loopChange",
        changedNodeCount: 2,
        afterUnsuccessfulRun: false,
        assistanceLevel: "independent",
      },
    ]);
    expect(indicatorFor(report, "programming.debugging").status).toBe("notObserved");
    expect(indicatorFor(report, "programming.repetition").status).toBe("demonstrated");
  });

  it("derives model-disagreement evidence from a justified comparison", () => {
    const events = (decisionJustified: boolean): LearningEvidenceEvent[] => [
      {
        schema: "agorix/learning-evidence-event/v1",
        id: "m-1",
        sequence: 1,
        kind: "modelComparisonDecided",
        alternativesCompared: 2,
        decisionJustified,
        assistanceLevel: "independent",
      },
    ];
    expect(indicatorFor(assess(events(true)), "aiLiteracy.modelsCanDisagree").status).toBe(
      "demonstrated",
    );
    const unjustified = assess(events(false));
    expect(indicatorFor(unjustified, "aiLiteracy.modelsCanDisagree").status).toBe("partial");
    expect(indicatorFor(unjustified, "collaboration.comparingAlternatives").status).toBe("partial");
  });

  it("never credits a competency the event kind does not trace", () => {
    // A completed run proves completion only; it must not credit any competency.
    const report = assess([
      {
        schema: "agorix/learning-evidence-event/v1",
        id: "c-1",
        sequence: 1,
        kind: "missionCompleted",
        runtimeOutcome: "completed",
        assistanceLevel: "delegated",
      },
    ]);
    expect(report.understanding.demonstrated).toEqual([]);
  });
});

describe("AC-002 completion is distinct from understanding", () => {
  it("never claims completion implies understanding", () => {
    const report = assess(SYNTHETIC_ASSISTED_ATTEMPT);
    expect(report.completion.completed).toBe(true);
    expect(report.completion.impliesUnderstanding).toBe(false);
  });

  it("reports completion without any demonstrated understanding", () => {
    const report = assess(SYNTHETIC_ASSISTED_ATTEMPT);
    expect(report.completion.completed).toBe(true);
    expect(report.understanding.demonstrated).toEqual([]);
    expect(report.understanding.schemaInvariantsProven).toEqual([
      "aiLiteracy.privateDataUnnecessary",
    ]);
    expect(report.interpretation.cautions.join(" ")).toMatch(/completion is not understanding/);
  });

  it("derives completion only from the deterministic runtime outcome", () => {
    const notCompleted = assess([
      ...SYNTHETIC_FIRST_MISSION_ATTEMPT.filter(
        (event) => !(event.kind === "missionCompleted" && event.runtimeOutcome === "completed"),
      ),
    ]);
    expect(notCompleted.completion.completed).toBe(false);
    expect(notCompleted.completion.basis).toBe("deterministicRuntime");
  });

  it("uses the last runtime outcome when several are recorded", () => {
    const report = assess([
      ...SYNTHETIC_FIRST_MISSION_ATTEMPT,
      {
        schema: "agorix/learning-evidence-event/v1",
        id: "ev-10",
        sequence: 10,
        kind: "missionCompleted",
        runtimeOutcome: "error",
        assistanceLevel: "independent",
      },
    ]);
    expect(report.completion.runtimeOutcome).toBe("error");
    expect(report.completion.completed).toBe(false);
  });

  it("keeps completion and understanding as separate statements", () => {
    const report = assess(SYNTHETIC_ASSISTED_ATTEMPT);
    expect(report.interpretation.completionStatement).toMatch(/Runtime proved completion/);
    expect(report.interpretation.understandingStatement).toMatch(/No competency is demonstrated/);
  });
});

describe("AC-003 assistance level is visible in interpretation", () => {
  it("surfaces the peak assistance level in the interpretation", () => {
    const report = assess(SYNTHETIC_ASSISTED_ATTEMPT);
    expect(report.peakAssistanceLevel).toBe("delegated");
    expect(report.interpretation.assistanceStatement).toBe("Peak assistance level: delegated.");
  });

  it("names the assistance level in every indicator rationale", () => {
    const report = assess(SYNTHETIC_FIRST_MISSION_ATTEMPT);
    for (const indicator of report.understanding.indicators) {
      expect(indicator.rationale).toContain(`assistance level ${indicator.assistanceLevel}`);
    }
  });

  it("raises a caution when the AI did the work", () => {
    const report = assess(SYNTHETIC_ASSISTED_ATTEMPT);
    expect(report.interpretation.cautions.join(" ")).toMatch(/delegated to the AI/);
  });

  it("flags a solution delivered before the learner acted", () => {
    const report = assess(SYNTHETIC_ASSISTED_ATTEMPT);
    expect(report.overAssistanceFlags.map((flag) => flag.code)).toContain(
      "aiSolvedBeforeLearnerActed",
    );
  });

  it("flags a proposal accepted without inspection", () => {
    const report = assess([
      {
        schema: "agorix/learning-evidence-event/v1",
        id: "p-1",
        sequence: 1,
        kind: "proposalDecided",
        decision: "accept",
        inspectedDiff: false,
        testedWithRuntime: false,
        challengedCompanion: false,
        assistanceLevel: "proposed",
      },
    ]);
    expect(report.overAssistanceFlags.map((flag) => flag.code)).toContain(
      "proposalAcceptedWithoutInspection",
    );
    expect(indicatorFor(report, "collaboration.inspectingProposals").status).toBe("partial");
    expect(indicatorFor(report, "collaboration.challengingAiAnswer").status).toBe("partial");
  });

  it("marks inspection, testing and challenge as demonstrated only when they happened", () => {
    const report = assess([
      {
        schema: "agorix/learning-evidence-event/v1",
        id: "p-2",
        sequence: 1,
        kind: "proposalDecided",
        decision: "modify",
        inspectedDiff: true,
        testedWithRuntime: true,
        challengedCompanion: true,
        assistanceLevel: "independent",
      },
    ]);
    expect(indicatorFor(report, "collaboration.inspectingProposals").status).toBe("demonstrated");
    expect(indicatorFor(report, "collaboration.testingProposals").status).toBe("demonstrated");
    expect(indicatorFor(report, "collaboration.challengingAiAnswer").status).toBe("demonstrated");
    expect(indicatorFor(report, "aiLiteracy.aiCanBeWrong").status).toBe("demonstrated");
    expect(indicatorFor(report, "aiLiteracy.learnerIsAuthor").status).toBe("demonstrated");
  });
});

describe("AC-004 no sensitive profiling required", () => {
  it("proves the private-data competency from the schema invariant alone", () => {
    const report = assess([]);
    const indicator = indicatorFor(report, "aiLiteracy.privateDataUnnecessary");
    expect(indicator.status).toBe("demonstrated");
    expect(indicator.source).toBe("schemaInvariant");
    expect(indicator.supportingEventIds).toEqual(["schema:evidence-validation"]);
    expect(report.understanding.schemaInvariantsProven).toEqual([
      "aiLiteracy.privateDataUnnecessary",
    ]);
  });

  it("never counts a schema invariant as learner understanding", () => {
    const report = assess([]);
    expect(report.understanding.demonstrated).not.toContain("aiLiteracy.privateDataUnnecessary");
    expect(understandingScore(report)).toBe(0);
  });

  it("rejects an event carrying a learner name", () => {
    expect(() =>
      assessMission({
        missionId: "m",
        missionVersion: 1,
        events: [
          {
            schema: "agorix/learning-evidence-event/v1",
            id: "e",
            sequence: 1,
            kind: "codeViewUsed",
            view: "agorixCode",
            assistanceLevel: "independent",
            learnerName: "Sam",
          },
        ],
      }),
    ).toThrow(/PROHIBITED_FIELD/);
  });

  it("never records reflection text", () => {
    const report = assess(SYNTHETIC_FIRST_MISSION_ATTEMPT);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(/"text"|"freeText"/);
  });
});

describe("AC-005 data fields and retention assumptions are documented", () => {
  it("assigns a retention class to every documented field", () => {
    const documented = describeRetention();
    expect(documented.length).toBeGreaterThan(0);
    for (const entry of documented) {
      expect(entry.retention).toBeTruthy();
      expect(entry.purpose.length).toBeGreaterThan(10);
    }
  });

  it("stores reflection handling as not-stored metadata", () => {
    const entries = describeRetention();
    expect(entries.find((entry) => entry.field === "contentRetained")?.retention).toBe("notStored");
    expect(entries.find((entry) => entry.field === "storage")?.retention).toBe("notStored");
  });

  it("keeps order and assistance metadata in session memory only", () => {
    const entries = describeRetention();
    expect(entries.find((entry) => entry.field === "sequence")?.retention).toBe("sessionMemory");
    expect(entries.find((entry) => entry.field === "assistanceLevel")?.retention).toBe(
      "sessionMemory",
    );
  });
});

describe("AC-006 metrics cannot reward over-assistance by default", () => {
  it("keeps assistance credit non-increasing in assistance rank", () => {
    expect(() => assertAssistanceCreditMonotonic()).not.toThrow();
    for (let i = 1; i < ASSISTANCE_LEVELS.length; i += 1) {
      const previous = ASSISTANCE_LEVELS[i - 1] as AssistanceLevel;
      const current = ASSISTANCE_LEVELS[i] as AssistanceLevel;
      expect(ASSISTANCE_CREDIT[current]).toBeLessThanOrEqual(ASSISTANCE_CREDIT[previous]);
    }
  });

  it("gives zero credit to delegated assistance", () => {
    expect(ASSISTANCE_CREDIT.delegated).toBe(0);
  });

  it("scores an AI-solved attempt below a learner-led attempt with the same completion", () => {
    expect(SYNTHETIC_REPORTS.assistedAttempt.completion.completed).toBe(true);
    expect(SYNTHETIC_REPORTS.learnerAttempt.completion.completed).toBe(true);
    expect(SYNTHETIC_SCORES.assistedAttempt).toBeLessThan(SYNTHETIC_SCORES.learnerAttempt);
  });

  it("never increases the score as assistance grows on identical evidence", () => {
    const scores = ASSISTANCE_LEVELS.map((level) =>
      understandingScore(assess(retag(SYNTHETIC_FIRST_MISSION_ATTEMPT, level))),
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1] as number);
    }
    expect(scores[0]).toBeGreaterThan(0);
  });

  it("gives the same score for fully delegated evidence regardless of how many events", () => {
    const one = understandingScore(assess(retag(SYNTHETIC_ASSISTED_ATTEMPT, "delegated")));
    const many = understandingScore(
      assess([
        ...retag(SYNTHETIC_ASSISTED_ATTEMPT, "delegated"),
        ...retag(
          SYNTHETIC_FIRST_MISSION_ATTEMPT.map((event) => ({ ...event, id: `x-${event.id}` })),
          "delegated",
        ),
      ]),
    );
    expect(one).toBe(many);
  });

  it("can score a single dimension", () => {
    const report = assess(SYNTHETIC_FIRST_MISSION_ATTEMPT);
    const programming = understandingScore(report, "programming");
    const all = understandingScore(report);
    expect(programming).toBeGreaterThan(0);
    expect(programming).not.toBe(all);
    expect(understandingScore(report, "aiLiteracy")).toBeGreaterThanOrEqual(0);
  });

  it("returns zero for a dimension with no evidence", () => {
    expect(understandingScore(assess([]), "collaboration")).toBe(0);
  });
});

describe("synthetic report fixture", () => {
  it("contains no real identifiers", () => {
    const serialized = JSON.stringify({
      learner: SYNTHETIC_FIRST_MISSION_ATTEMPT,
      assisted: SYNTHETIC_ASSISTED_ATTEMPT,
    });
    expect(serialized).not.toMatch(/@|learnerName|userId|school/);
  });

  it("keeps the learner attempt free of over-assistance flags", () => {
    expect(SYNTHETIC_REPORTS.learnerAttempt.overAssistanceFlags).toHaveLength(0);
    expect(SYNTHETIC_REPORTS.learnerAttempt.peakAssistanceLevel).toBe("hinted");
  });
});
