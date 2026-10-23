import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";

const dockerfile = readFileSync(new URL("./Dockerfile", import.meta.url), "utf8");
const verifier = readFileSync(new URL("./verify.mjs", import.meta.url), "utf8");
const pipeline = parse(readFileSync(new URL("../../.tekton/build-playwright-ci.yaml", import.meta.url), "utf8"));
const tasks = pipeline.spec.pipelineSpec.tasks;
const task = (name: string): any => tasks.find((entry: any) => entry.name === name);
const param = (name: string): any => task("build-amd64").params.find((entry: any) => entry.name === name).value;

describe("dedicated Playwright image publication contract", () => {
  test("pins the browser package and harness prerequisites without an app tree or second browser install", () => {
    expect(dockerfile).toContain("node:24.18.0-bookworm-slim");
    expect(dockerfile).toContain("rust:1.96.0-slim-bookworm");
    expect(dockerfile).toContain("pnpm@11.5.0");
    expect(dockerfile).toContain("--save-exact --ignore-scripts playwright-core@1.63.0");
    expect(dockerfile).toContain("install --with-deps --no-shell chromium");
    expect(dockerfile).toContain("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1");
    expect(dockerfile).toContain('test "$TARGETARCH" = amd64');
    expect(dockerfile).not.toMatch(/COPY\s+\.\s|webkit|firefox|tauri|wasm-bindgen|npx/);
  });

  test("records the package's Chromium revision and verifies a real sandboxed browser as non-root", () => {
    expect(verifier).toContain("chromiumRevision: chromium.revision");
    expect(verifier).toContain("assert.equal(browser.version(), chromium.browserVersion)");
    expect(verifier).toContain("chromiumSandbox: true");
    expect(verifier).toContain("assert.notEqual(process.getuid(), 0");
    expect(verifier).toContain('assert.equal(process.arch, "x64")');
    expect(verifier).toContain("await page.title()");
    expect(verifier).not.toContain("--no-sandbox");
  });

  test("all actual tag templates fit the registry limit with a full revision and run UID", () => {
    const publish = task("publish-verified").taskSpec.steps[0];
    const finalTag = publish.env.find((entry: any) => entry.name === "TAG").value;
    const promotionCandidate = publish.script.match(/crane digest "\$IMAGE:([^"]+)"/)[1].replace("$TAG", finalTag);
    const templates = [
      param("image").split(":").at(-1),
      task("verify-amd64").taskSpec.steps[0].image.split(":").at(-1),
      promotionCandidate,
      finalTag,
    ];
    const tags = templates.map((template: string) => template
      .replaceAll("$(params.revision)", "a".repeat(40))
      .replaceAll("$(context.pipelineRun.uid)", "12345678-1234-1234-1234-123456789abc"));
    for (const tag of tags) {
      expect(tag.length).toBeLessThanOrEqual(128);
      expect(tag).toMatch(/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/);
      expect(tag).toContain("a".repeat(40));
      expect(tag).toContain("12345678-1234-1234-1234-123456789abc");
      expect(tag).toEndWith("-amd64");
    }
    expect(tags[0]).toBe(tags[1]);
    expect(tags[0]).toBe(tags[2]);
    expect(tags[0]).toBe(`c-${tags[3]}`);
  });

  test("promotion accepts only a sha256 digest with exactly 64 hexadecimal characters", () => {
    const script = task("publish-verified").taskSpec.steps[0].script;
    const validation = script.slice(script.indexOf('case "$digest"'), script.indexOf('crane copy'));
    for (const digest of [`sha256:${"a".repeat(64)}`, `sha256:${"AB09".repeat(16)}`]) {
      expect(spawnSync("sh", ["-ec", validation], { env: { ...process.env, digest } }).status).toBe(0);
    }
    for (const digest of ["sha256:", `sha256:${"a".repeat(63)}`, `sha256:${"a".repeat(65)}`,
      `sha256:${"g".repeat(64)}`, `sha512:${"a".repeat(64)}`, `sha256:${"a".repeat(64)}\n`]) {
      expect(spawnSync("sh", ["-ec", validation], { env: { ...process.env, digest } }).status).not.toBe(0);
    }
  });

  test("isolates candidates and gates digest promotion on native amd64 browser verification", () => {
    expect(param("context")).toBe("docker/playwright-ci");
    expect(param("buildkit-addr")).toBe("{{ BUILDKIT_AMD64_ADDR }}");
    expect(param("image")).toContain("/playwright-ci:c-");
    expect(param("image")).toContain("$(params.revision)-$(context.pipelineRun.uid)-amd64");
    expect(task("verify-amd64").runAfter).toEqual(["build-amd64"]);
    const verify = task("verify-amd64").taskSpec;
    expect(verify.steps[0].image).toBe(param("image"));
    expect(verify.steps[0].command).toEqual(["node", "/opt/playwright/verify.mjs"]);
    expect(verify.steps[0].securityContext.runAsNonRoot).toBe(true);
    expect(verify.volumes[0].emptyDir).toEqual({ medium: "Memory", sizeLimit: "1Gi" });
    expect(pipeline.spec.taskRunSpecs[0].podTemplate.nodeSelector["kubernetes.io/arch"]).toBe("amd64");
    expect(task("publish-verified").runAfter).toEqual(["verify-amd64"]);
    expect(task("publish-verified").taskSpec.steps[0].script).toContain('crane copy "$IMAGE@$digest" "$IMAGE:$TAG"');
    expect(JSON.stringify(pipeline)).not.toMatch(/arm64|latest|manifest-create/);
    expect(pipeline.spec.pipelineSpec.results[0].value).toBe("$(tasks.publish-verified.results.image-reference)");
  });
});
