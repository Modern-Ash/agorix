#!/usr/bin/env python3
import json

answers = {
    "questions": [
        {
            "question": "What is the full intent and acceptance criteria from GitHub issue #110, since the governed context only references the issue URL and does not include its contents?",
            "answer": (
                "Issue #110 asks Agorix to become a multilingual learning product for UI, curriculum, "
                "and Learning Companion. English and Spanish must be selectable; locale switching must not "
                "change canonical program hash or semantics; First Mission, run controls, proposal review, "
                "execution evidence, deterministic fake tutor, real-provider locale context, safety-critical "
                "copy, fallback, missing-translation diagnostics, third-locale extensibility, and README parity "
                "must be verified. The full elaborated trace is captured in INT-110.md, REQUIREMENTS.md, "
                "MEASUREMENT_CRITERIA.md, UNITS.md, BOLTS.md, and RISK_REGISTER.md."
            ),
        },
        {
            "question": "Has a Level 1 plan artifact been produced and approved for this work, as required by the AI-SDLC inception-approved gate?",
            "answer": (
                "A Level 1 plan artifact has been produced and registered as kind plan at "
                ".agora/ai-sdlc/handoffs/issue-110/LEVEL1_PLAN.md. It still requires explicit Product Owner "
                "and Developer approval before construction; no human approval has been inferred."
            ),
        },
        {
            "question": "Has a bolt-plan artifact been produced and approved for this work, as required by the AI-SDLC inception-approved gate?",
            "answer": (
                "A bolt-plan artifact has been produced and registered as kind bolt-plan at "
                ".agora/ai-sdlc/handoffs/issue-110/BOLTS.md. It decomposes delivery into foundation, "
                "curriculum, UI, companion, and evidence/docs bolts. It still requires explicit governed "
                "approval before construction."
            ),
        },
        {
            "question": "Are there any issue-specific NFRs, risks, measurement criteria, units of work, or suggested bolts that must be validated during inception before construction can begin?",
            "answer": (
                "Yes. The registered artifacts define issue-specific NFRs around safety, deterministic fallback, "
                "semantic integrity, maintainability, extensibility, accessibility, layout resilience, and "
                "developer diagnostics. Measurement criteria include EN/ES selection evidence, hash invariance, "
                "First Mission catalog completeness, localized UI/evidence controls, tutor locale behavior, "
                "provider locale propagation, missing-key diagnostics, third-locale extensibility, README parity, "
                "and repository verification. Risks include scope creep, safety translation drift, accidental "
                "semantic mutation, hard-coded strings, Spanish layout overflow, quiet missing keys, dependency "
                "fit, and README parity subjectivity."
            ),
        },
    ]
}

print(json.dumps(answers))
