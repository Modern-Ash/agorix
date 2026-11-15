# MIG-04 trusted pedagogical context integration

The new `createOriMig04PgLearningContext(pool)` reads persisted pedagogical observations scoped by both authenticated owner and canonical project. It returns null on missing, malformed or out-of-range evidence; it never derives attempts or hints from unrelated metadata and never fabricates a learning stage.

Deploy the exported `ORI_MIG04_LEARNING_CONTEXT_SCHEMA_SQL` through the migration pipeline. The web learning workflow must populate `agorix_ori_learning_context` from genuine learner events (attempts, hints used, stage) before Ori can propose. The provider can then be injected as `learningContext` into the existing trusted host composition.

**Release blockers remain:** the web learning event writer is not yet connected to this table; production `main.ts` still lacks trusted composition for learning context, world state and rollout; and an authenticated HTTP -> independent Ori process -> PostgreSQL fenced CAS successful apply has not been demonstrated. Do not enable the pilot or mark #1007 complete until those paths are verified.
