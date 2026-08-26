import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const neoRoot = path.join(root, "neo-os");
const manifestPath = path.join(neoRoot, "wallpaper-full-media.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
const projects = Array.isArray(manifest.projects) ? manifest.projects : [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function localPath(source) {
  const clean = String(source || "").split(/[?#]/)[0].replace(/^\.\//, "");
  const resolved = path.resolve(neoRoot, clean);
  assert(resolved.startsWith(neoRoot), `Asset escaped the NEO OS directory: ${source}`);
  return resolved;
}

function inspectMp4(filePath) {
  const descriptor = openSync(filePath, "r");
  const fileSize = statSync(filePath).size;
  const header = Buffer.alloc(16);
  const boxes = new Map();
  let offset = 0;
  try {
    while (offset + 8 <= fileSize) {
      header.fill(0);
      readSync(descriptor, header, 0, 16, offset);
      let boxSize = header.readUInt32BE(0);
      const type = header.toString("ascii", 4, 8);
      let headerSize = 8;
      if (boxSize === 1) {
        boxSize = Number(header.readBigUInt64BE(8));
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = fileSize - offset;
      }
      assert(boxSize >= headerSize && offset + boxSize <= fileSize, `Invalid MP4 box in ${path.basename(filePath)}`);
      if (!boxes.has(type)) boxes.set(type, { offset, size: boxSize });
      offset += boxSize;
    }
  } finally {
    closeSync(descriptor);
  }
  const moov = boxes.get("moov");
  const mdat = boxes.get("mdat");
  assert(moov && mdat, `${path.basename(filePath)} is missing MP4 playback metadata`);
  assert(moov.offset < mdat.offset, `${path.basename(filePath)} is not fast-start optimized for Chrome`);
  const sampleLength = Math.min(moov.size, 2 * 1024 * 1024);
  const sample = Buffer.alloc(sampleLength);
  const sampleDescriptor = openSync(filePath, "r");
  try {
    readSync(sampleDescriptor, sample, 0, sampleLength, moov.offset);
  } finally {
    closeSync(sampleDescriptor);
  }
  assert(sample.includes(Buffer.from("avc1")), `${path.basename(filePath)} is not H.264/AVC media`);
  return { bytes: fileSize, moov: moov.offset, mdat: mdat.offset };
}

function inspectWebProject(filePath, id) {
  const entry = readFileSync(filePath, "utf8");
  assert(entry.includes("neo-wallpaper-web-compat.js?v=20260805-chrome-v1"), `${id} is missing the Chrome host bridge`);
  const scripts = Array.from(entry.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi), (match) => match[1]);
  assert(scripts.length > 0 && scripts[0].includes("neo-wallpaper-web-compat.js"), `${id} loads project code before the Chrome host bridge`);
  const projectRoot = path.dirname(filePath);
  const files = listProjectFiles(projectRoot);
  const textFiles = files.filter((file) => /\.(?:html?|css|js)$/i.test(file));
  const sources = textFiles.map((file) => ({ file, source: readFileSync(file, "utf8") }));
  const hasMotion = sources.some(({ source }) => /requestAnimationFrame|setInterval|@keyframes|animation\s*:|\.animate\s*\(/.test(source));
  assert(hasMotion, `${id} has no browser animation loop or CSS animation`);

  for (const { file, source } of sources) {
    const references = [];
    if (/\.html?$/i.test(file)) {
      for (const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) references.push(match[1]);
    }
    if (/\.(?:html?|css)$/i.test(file)) {
      for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) references.push(match[1]);
    }
    for (const reference of references) verifyLocalReference(file, reference, id);
  }

  return { files: files.length, motionFiles: sources.length };
}

function listProjectFiles(directory) {
  const files = [];
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else files.push(target);
    }
  }
  return files;
}

function verifyLocalReference(owner, reference, id) {
  const clean = String(reference || "").trim().split(/[?#]/)[0];
  if (!clean || /^(?:[a-z]+:|\/\/|#)/i.test(clean) || /[{}$]/.test(clean)) return;
  let decoded = clean;
  try { decoded = decodeURIComponent(clean); } catch (_error) {}
  const target = decoded.startsWith("/")
    ? path.resolve(root, decoded.replace(/^\/+/, ""))
    : path.resolve(path.dirname(owner), decoded);
  assert(target.startsWith(root), `${id} references a file outside the project: ${reference}`);
  assert(existsSync(target), `${id} is missing ${path.relative(root, target)}`);
}

assert(projects.length > 0, "No default-installed wallpapers were found");

let videoCount = 0;
let webCount = 0;
let animatedImageCount = 0;

for (const project of projects) {
  assert(project.id && project.title, "A default wallpaper is missing an id or title");
  assert(Number(project.width) >= 1920 && Number(project.height) >= 1080, `${project.id} is below 1080p`);
  assert(["video", "web", "animated-image"].includes(project.mediaType), `${project.id} is not an animated media type`);
  const mediaPath = localPath(project.file);
  const previewPath = localPath(project.preview);
  assert(existsSync(mediaPath), `${project.id} is missing its media file`);
  assert(existsSync(previewPath), `${project.id} is missing its preview image`);

  if (project.mediaType === "video") {
    videoCount += 1;
    assert(Number(project.duration) > 0, `${project.id} has no playback duration`);
    const media = inspectMp4(mediaPath);
    console.log(`PASS video ${project.id} ${project.width}x${project.height} fast-start=${media.moov < media.mdat}`);
  } else if (project.mediaType === "web") {
    webCount += 1;
    const web = inspectWebProject(mediaPath, project.id);
    console.log(`PASS web   ${project.id} ${project.width}x${project.height} assets=${web.files}`);
  } else {
    animatedImageCount += 1;
    const image = readFileSync(mediaPath);
    assert(image.subarray(0, 3).toString("ascii") === "GIF", `${project.id} is not a GIF`);
    assert(image.toString("latin1").split("\x21\xF9\x04").length > 2, `${project.id} is a static GIF`);
    console.log(`PASS gif   ${project.id} ${project.width}x${project.height}`);
  }
}

console.log(`Installed wallpaper audit passed: ${projects.length}/${projects.length} (${videoCount} video, ${webCount} web, ${animatedImageCount} GIF).`);

const baseFlag = process.argv.indexOf("--base-url");
if (baseFlag >= 0) {
  const baseUrl = process.argv[baseFlag + 1];
  assert(baseUrl, "--base-url requires an HTTP origin");
  for (const project of projects) {
    const mediaSource = String(project.file).replace(/^\.\//, "");
    const mediaUrl = new URL(`neo-os/${mediaSource}`, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    const response = await fetch(mediaUrl, {
      cache: "no-store",
      headers: project.mediaType === "video" ? { Range: "bytes=0-1023" } : {},
    });
    if (project.mediaType === "video") {
      assert(response.status === 206, `${project.id} did not return a Chrome-compatible byte range`);
      assert(response.headers.get("accept-ranges") === "bytes", `${project.id} does not advertise byte ranges`);
      assert((await response.arrayBuffer()).byteLength === 1024, `${project.id} returned the wrong byte range length`);
    } else {
      assert(response.ok, `${project.id} returned HTTP ${response.status}`);
      const source = await response.text();
      assert(source.includes("neo-wallpaper-web-compat.js?v=20260805-chrome-v1"), `${project.id} served a stale web entry point`);
    }
    console.log(`PASS http  ${project.id} status=${response.status}`);
  }
  console.log(`HTTP playback audit passed against ${baseUrl}.`);
}
