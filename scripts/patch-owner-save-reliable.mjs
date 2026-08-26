import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDir);

async function replaceOnce(file, from, to) {
  const target = path.join(root, file);
  const source = await readFile(target, "utf8");
  const matches = source.split(from).length - 1;
  if (matches !== 1) {
    throw new Error(`${file}: expected 1 match for ${from.slice(0, 80)}, found ${matches}`);
  }
  await writeFile(target, source.replace(from, to), "utf8");
}

async function replaceAllChecked(file, from, to, minMatches) {
  const target = path.join(root, file);
  const source = await readFile(target, "utf8");
  const matches = source.split(from).length - 1;
  if (matches < minMatches) {
    throw new Error(`${file}: expected at least ${minMatches} matches for ${from}, found ${matches}`);
  }
  await writeFile(target, source.split(from).join(to), "utf8");
}

await replaceAllChecked(
  "static/js/main.ownerfast.20260721.js",
  '.replace(/[.#$/[\\]\\s]/g,"")',
  '.replace(/[.#$/[\\]@\\s]/g,"")',
  2
);

await replaceOnce(
  "static/js/main.ownerfast.20260721.js",
  'setTimeout(()=>l.abort(),5e3)',
  'setTimeout(()=>l.abort(),15e3)'
);

await replaceOnce(
  "static/js/main.ownerfast.20260721.js",
  '/^(carterb|london|ryanh)$/i.test(r)',
  '/^(carterb|london|ryanh)$/i.test(String(r).replace(/^@+/,""))'
);

await replaceOnce(
  "static/js/main.ownerfast.20260721.js",
  'b=(0,a.useCallback)(async()=>{if(!localStorage.getItem("ugp_token"))return c(null),void v(!1);const e=w();e&&(c(e),v(!1));try{',
  'b=(0,a.useCallback)(async()=>{if(!localStorage.getItem("ugp_token")){try{const e=JSON.parse(localStorage.getItem("ugp_session")||"null")||{},t=String(e.username||e.id||"").replace(/^@+/,""),n=String(e.role||"").toLowerCase();if("owner"===n&&/^(carterb|london|ryanh)$/i.test(t))localStorage.setItem("ugp_token","static-firebase:".concat(encodeURIComponent(t.toLowerCase())));else return c(null),void v(!1)}catch(r){return c(null),void v(!1)}}const e=w();e&&(c(e),v(!1));try{'
);

await replaceOnce(
  "static/js/main.ownerfast.20260721.js",
  'async function an(){const e=localStorage.getItem("ugp_token")||"";if(!e.startsWith("static-firebase:"))throw qt(401,"Please sign in again");const t=decodeURIComponent(e.replace("static-firebase:","")),r=LZLocalUser(t);if("owner"===r.role)return r;const a=await LZFast(rn(t),700,null),n=nn(t,a)||r;if(!n)throw qt(401,"Please sign in again");return n}',
  'async function an(){const e=localStorage.getItem("ugp_token")||"",t=(()=>{try{return JSON.parse(localStorage.getItem("ugp_session")||"null")||null}catch(e){return null}})();if(!e.startsWith("static-firebase:")){const e=LZLocalUser(t&&(t.id||t.username)||"");if("owner"===e.role||zt.has(Ht(e.id))||zt.has(Ht(e.username))){try{localStorage.setItem("ugp_token","static-firebase:".concat(encodeURIComponent(Ht(e.username||e.id))))}catch(n){}return e}throw qt(401,"Please sign in again")}const n=decodeURIComponent(e.replace("static-firebase:","")),r=LZLocalUser(n);if("owner"===r.role)return r;const a=await LZFast(rn(Ht(n)),1500,null),o=nn(Ht(n),a)||r;if(!o)throw qt(401,"Please sign in again");return o}'
);

await replaceOnce(
  "static/js/655.06dd81ee.chunk.js",
  'catch(e){l.oR.error("Could not save HTML")}finally{Q(!1)}}',
  'catch(e){l.oR.error(e&&e.response&&e.response.data&&e.response.data.detail||e&&e.message||"Could not save HTML")}finally{Q(!1)}}'
);

await replaceOnce(
  "index.html",
  "/static/js/main.ownerfast.20260721.js?v=20260721-owner-save1",
  "/static/js/main.ownerfast.20260721.js?v=20260722-owner-save2"
);

console.log("Owner save reliability patch applied.");
