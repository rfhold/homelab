import assert from "node:assert/strict";
import { accessSync, constants, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const version = "1.63.0";
const contractPath = "/opt/playwright/contract.json";
const core = require("playwright-core");
const metadata = JSON.parse(readFileSync(new URL("./node_modules/playwright-core/browsers.json", import.meta.url), "utf8"));
const chromium = metadata.browsers.find((browser) => browser.name === "chromium");
assert.equal(require("playwright-core/package.json").version, version);
assert.equal(process.platform, "linux");
assert.equal(process.arch, "x64");
assert.equal(process.version, "v24.18.0");
assert.match(execFileSync("rustc", ["--version"], { encoding: "utf8" }), /^rustc 1\.96\.0 /);
assert.equal(execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(), "11.5.0");
assert.equal(process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, "1");
const executablePath = core.chromium.executablePath();
accessSync(executablePath, constants.X_OK);
const contract = {
  schema: 1,
  imageVersion: "bw-pw1.63.0-r1.96.0-n24.18.0-p11.5.0-v1-amd64",
  platform: "linux/amd64",
  playwright: version,
  chromiumRevision: chromium.revision,
  chromiumVersion: chromium.browserVersion,
  executablePath,
  node: "24.18.0",
  rust: "1.96.0",
  pnpm: "11.5.0",
};
if (process.argv.includes("--write-contract")) {
  writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
} else {
  assert.deepEqual(JSON.parse(readFileSync(contractPath, "utf8")), contract);
  assert.notEqual(process.getuid(), 0, "Chromium verification requires a non-root user and working user-namespace sandbox");
  const browser = await core.chromium.launch({ executablePath, chromiumSandbox: true, headless: true });
  try {
    assert.equal(browser.version(), chromium.browserVersion);
    const page = await browser.newPage();
    await page.setContent("<title>playwright-ci</title><p>offline browser verification</p>");
    assert.equal(await page.title(), "playwright-ci");
    console.log(JSON.stringify({ ...contract, browserLaunch: "passed", sandbox: true }));
  } finally {
    await browser.close();
  }
}
