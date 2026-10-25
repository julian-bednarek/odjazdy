// Stores a watch's profiles in KV under the hash of its setup code.
// Usage: npm run register -- "<setup code shown on the watch>" [config.json]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [code = "", file = "config.json"] = process.argv.slice(2);
const secret = code.replace(/\s/g, "").toLowerCase();
if (!/^[0-9a-f]{32}$/.test(secret)) {
  console.error('Usage: npm run register -- "<setup code shown on the watch>" [config.json]');
  process.exit(1);
}

const device = createHash("sha256").update(Buffer.from(secret, "hex")).digest("hex");
const config = { ...JSON.parse(readFileSync(file, "utf8")), secret };
execFileSync("npx", ["wrangler", "kv", "key", "put", "--binding", "TS_KV", "--remote", `cfg:${device}`, JSON.stringify(config)], {
  stdio: "inherit",
});
