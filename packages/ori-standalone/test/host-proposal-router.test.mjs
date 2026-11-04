import test from "node:test";
import assert from "node:assert/strict";
import { createHostProposalRouter, hostProposalRouterFromEnv } from "../src/host-proposal-router.mjs";
import { runBoundedProposalCli } from "../src/host-proposal-cli-adapter.mjs";
import { ProviderError } from "../src/providers.mjs";

const request={intent:"move",learningStage:"connect",attempts:1,hintsUsed:1,
 allowedBlocks:["move"],traceStepCount:2};
const proposal=JSON.stringify({schemaVersion:"ori/proposal/v0",operation:"append",
 requiresLearnerApproval:true,blocks:[{kind:"move",steps:2}]});
const response=(value)=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(value)});

test("host proposal models are opt-in",()=>{
 assert.equal(hostProposalRouterFromEnv({}),undefined);
});
test("host policy rejects invalid total budget and counts provider outcomes without content",async()=>{
 assert.throws(()=>hostProposalRouterFromEnv({ORI_HOST_PROPOSAL_PROVIDER:"codex",ORI_HOST_PROPOSAL_TOTAL_BUDGET_MS:"0"}),ProviderError);
 const router=createHostProposalRouter({mode:"codex",runCli:async()=>proposal});
 assert.equal((await router.complete(request)).source,"codex");
 const metrics=router.metrics();
 assert.equal(metrics.modelResponses,1);
 assert.equal(metrics.providers.codex.successes,1);
 assert.equal(JSON.stringify(metrics).includes(proposal),false);
});
test("auto mode switches local transports after a failed provider",async()=>{
 const calls=[];
 const router=createHostProposalRouter({mode:"auto",fetchImpl:async(url,options)=>{
  calls.push(url);
  const body=JSON.parse(options.body);
  assert.equal(body.messages[0].content.includes("synthetic-child"),false);
  assert.equal(options.redirect,"error");
  if(url.endsWith("/api/chat")) throw Error("Ollama unavailable");
  return response({choices:[{message:{content:proposal}}]});
 }});
 const result=await router.complete(request);
 assert.equal(result.source,"compatible");
 assert.equal(result.message,proposal);
 assert.equal(calls.length,2);
});
test("loopback-only configuration and minimized request are enforced",async()=>{
 assert.throws(()=>createHostProposalRouter({mode:"ollama",ollamaEndpoint:"https://example.com"}));
 assert.throws(()=>createHostProposalRouter({mode:"compatible",compatibleEndpoint:"http://127.0.0.1:4096/path"}));
 const router=createHostProposalRouter({mode:"ollama",fetchImpl:async()=>{
  throw Error("should not call");
 }});
 const result=await router.complete({...request,childMessage:"synthetic-child"});
 assert.equal(result.fallback,true);
});
test("CLI auto mode denies tools and switches from Codex to OpenCode",async()=>{
 const calls=[];
 const router=createHostProposalRouter({mode:"cli-auto",timeoutMs:5000,runCli:async(bin,args,options)=>{
  calls.push({bin,args,options});
  if(bin==="codex") throw Error("unavailable");
  return JSON.stringify({type:"text",part:{text:proposal}});
 }});
 const result=await router.complete(request);
 assert.equal(result.source,"opencode");
 assert.equal(result.message,proposal);
 assert.deepEqual(calls.map(call=>call.bin),["codex","opencode"]);
 assert.ok(calls[0].args.includes("--ignore-user-config"));
 assert.ok(calls[0].args.includes("shell_tool"));
 assert.equal(calls[0].options.input.includes("traceStepCount"),false);
 assert.equal(calls[1].options.env.OPENCODE_PERMISSION,'"deny"');
 assert.equal(calls[1].options.env.OPENCODE_DISABLE_DEFAULT_PLUGINS,"1");
});
test("CLI rejects model tool events and falls back deterministically",async()=>{
 const router=createHostProposalRouter({mode:"opencode",runCli:async()=>
  JSON.stringify({type:"tool",part:{name:"bash"}})});
 assert.equal((await router.complete(request)).fallback,true);
});
test("CLI process bounds output and wall time",async()=>{
 await assert.rejects(runBoundedProposalCli(process.execPath,["-e","process.stdout.write('x'.repeat(10000))"],{
  input:"",cwd:process.cwd(),env:process.env,timeoutMs:1000
 }),ProviderError);
 await assert.rejects(runBoundedProposalCli(process.execPath,["-e","setTimeout(()=>{},5000)"],{
  input:"",cwd:process.cwd(),env:process.env,timeoutMs:30
 }),ProviderError);
});
