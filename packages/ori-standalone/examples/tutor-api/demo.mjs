import { createReferenceTutorServer } from "./server.mjs";

const program = { schema: "agorix/program/v1", scripts: [
  { id: "s1", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] }
] };
const runResult = { outcome: "completed", trace: [
  { step: 1, statementType: "move", nodeId: "example", path: "example" }
] };
const server = createReferenceTutorServer({ program, runResult });
server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/example/ori`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "quiero llegar al planeta", attempts: 2, hintsUsed: 2, allowProposal: true })
    });
    console.log(JSON.stringify(await response.json(), null, 2));
  } finally { server.close(); }
});
