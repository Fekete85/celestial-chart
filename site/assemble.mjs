/* Assembles what nginx serves: the page itself is tracked in the repo, the
 * bundle, the stylesheet and the catalogues are copied in from the build so
 * that the site can never drift from what was actually built. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "site/html");

if (!fs.existsSync(path.join(ROOT, "build/celestial.min.js"))) {
  console.error("build/celestial.min.js is missing — run `npm run build` first.");
  process.exit(1);
}

fs.copyFileSync(path.join(ROOT, "build/celestial.min.js"), path.join(OUT, "celestial.min.js"));
fs.copyFileSync(path.join(ROOT, "celestial.css"), path.join(OUT, "celestial.css"));

fs.rmSync(path.join(OUT, "data"), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "data"), { recursive: true });
let bytes = 0;
for (const f of fs.readdirSync(path.join(ROOT, "harness/data"))) {
  if (!f.endsWith(".json")) continue;
  fs.copyFileSync(path.join(ROOT, "harness/data", f), path.join(OUT, "data", f));
  bytes += fs.statSync(path.join(OUT, "data", f)).size;
}

const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const page = path.join(OUT, "index.html");
const html = fs.readFileSync(page, "utf8");
if (!html.includes(`celestial-chart <span>${version}</span>`)) {
  console.warn(`WARNING: the page does not show version ${version} — update site/html/index.html.`);
}

console.log(`site/html ready: bundle ${(fs.statSync(path.join(OUT, "celestial.min.js")).size / 1024).toFixed(0)} KB, data ${(bytes / 1024 / 1024).toFixed(1)} MB`);
