import test from "node:test";
import assert from "node:assert/strict";
import {assessOpenCodeSmokeReadiness,requireOpenCodeSmokeReadiness} from "../src/opencode-smoke-preflight.mjs";
import {ProviderError} from "../src/providers.mjs";
const verified={version:"1.2.3",expectedVersion:"1.2.3",workspace:"/tmp/ori-opencode-disposable",isolated:true,credentialsAbsent:true,networkRestricted:true,effectivePermissionsVerified:true,toolDenialVerified:true};
test("defaults to not ready",()=>assert.equal(assessOpenCodeSmokeReadiness().ready,false));
test("complete operator evidence passes preflight but does not prove isolation",()=>assert.equal(requireOpenCodeSmokeReadiness(verified).ready,true));
for(const key of ["isolated","credentialsAbsent","networkRestricted","effectivePermissionsVerified","toolDenialVerified"]){
 test("missing "+key+" blocks smoke",()=>assert.throws(()=>requireOpenCodeSmokeReadiness({...verified,[key]:false}),ProviderError));
}
test("version mismatch blocks smoke",()=>assert.throws(()=>requireOpenCodeSmokeReadiness({...verified,version:"other"}),ProviderError));
test("unsafe workspace blocks smoke",()=>assert.throws(()=>requireOpenCodeSmokeReadiness({...verified,workspace:"/home/user/project"}),ProviderError));
