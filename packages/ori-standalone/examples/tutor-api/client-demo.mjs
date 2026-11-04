import { createReferenceTutorServer } from "./server.mjs";
import { createTutorClient } from "../../src/tutor-client.mjs";
const program = { schema: "agorix/program/v1", scripts: [{ id: "s1", trigger: { type: "onStart" }, statements: [] }] };
const runResult = { outcome: "completed", trace: [{ step: 1, statementType: "move" }] };
const server = createReferenceTutorServer({ program, runResult });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const client = createTutorClient({ endpoint: `http://127.0.0.1:${server.address().port}/api/example/ori` });
  const result = await client.ask({ message: "quiero llegar", attempts: 2, hintsUsed: 2, allowProposal: true });
  console.log(JSON.stringify(result, null, 2));
} finally { await new Promise(resolve => server.close(resolve)); }
