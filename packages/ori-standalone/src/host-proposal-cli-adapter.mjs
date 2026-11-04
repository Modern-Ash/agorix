import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderError } from "./providers.mjs";
import { hostProposalPrompt } from "./host-proposal-request.mjs";

const MAX_OUTPUT_BYTES=8192;
const DISABLED_TOOLS=[
  "shell_tool","apps","browser_use","computer_use","image_generation",
  "view_image","skill_search","tool_suggest","multi_agent","code_mode_host"
];
function safeEnv(extra={}) {
  const env={};
  for (const name of ["PATH","HOME","USER","LANG","XDG_CONFIG_HOME","XDG_DATA_HOME","XDG_CACHE_HOME","CODEX_HOME"])
    if (process.env[name]!==undefined) env[name]=process.env[name];
  return {...env,...extra};
}
function killGroup(pid) {
  if (!pid) return;
  try { process.kill(-pid,"SIGKILL"); }
  catch { try { process.kill(pid,"SIGKILL"); } catch {} }
}
/** Fixed executable, no shell, bounded bytes and time; model output is never logged. */
export function runBoundedProposalCli(command,args,{input="",cwd,env,signal,timeoutMs=5000}={}) {
  return new Promise((resolve,reject)=>{
    if (signal?.aborted) return reject(new ProviderError("Provider cancelled"));
    const child=spawn(command,args,{cwd,env,stdio:["pipe","pipe","pipe"],shell:false,detached:true});
    const output=[];
    let size=0,settled=false;
    const finish=(error,value)=>{
      if (settled) return;
      settled=true;
      clearTimeout(timer);
      signal?.removeEventListener("abort",onAbort);
      if (error) { killGroup(child.pid); reject(error); }
      else resolve(value);
    };
    const onAbort=()=>finish(new ProviderError("Provider cancelled"));
    const timer=setTimeout(()=>finish(new ProviderError("Provider timeout")),timeoutMs);
    signal?.addEventListener("abort",onAbort,{once:true});
    const collect=(chunk,keep)=>{
      size+=chunk.length;
      if (size>MAX_OUTPUT_BYTES) return finish(new ProviderError("Provider response too large"));
      if (keep) output.push(chunk);
    };
    child.stdout.on("data",chunk=>collect(chunk,true));
    child.stderr.on("data",chunk=>collect(chunk,false));
    child.stdin.on("error",()=>{});
    child.stdin.end(input);
    child.on("error",()=>finish(new ProviderError("Provider unavailable")));
    child.on("close",code=>code===0
      ? finish(null,Buffer.concat(output).toString("utf8"))
      : finish(new ProviderError("Provider failed")));
  });
}
function parseOpenCode(output) {
  let text;
  try {
    for (const line of output.split("\n")) {
      if (!line.trim()) continue;
      const event=JSON.parse(line);
      if (event.type==="tool") throw new ProviderError("Model tool was attempted");
      if (event.type==="text" && typeof event.part?.text==="string") text=event.part.text;
    }
  } catch { throw new ProviderError("Invalid OpenCode response"); }
  if (!text) throw new ProviderError("Empty OpenCode response");
  return text;
}
export function createHostProposalCliAdapter({provider,bin,model="gpt-6-luna",run=runBoundedProposalCli}={}) {
  if (!["codex","opencode"].includes(provider) ||
      typeof bin!=="string" || !/^[a-zA-Z0-9_./-]{1,200}$/.test(bin) ||
      typeof model!=="string" || !/^[a-zA-Z0-9_.:/-]{1,80}$/.test(model) ||
      typeof run!=="function") throw new ProviderError("Invalid CLI provider policy");
  return Object.freeze({
    async complete(request,{signal}={}) {
      const prompt=hostProposalPrompt(request);
      const directory=mkdtempSync(join(tmpdir(),"ori-proposal-"));
      try {
        const codex=provider==="codex";
        const args=codex
          ? ["exec","--ignore-user-config","--ephemeral","--skip-git-repo-check",
              "--sandbox","read-only","--cd",directory,"--model",model,
              ...DISABLED_TOOLS.flatMap(feature=>["--disable",feature]),"-"]
          : ["run","--pure","--format","json","--agent","ori-proposal",prompt];
        const env=safeEnv(codex?{}:{
          OPENCODE_PERMISSION:'"deny"',OPENCODE_DISABLE_DEFAULT_PLUGINS:"1",
          OPENCODE_DISABLE_CLAUDE_CODE:"1",
          OPENCODE_CONFIG_CONTENT:JSON.stringify({permission:"deny",tools:{"*":false},
            agent:{"ori-proposal":{mode:"primary",prompt:"Return one JSON proposal only.",
              permission:"deny",tools:{"*":false}}}})
        });
        const output=await run(bin,args,{input:codex?prompt:"",cwd:directory,env,signal,timeoutMs:5000});
        return {message:codex?output.trim():parseOpenCode(output)};
      } finally { rmSync(directory,{recursive:true,force:true}); }
    }
  });
}
