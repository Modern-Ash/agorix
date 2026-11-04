import { createServer } from "node:http";

/**
 * Synthetic loopback server fixture. NOT OpenCode and NOT a security sandbox.
 * Exercises actual HTTP transport and session lifecycle without external LLMs.
 */
export async function startSyntheticOpenCodeServer({permission="deny",hint="¿Qué podrías probar primero?",rejectTools=false}={}) {
  const events=[];
  const sessions=new Set();
  const server=createServer(async(req,res)=>{
    const send=(status,obj)=>{res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(obj));};
    if(req.socket.remoteAddress!=="127.0.0.1" && req.socket.remoteAddress!=="::1") return send(403,{error:"loopback only"});
    const url=new URL(req.url,"http://127.0.0.1");
    let body="";
    for await(const chunk of req) {
      body+=chunk;
      if(body.length>8192)return send(413,{error:"too large"});
    }
    let data={};
    if(body)try{data=JSON.parse(body);}catch{return send(400,{error:"invalid json"});}
    events.push({method:req.method,path:url.pathname});
    if(req.method==="GET" && url.pathname==="/config")return send(200,{permission:{"*":permission},agent:{plan:{permission:{"*":permission}}},mcp:{}});
    if(req.method==="POST" && url.pathname==="/session"){
      const id="ses_synthetic_1";sessions.add(id);return send(200,{id});
    }
    if(req.method==="POST" && url.pathname==="/session/ses_synthetic_1/message"){
      if(!sessions.has("ses_synthetic_1"))return send(404,{error:"no session"});
      if(rejectTools && data.tools?.bash!==false)return send(403,{error:"tools denied"});
      return send(200,{parts:[{type:"text",text:hint}]});
    }
    if(req.method==="DELETE" && url.pathname==="/session/ses_synthetic_1"){
      sessions.delete("ses_synthetic_1");return send(200,true);
    }
    return send(404,{error:"unknown route"});
  });
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  return Object.freeze({
    endpoint:`http://127.0.0.1:${server.address().port}`,
    events,sessions,
    async close(){await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
  });
}
