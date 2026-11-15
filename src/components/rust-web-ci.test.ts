import assert = require("node:assert/strict");
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { parse } from "yaml";

const dockerfile = readFileSync("docker/rust-web-ci/Dockerfile", "utf8");
const verifier = readFileSync("docker/rust-web-ci/verify.sh", "utf8");
const pipeline = parse(readFileSync(".tekton/build-rust-web-ci.yaml", "utf8"));
const spec = pipeline.spec.pipelineSpec;
const contract = "bw-r1.96.0-n24.18.0-p11.5.0-w0.2.122-v1";
const image = "{{ CONTAINER_REGISTRY }}/rfhold/rust-web-ci";
const tag = `${contract}-$(params.revision)-$(context.pipelineRun.uid)`;

function task(name: string): any {
  const found = spec.tasks.find((candidate: any) => candidate.name === name);
  assert.ok(found, name);
  return found;
}

function params(value: any): Record<string, string> {
  return Object.fromEntries(value.params.map((param: any) => [param.name, param.value]));
}

describe("rust-web-ci offline source contract", () => {
  it("pins the focused Bookworm toolchain without application or desktop dependencies", () => {
    assert.match(dockerfile, /FROM docker.io\/library\/node:24\.18\.0-bookworm-slim AS node/);
    assert.match(dockerfile, /FROM docker.io\/library\/rust:1\.96\.0-slim-bookworm/);
    assert.match(dockerfile, /pnpm@11\.5\.0/);
    assert.match(dockerfile, /cargo install --locked wasm-bindgen-cli --version 0\.2\.122/);
    assert.match(dockerfile, /rustup component add clippy rustfmt/);
    assert.match(dockerfile, /rustup target add wasm32-unknown-unknown/);
    for (const dependency of ["build-essential", "ca-certificates", "git", "pkg-config"]) {
      assert.ok(dockerfile.includes(dependency));
    }
    assert.doesNotMatch(dockerfile, /general-ci|gtk|webkit|alsa|libasound|espup|espflash|pulumi|golang|python/i);
    assert.deepEqual(readdirSync("docker/rust-web-ci").sort(), [".dockerignore", "Dockerfile", "fixture", "verify.sh"]);
    const copies = dockerfile.split("\n").filter((line) => line.startsWith("COPY "));
    assert.deepEqual(copies, [
      "COPY --from=node /usr/local /usr/local",
      "COPY fixture /tmp/rust-web-ci-fixture",
      "COPY --from=fixture-build /opt/rust-web-ci/fixture.wasm /opt/rust-web-ci/fixture.wasm",
      "COPY verify.sh /usr/local/bin/rust-web-ci-verify",
    ]);
    assert.ok(dockerfile.includes(`org.opencontainers.image.version="${contract}"`));
    assert.match(dockerfile, /USER root/);
    assert.match(dockerfile, /WORKDIR \/workspace/);
    for (const home of ["CARGO_HOME=/usr/local/cargo", "RUSTUP_HOME=/usr/local/rustup", "PNPM_HOME=/pnpm"]) {
      assert.ok(dockerfile.includes(home));
    }
    assert.match(dockerfile, /PATH=\/pnpm:\/usr\/local\/cargo\/bin:\/usr\/local\/bin:\$PATH/);
  });

  it("uses internal apt, Cargo and npm mirrors without embedded credentials", () => {
    assert.match(dockerfile, /http:\/\/apt-mirrors\.holdenitdown\.net/);
    assert.match(dockerfile, /sparse\+https:\/\/mirrors\.holdenitdown\.net\/cargo\/api\/v1\/cratesio\//);
    assert.match(dockerfile, /npm_config_registry=https:\/\/mirrors\.holdenitdown\.net\/npm\//);
    assert.doesNotMatch(dockerfile, /TOKEN|PASSWORD|SECRET|--mount=type=secret|https?:\/\/[^/\s]+@/);
  });

  it("defines an offline disposable native and WASM/glue functional verifier", () => {
    for (const version of ["1.96.0", "v24.18.0", "11.5.0", "wasm-bindgen 0.2.122"]) {
      assert.ok(verifier.includes(version));
    }
    for (const fragment of [
      "VERSION_CODENAME", "bookworm", "rustup target list --installed", "wasm32-unknown-unknown",
      "rustup component list --installed", "grep '^clippy-'", "grep '^rustfmt-'",
      "CARGO_NET_OFFLINE=true", "cargo build --offline", "cargo clippy --offline -- -D warnings",
      "cargo fmt --check", "mktemp -d", "trap 'rm -rf", "CARGO_TARGET_DIR=\"$work/target\"",
      "rustc --edition=2024 --target wasm32-unknown-unknown --crate-type cdylib",
      "wasm-bindgen --target web --out-dir glue --out-name add /opt/rust-web-ci/fixture.wasm",
      "import { add, initSync }", "assert.equal(add(20, 22), 42)",
    ]) {
      assert.ok(verifier.includes(fragment), fragment);
    }
    assert.doesNotMatch(verifier, /cargo (install|fetch)|pnpm (install|add)|npm install|curl|wget/);
    assert.match(dockerfile, /chmod 0755 .* && rust-web-ci-verify/);
  });

  it("builds only the pinned tool fixture into a separate stage and copies only its WASM", () => {
    const manifest = readFileSync("docker/rust-web-ci/fixture/Cargo.toml", "utf8");
    const lock = readFileSync("docker/rust-web-ci/fixture/Cargo.lock", "utf8");
    assert.match(manifest, /wasm-bindgen = "=0\.2\.122"/);
    assert.match(lock, /name = "wasm-bindgen"\nversion = "0\.2\.122"/);
    assert.match(dockerfile, /FROM toolchain AS fixture-build/);
    assert.match(dockerfile, /cargo build --locked --release --target wasm32-unknown-unknown/);
    assert.match(dockerfile, /FROM toolchain\n\nCOPY --from=fixture-build \/opt\/rust-web-ci\/fixture.wasm/);
    assert.equal(readFileSync("docker/rust-web-ci/.dockerignore", "utf8"),
      "**\n!Dockerfile\n!verify.sh\n!fixture/\n!fixture/Cargo.toml\n!fixture/Cargo.lock\n!fixture/src/\n!fixture/src/lib.rs\n");
  });

  const functionalTest = process.env.RUST_WEB_CI_FUNCTIONAL === "1" ? it : it.skip;
  functionalTest("executes the actual WASM/glue smoke section offline with the pinned host tools", {
    timeout: 120000,
  }, () => {
    const root = join(tmpdir(), "opencode");
    mkdirSync(root, { recursive: true });
    const work = mkdtempSync(join(root, "rust-web-ci-"));
    const env = { ...process.env, CARGO_NET_OFFLINE: "true", RUSTUP_AUTO_INSTALL: "0",
      RUSTUP_TOOLCHAIN: "1.96.0", CARGO_TARGET_DIR: join(work, "target") };
    try {
      const rust = spawnSync("rustc", ["--version"], { env, encoding: "utf8" });
      assert.match(rust.stdout, /^rustc 1\.96\.0 /);
      const bindgen = spawnSync("wasm-bindgen", ["--version"], { env, encoding: "utf8" });
      assert.equal(bindgen.stdout.trim(), "wasm-bindgen 0.2.122");
      const build = spawnSync("cargo", ["build", "--offline", "--locked", "--release",
        "--target", "wasm32-unknown-unknown", "--manifest-path",
        resolve("docker/rust-web-ci/fixture/Cargo.toml")], { env, encoding: "utf8" });
      assert.equal(build.status, 0, build.stderr);
      const fixture = join(work, "target/wasm32-unknown-unknown/release/rust_web_ci_wasm_fixture.wasm");
      const section = verifier.slice(verifier.indexOf("cat > add.rs"))
        .replace("/opt/rust-web-ci/fixture.wasm", '"$FIXTURE"');
      const smoke = spawnSync("sh", ["-eu"], { cwd: work,
        env: { ...env, FIXTURE: fixture }, input: section, encoding: "utf8" });
      assert.equal(smoke.status, 0, smoke.stderr);
      assert.match(smoke.stdout, /rust-web-ci contract verified/);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

  it("accepts only exact lowercase SHA-256 digests from the resolver", () => {
    const script = task("resolve-digest").taskSpec.steps[0].script;
    const validation = script.slice(script.indexOf('case "$digest"'), script.indexOf("crane copy"));
    for (const digest of [`sha256:${"a1".repeat(32)}`, "sha256:", `sha256:${"a".repeat(63)}`,
      `sha256:${"a".repeat(65)}`, `sha256:${"g".repeat(64)}`, `sha256:${"A".repeat(64)}`, `sha512:${"a".repeat(64)}`]) {
      const result = spawnSync("sh", ["-eu"], { input: validation, env: { ...process.env, digest } });
      assert.equal(result.status === 0, /^sha256:[a-f0-9]{64}$/.test(digest), digest);
    }
  });

  it("builds and verifies both native architectures before publishing their manifest", () => {
    for (const arch of ["amd64", "arm64"]) {
      const build = task(`build-${arch}`);
      assert.equal(build.taskRef.name, "buildkit-build");
      assert.deepEqual(build.runAfter, ["fetch-repository"]);
      assert.equal(params(build).image, `${image}:${tag}-${arch}`);
      assert.equal(params(build)["buildkit-addr"], `{{ BUILDKIT_${arch.toUpperCase()}_ADDR }}`);
      assert.equal(params(build).context, "docker/rust-web-ci");
      assert.equal(params(build).dockerfile, "Dockerfile");
      const verify = task(`verify-${arch}`);
      assert.deepEqual(verify.runAfter, [`build-${arch}`]);
      const step = verify.taskSpec.steps[0];
      assert.equal(step.image, params(build).image);
      assert.equal(step.imagePullPolicy, "Always");
      assert.deepEqual(step.command, ["rust-web-ci-verify"]);
      const placement = pipeline.spec.taskRunSpecs.find((entry: any) => entry.pipelineTaskName === `verify-${arch}`);
      assert.equal(placement.podTemplate.nodeSelector["kubernetes.io/arch"], arch);
    }
    const manifest = task("manifest-create");
    assert.deepEqual(manifest.runAfter, ["verify-amd64", "verify-arm64"]);
    assert.equal(manifest.taskRef.name, "manifest-create");
    assert.deepEqual(params(manifest), { "base-image": image, tag, "push-latest": "false" });
  });

  it("isolates reruns and exposes the verified multiarch digest for later adoption", () => {
    const concreteTag = `${contract}-${"a".repeat(40)}-${"b".repeat(36)}-amd64`;
    assert.ok(concreteTag.length <= 128);
    assert.match(concreteTag, /^[\w][\w.-]*$/);
    const resolve = task("resolve-digest");
    assert.deepEqual(resolve.runAfter, ["manifest-create"]);
    assert.deepEqual(resolve.taskSpec.steps[0].env, [{ name: "IMAGE", value: image }, { name: "TAG", value: tag }]);
    assert.match(resolve.taskSpec.steps[0].script, /crane digest "\$IMAGE:\$TAG"/);
    assert.match(resolve.taskSpec.steps[0].script, /crane copy "\$IMAGE@\$digest" "\$IMAGE:latest"\nprintf '%s@%s'/);
    assert.deepEqual(spec.results, [{ name: "image-reference", value: "$(tasks.resolve-digest.results.image-reference)" }]);
    assert.equal(pipeline.metadata.annotations["pipelinesascode.tekton.dev/on-path-change"], "[.tekton/build-rust-web-ci.yaml, docker/rust-web-ci/**]");
  });

  it("uses only supported shared task parameters and manifest architecture naming", () => {
    for (const name of ["build-amd64", "build-arm64", "manifest-create"]) {
      const current = task(name);
      const shared = parse(readFileSync(`src/components/tekton-tasks/${current.taskRef.name}.yaml`, "utf8"));
      const supported = shared.spec.params.map((param: any) => param.name);
      for (const param of current.params) assert.ok(supported.includes(param.name), param.name);
    }
    const manifest = readFileSync("src/components/tekton-tasks/manifest-create.yaml", "utf8");
    assert.match(manifest, /--platforms linux\/amd64,linux\/arm64/);
    assert.match(manifest, /--template \$\(params.base-image\):\$\(params.tag\)-ARCH/);
  });
});

for (const name of ["service-build-v1", "service-manifest-v1", "service-promote-v1"]) {
  describe(`${name} registry absence handling`, () => {
    const definition = parse(readFileSync(`src/components/tekton-tasks/${name}.yaml`, "utf8"));
    const script = definition.spec.steps.find((step: any) => step.script?.includes("async function request(")).script;
    const start = script.indexOf("const E = process.env;");
    const end = script.indexOf("function baselinePlatform(");
    const precheckStart = script.indexOf("async function precheck(");
    const precheckEnd = script.indexOf("async function publish(");
    assert.ok(start >= 0 && end > start && precheckStart > end && precheckEnd > precheckStart);
    const helpers = script.slice(start, end) + script.slice(precheckStart, precheckEnd);
    const repo = "registry.example/rfhold/inbox";
    const absent = (codes: string[]): string => JSON.stringify({ errors: codes.map(code => ({ code })) });
    const calls: Array<{ url: string; method: string }> = [];

    function registry(status: number, body: string): any {
      calls.length = 0;
      return runInNewContext(`${helpers}\n({ request, manifest, precheck })`, {
        process: { env: {} },
        readFileSync: () => { throw Object.assign(new Error("absent"), { code: "ENOENT" }); },
        Buffer, URL, AbortSignal,
        Bun: { CryptoHasher: function (): ReturnType<typeof createHash> { return createHash("sha256"); } },
        fetch: async (url: string, options: { method: string }) => {
          calls.push({ url: String(url), method: options.method });
          return new Response(body, { status });
        },
      });
    }

    for (const codes of [["NAME_UNKNOWN"], ["MANIFEST_UNKNOWN"], ["NAME_UNKNOWN", "MANIFEST_UNKNOWN"]]) {
      it(`accepts only optional absence for ${codes.join(",")}`, async () => {
        const api = registry(404, absent(codes));
        assert.equal(await api.manifest(repo, "new-tag", true), null);
        assert.equal(await api.precheck(repo, "new-tag", `sha256:${"a".repeat(64)}`), false);
        await assert.rejects(() => api.manifest(repo, "new-tag"), /required manifest absent/);
        assert.deepEqual(calls, Array.from({ length: 3 }, () => ({
          url: `https://${repo.split("/")[0]}/v2/rfhold/inbox/manifests/new-tag`, method: "GET",
        })));
      });
    }

    it("rejects unclassified, malformed, and mixed-error 404 responses", async () => {
      const bodies = [
        "", "not JSON", "<html>not found</html>", "null", "[]", "{}", '{"errors":[]}',
        '{"errors":null}', '{"errors":{}}', '{"errors":[null]}', '{"errors":[{}]}',
        '{"errors":["NAME_UNKNOWN"]}', '{"errors":[{"code":null}]}',
        absent(["UNKNOWN"]), absent(["UNAUTHORIZED"]), absent(["DENIED"]),
        absent(["NAME_UNKNOWN", "DENIED"]), absent(["MANIFEST_UNKNOWN", "UNKNOWN"]),
        '{"errors":[{"code":"NAME_UNKNOWN"},null]}',
      ];
      for (const body of bodies) {
        const api = registry(404, body);
        await assert.rejects(() => api.manifest(repo, "new-tag", true), /registry 404/);
        await assert.rejects(() => api.precheck(repo, "new-tag", `sha256:${"a".repeat(64)}`), /registry 404/);
      }
    });

    it("rejects auth and server errors even with absence codes", async () => {
      for (const status of [401, 403, 500, 502, 503]) {
        for (const code of ["NAME_UNKNOWN", "MANIFEST_UNKNOWN"]) {
          const api = registry(status, absent([code]));
          await assert.rejects(() => api.manifest(repo, "new-tag", true), /registry authentication failed|registry GET failed/);
        }
      }
    });

    it("does not classify blob or write 404 responses as absence", async () => {
      for (const code of ["NAME_UNKNOWN", "MANIFEST_UNKNOWN"]) {
        const api = registry(404, absent([code]));
        await assert.rejects(() => api.request(repo, "blobs/sha256:abc"), /registry GET failed with status 404/);
        await assert.rejects(() => api.request(repo, "manifests/new-tag", "PUT", "{}"), /registry PUT failed with status 404/);
      }
    });

    it("keeps existing digest verification and destination conflicts", async () => {
      const body = JSON.stringify({ schemaVersion: 2, mediaType: "application/vnd.oci.image.index.v1+json", manifests: [] });
      const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
      const api = registry(200, body);
      assert.equal((await api.manifest(repo, digest)).digest, digest);
      assert.equal(await api.precheck(repo, "existing-tag", digest), true);
      await assert.rejects(() => api.precheck(repo, "existing-tag", `sha256:${"a".repeat(64)}`), /destination tag conflict/);
      await assert.rejects(() => api.manifest(repo, `sha256:${"a".repeat(64)}`), /immutable manifest changed/);
    });
  });
}
