# Ori v2 real-process vertical integration gate

This increment extends the cross-repository CI gate with a persisted-program scenario. A server-owned synthetic project is executed through Agorix's canonical `runProgram` runtime, transformed into bounded evidence, passed to the independent Ori host-evidence CLI, and returned as a review-only ticket. The test checks owner isolation, learner rejection, and zero repository writes. A second scenario requires the workflow to fail closed without trusted learning history.

The test uses synthetic repository and pedagogical context fixtures; it is **not** proof of deployed authentication, real project persistence, production world derivation, or a child-facing UI. Those remain release gates. The CI gate requires `ORI_REPO_PATH` and runs the real Ori process, so the scenario is not silently skipped there.

Related Ori issues #16 #17 #18 #23 #28 #29. Agorix PR target: `integration/ori` only.
