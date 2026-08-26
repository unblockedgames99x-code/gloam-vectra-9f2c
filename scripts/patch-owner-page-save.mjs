import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);
const sourcePath = path.join(root, "static", "js", "main.38afcbb7.js");
const outputPath = path.join(root, "static", "js", "main.ownerfast.20260721.js");

const original =
  'async function $t(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};const n=await fetch(function(){const e=(arguments.length>0&&void 0!==arguments[0]?arguments[0]:[]).map(Wt).join("/"),t=e?"/".concat(e):"";return"".concat(Tt,"/").concat(jt).concat(t,".json")}(e),(0,o.A)((0,o.A)({},t),{},{headers:(0,o.A)({"Content-Type":"application/json"},t.headers||{})}));if(!n.ok)throw qt(n.status,"Firebase request failed (".concat(n.status,")"));return"DELETE"===t.method?null:n.json()}';

const optimized =
  'async function $t(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};const n=String(t.method||"GET").toUpperCase(),r=function(){const e=(arguments.length>0&&void 0!==arguments[0]?arguments[0]:[]).map(Wt).join("/"),t=e?"/".concat(e):"";return"".concat(Tt,"/").concat(jt).concat(t,".json")}(e),a="PUT"===n||"PATCH"===n,i=a?r+"?print=silent":r,l="function"===typeof AbortController?new AbortController:null,s=l?setTimeout(()=>l.abort(),5e3):0;let u;try{u=await fetch(i,(0,o.A)((0,o.A)({},t),{},{headers:(0,o.A)({"Content-Type":"application/json"},t.headers||{}),signal:t.signal||(l?l.signal:void 0)}))}catch(c){if("AbortError"===(null===c||void 0===c?void 0:c.name))throw qt(408,"Save took too long. Try again.");throw c}finally{s&&clearTimeout(s)}if(!u.ok)throw qt(u.status,"Firebase request failed (".concat(u.status,")"));if("DELETE"===n)return null;if(a&&204===u.status){try{return JSON.parse(t.body||"null")}catch(c){return null}}return u.json()}';

const source = await readFile(sourcePath, "utf8");
const matches = source.split(original).length - 1;

if (matches !== 1) {
  throw new Error(`Expected one Firebase request helper, found ${matches}.`);
}

const output = source.replace(original, optimized);

if (!output.includes("?print=silent") || !output.includes("Save took too long. Try again.")) {
  throw new Error("The optimized owner-page save helper was not generated correctly.");
}

await writeFile(outputPath, output, "utf8");
console.log(`Created ${path.relative(root, outputPath)} (${output.length.toLocaleString()} bytes).`);
