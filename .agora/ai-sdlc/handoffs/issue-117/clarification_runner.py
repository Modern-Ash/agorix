#!/usr/bin/env python3
import json

print(json.dumps({
    "questions": [
        {
            "question": "What are the actual acceptance criteria from GitHub issue #117 that must be satisfied before the `inception-approved` gate can be evaluated?",
            "answer": "Issue #117 acceptance requires the design system to be distinguishable from Scratch, provide reusable Web/Studio tokens, include coherent light/dark variants, keep block/category color semantic rather than dominant, support EN/ES text expansion, document touch targets, and be implementable without private design context. These criteria are traced in REQUIREMENTS.md and MEASUREMENT_CRITERIA.md.",
        },
        {
            "question": "Where are the required Level 1 `plan` and `bolt-plan` artifacts for this work item, since the AI-SDLC Method Pack requires those artifact kinds for the gate?",
            "answer": "The Level 1 plan is registered as kind plan at .agora/ai-sdlc/handoffs/issue-117/LEVEL1_PLAN.md. The bolt plan is registered as kind bolt-plan at .agora/ai-sdlc/handoffs/issue-117/BOLTS.md.",
        },
        {
            "question": "Are there any referenced specifications, NFRs, risks, Measurement Criteria, Units of Work, or suggested Bolts beyond GitHub issue #117 that must be validated during inception?",
            "answer": "Yes. The inception proposal incorporates #116, AGENTS.md, docs/delivery/IMPLEMENTATION_ORDER.md, docs/product/PRODUCT_INTENT.md, docs/product/LEARNER_JOURNEY.md, docs/product/UX_REQUIREMENTS.md and ADR 0003 for i18n. NFRs, risks, measurement criteria, units and bolts are registered in NFR.md, RISK_REGISTER.md, MEASUREMENT_CRITERIA.md, UNITS.md and BOLTS.md.",
        },
    ]
}))
