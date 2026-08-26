import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const bundlePath = path.join(root, "static", "js", "main.ownerfast.20260721.js");
const source = await readFile(bundlePath, "utf8");
const startMarker = "async function ln(e,t){";
const endMarker = "async function UGPSyncGlobalMembers(){";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

assert.ok(start >= 0, "Could not find the packaged login function.");
assert.ok(end > start, "Could not find the end of the packaged login function.");

const replacement = `async function ln(e,t){
const n=Ht(e);
if(!n||!t)throw qt(401,"Wrong password");
const r="function"===typeof AbortController?new AbortController:null,a=r?setTimeout(()=>r.abort(),4500):0;
let i=null;
try{
const e=await fetch("/.netlify/functions/account-login",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({username:n,password:String(t)}),signal:r?r.signal:void 0});
const o=await e.json().catch(()=>null);
if(e.ok&&o&&o.token&&o.user)return o;
if(o&&o.detail&&e.status<500)throw qt(e.status,o.detail);
}catch(e){
if(e&&e.response)throw e;
i=e;
}finally{a&&clearTimeout(a)}
try{
const e=await LZFast(rn(n),2200,null);
if(!e||e.ugpDeleted)throw qt(401,"Account not found");
if(String(e.password||"")!==String(t))throw qt(401,"Wrong password");
const r=nn(n,e);
if(!r)throw qt(401,"Account not found");
return{token:"static-firebase:".concat(encodeURIComponent(n)),user:r};
}catch(e){
if(e&&e.response)throw e;
if(i&&"AbortError"===i.name)throw qt(408,"Sign in timed out. Try again.");
throw qt(503,"Sign in could not connect. Try again.");
}
}`;

const next = source.slice(0, start) + replacement + source.slice(end);
await writeFile(bundlePath, next);

console.log(JSON.stringify({
  patched: true,
  bundle: path.relative(root, bundlePath),
  previousBytes: Buffer.byteLength(source),
  nextBytes: Buffer.byteLength(next)
}, null, 2));
