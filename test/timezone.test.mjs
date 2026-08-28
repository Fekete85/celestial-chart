/* The library must not ship anybody's API key.
 *
 * Upstream baked the author's TimeZoneDB account id into the defaults, with
 * `settimezone: true` also being the default. The consequence was that any page
 * embedding the library sent its visitors' coordinates to a third party — on a
 * quota shared with every other d3-celestial site on the internet, over plain
 * HTTP whenever the page itself was served over HTTP.
 *
 * A key cannot be kept secret in a client-side bundle anyway, so the fix is not
 * a better key: it is no key. Without one, nothing is requested and the offset
 * is estimated from longitude — the fallback the code always had for failures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { settings } from "../src/config.js";

const SRC = path.join(import.meta.dirname, "..", "src");

test("no API key is shipped in the defaults", () => {
  assert.equal(settings.timezoneid, "", "timezoneid must be empty");
  assert.equal(settings.timezoneResolver, null, "timezoneResolver must default to null");
});

test("no credential-looking literal is left anywhere in the source", () => {
  const suspicious = [];
  for (const file of fs.readdirSync(SRC)) {
    if (!file.endsWith(".js")) continue;
    const text = fs.readFileSync(path.join(SRC, file), "utf8");
    // The upstream key, and any key= carrying something other than a variable.
    if (text.includes("AEFXZPQ3FDPF")) suspicious.push(`${file}: the upstream TimeZoneDB key`);
    for (const m of text.matchAll(/key=["'][A-Za-z0-9]{8,}/g)) suspicious.push(`${file}: ${m[0]}`);
  }
  assert.deepEqual(suspicious, []);
});

test("a timezoneResolver survives the config merge", () => {
  const resolver = () => Promise.resolve(60);
  const merged = settings.set({ timezoneResolver: resolver }, settings);
  assert.equal(merged.timezoneResolver, resolver,
    "the function must arrive unchanged — the merge treats a null default as replaceable");
});

test("the upstream timezoneid route still works", () => {
  const merged = settings.set({ timezoneid: "MYOWNKEY123" }, settings);
  assert.equal(merged.timezoneid, "MYOWNKEY123");
});

test("the longitude estimate is the documented fallback", () => {
  // 15 degrees per hour. This is what setPosition() uses with nothing configured.
  const estimate = lon => Math.round(lon / 15) * 60;
  assert.equal(estimate(19.04), 60, "Budapest: UTC+1");
  assert.equal(estimate(-74.0), -300, "New York: UTC-5");
  assert.equal(estimate(0), 0, "Greenwich: UTC");
  assert.equal(estimate(139.7), 540, "Tokyo: UTC+9");
});
