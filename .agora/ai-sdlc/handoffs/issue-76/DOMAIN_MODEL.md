# Domain Model - issue #76

## ExecutionStep

A shared presentation-neutral step derived from runtime observations. Each step has:

- `index`: stable position in the observation sequence;
- `runtimeStep`: runtime counter from the interpreter;
- `nodeId`: canonical node id, omitted only for run completion;
- `statementType`: canonical statement type when available;
- `timing`: child-readable phase (`before-statement`, `after-statement`, `enter-repeat`, `complete-repeat`, `evaluate-condition`, `complete-condition`, `complete`);
- `frame`: stage render frame for the same observation;
- `observation`: original runtime observation.

Web and Studio consume this same contract so presentation can differ while canonical observations remain identical.
