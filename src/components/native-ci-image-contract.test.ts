import assert = require("node:assert/strict");
import { execFileSync, spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { parse } from "yaml";

const root = resolve(__dirname, "../..");
const images = ["tauri-release-ci", "rust-ci", "android-ci", "tauri-e2e-ci"];
const source = (path: string): string => readFileSync(join(root, path), "utf8");

const fakeTool = `#!/bin/sh
set -eu
case "$(basename "$0")" in
  rustc)
    if [ "$1" = -vV ]; then echo 'host: x86_64-unknown-linux-gnu'; else echo "rustc \${MOCK_RUST_VERSION:-1.96.0} (mock)"; fi ;;
  cargo)
    case "$1" in
      --version) echo 'cargo 1.96.0 (mock)' ;;
      tauri) echo 'tauri-cli 2.10.1' ;;
      *) echo mock ;;
    esac ;;
  rustup)
    case "$1" in
      component)
        echo clippy-x86_64-unknown-linux-gnu
        if [ "\${MOCK_MISSING_COMPONENT:-}" != rustfmt ]; then echo rustfmt-x86_64-unknown-linux-gnu; fi ;;
      target)
        for target in aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android wasm32-unknown-unknown x86_64-unknown-linux-gnu; do
          if [ "$target" != "\${MOCK_MISSING_TARGET:-}" ]; then echo "$target"; fi
        done ;;
    esac ;;
  wasm-bindgen) echo 'wasm-bindgen 0.2.122' ;;
  pnpm) echo 11.5.0 ;;
  sdkmanager) printf '%s\\n' 'platforms;android-36' 'build-tools;36.0.0' 'build-tools;35.0.0' 'ndk;29.0.14206865' 'ndk;29.0.13846066' ;;
  java)
    printf 'openjdk version "%s"\\n' "\${MOCK_JAVA_VERSION:-17.0.1}" >&2
    exit "\${MOCK_JAVA_EXIT:-0}" ;;
  pkg-config)
    if [ "\${MOCK_PKG_FAIL:-}" = 1 ]; then exit 1; fi
    case "$1" in --modversion) echo 1.2.0 ;; --libs) echo -lasound ;; esac ;;
  cc)
    if [ "\${MOCK_CC_FAIL:-}" = 1 ]; then exit 1; fi
    test "$2" = -o
    test "$4" = -lasound
    grep -F '#include <alsa/asoundlib.h>' "$1"
    grep -F 'snd_asoundlib_version()' "$1"
    printf '#!/bin/sh\\nexit 0\\n' > "$3"
    chmod +x "$3" ;;
  *) echo mock ;;
esac
`;

describe("native CI image contracts", () => {
  for (const image of images) {
    it(`${image} validates the final published build context`, () => {
      const dockerfile = source(`docker/${image}/Dockerfile`);
      const script = source(`docker/${image}/verify.sh`);
      const pipeline = parse(source(`.tekton/build-${image}.yaml`));
      const build = pipeline.spec.pipelineSpec.tasks.find((task: { name: string }) => task.name === "build");
      const params = Object.fromEntries(build.params.map((param: { name: string; value: string }) => [param.name, param.value]));
      assert.equal(build.taskRef.name, "buildkit-build");
      assert.equal(params.context, `docker/${image}`);
      assert.equal(params.dockerfile, "Dockerfile");
      assert.equal(params.target, undefined);
      assert.equal(params["output-type"], undefined);
      assert.match(pipeline.metadata.annotations["pipelinesascode.tekton.dev/on-path-change"], new RegExp(`docker/${image}/\\*\\*`));
      assert.match(dockerfile, /ENV RUST_VERSION=1\.96\.0\b/);
      assert.match(dockerfile, /rustup component add --toolchain "\$\{RUST_VERSION\}" (?:clippy rustfmt|rustfmt clippy)/);
      assert.match(dockerfile, new RegExp(`COPY verify.sh /usr/local/bin/verify-${image}\\nRUN sh /usr/local/bin/verify-${image}\\s*$`));
      assert.match(script, /rustup component list --toolchain "\$\{RUST_VERSION\}" --installed/);
      assert.match(script, /rustup target list --toolchain "\$\{RUST_VERSION\}" --installed/);
      execFileSync("sh", ["-n", join(root, `docker/${image}/verify.sh`)]);
      if (image === "rust-ci") assert.match(dockerfile, /FROM docker.io\/library\/rust:1\.96\.0-trixie/);
      if (image === "tauri-release-ci" || image === "android-ci") {
        assert.match(dockerfile, /rustup target add --toolchain "\$\{RUST_VERSION\}"/);
      }
      if (image === "tauri-release-ci") {
        assert.match(dockerfile, /\n    libasound2-dev \\/);
        assert.match(dockerfile, /\n    pkg-config \\/);
        assert.equal(params.image, "{{ CONTAINER_REGISTRY }}/rfhold/tauri-release-ci:rust1.96.0-tauri2.10.1-pnpm11.5.0-wasm0.2.122-android36");
      }
    });
  }

  it("selects the installed Java 17 over inherited Java homes and PATH entries on both package architectures", () => {
    const dockerfile = source("docker/tauri-release-ci/Dockerfile");
    const javaHome = dockerfile.match(/^ENV JAVA_HOME=(.+)$/m)?.[1];
    const javaPath = dockerfile.match(/^ENV PATH=(.+)$/m)?.[1];
    const selection = dockerfile.match(/^RUN (ln -s .+)$/m)?.[1];
    assert.ok(javaHome);
    assert.ok(javaPath);
    assert.ok(selection);
    assert.ok(dockerfile.indexOf(`RUN ${selection}`) < dockerfile.indexOf("RUN yes | sdkmanager"));
    const dir = mkdtempSync(join(tmpdir(), "tauri-java-selection-"));
    try {
      const bin = join(dir, "bin");
      const inheritedHome = join(dir, "inherited-java");
      const jvm = join(dir, "jvm");
      mkdirSync(bin);
      mkdirSync(join(inheritedHome, "bin"), { recursive: true });
      writeFileSync(join(inheritedHome, "bin/java"), '#!/bin/sh\nprintf \'openjdk version "21.0.1"\\n\' >&2\n', { mode: 0o755 });
      writeFileSync(join(bin, "dpkg"), '#!/bin/sh\ntest "$1" = --print-architecture\nprintf "%s\\n" "$MOCK_ARCH"\n', { mode: 0o755 });
      const inherited = { ...process.env, JAVA_HOME: inheritedHome, PATH: `${inheritedHome}/bin:${bin}:/usr/bin:/bin` };
      const shadowed = spawnSync("sh", ["-c", "java -version"], { env: inherited, encoding: "utf8" });
      assert.equal(shadowed.status, 0);
      assert.match(shadowed.stderr, /version "21[.]/);
      for (const arch of ["amd64", "arm64"]) {
        const installedHome = join(jvm, `java-17-openjdk-${arch}`);
        mkdirSync(join(installedHome, "bin"), { recursive: true });
        writeFileSync(join(installedHome, "bin/java"), '#!/bin/sh\nprintf \'openjdk version "17.0.1"\\n\' >&2\n', { mode: 0o755 });
        const selectedHome = join(dir, arch);
        const env: NodeJS.ProcessEnv = {
          ...inherited,
          MOCK_ARCH: arch,
          JAVA_HOME: selectedHome,
          PATH: javaPath.split("${JAVA_HOME}").join(selectedHome).split("${PATH}").join(inherited.PATH),
        };
        const selected: SpawnSyncReturns<string> = spawnSync("sh", ["-ec", selection.split("/usr/lib/jvm").join(jvm)], { env, encoding: "utf8" });
        assert.equal(selected.status, 0, selected.stderr);
        const runtime = spawnSync("sh", ["-ec", 'test -x "$JAVA_HOME/bin/java"; command -v java; java -version; "$JAVA_HOME/bin/java" -version'], { env, encoding: "utf8" });
        assert.equal(runtime.status, 0, runtime.stderr);
        assert.equal(runtime.stdout.trim(), join(selectedHome, "bin/java"));
        assert.equal(runtime.stderr, 'openjdk version "17.0.1"\nopenjdk version "17.0.1"\n');
        assert.equal(javaHome, "/opt/java17");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects toolchain drift and missing components or targets without image builds", () => {
    const dir = mkdtempSync(join(tmpdir(), "native-ci-contract-"));
    try {
      const bin = join(dir, "bin");
      const scratch = join(dir, "scratch");
      mkdirSync(bin);
      mkdirSync(scratch);
      const mock = join(bin, "mock");
      writeFileSync(mock, fakeTool, { mode: 0o755 });
      for (const name of ["rustc", "cargo", "rustup", "wasm-bindgen", "pnpm", "sdkmanager", "java", "pkg-config", "cc", "xdg-open", "zipalign", "apksigner", "bun", "docker", "Xvfb", "WebKitWebDriver", "dbus-run-session"]) {
        symlinkSync(mock, join(bin, name));
      }
      const runResult = (image: string, overrides: Record<string, string> = {}) => spawnSync("sh", [join(root, `docker/${image}/verify.sh`)], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}:/usr/bin:/bin`,
          TMPDIR: scratch,
          RUST_VERSION: "1.96.0",
          TAURI_CLI_VERSION: "2.10.1",
          WASM_BINDGEN_CLI_VERSION: "0.2.122",
          PNPM_VERSION: "11.5.0",
          NDK_VERSION: image === "android-ci" ? "29.0.13846066" : "29.0.14206865",
          ...overrides,
        },
      });
      const run = (image: string, overrides: Record<string, string> = {}): number | null => runResult(image, overrides).status;
      for (const image of images) {
        assert.equal(run(image), 0, `${image} valid contract`);
        assert.notEqual(run(image, { MOCK_RUST_VERSION: "1.93.0" }), 0, `${image} Rust mismatch`);
        assert.notEqual(run(image, { MOCK_MISSING_COMPONENT: "rustfmt" }), 0, `${image} missing rustfmt`);
        const target = image === "tauri-release-ci" || image === "android-ci" ? "aarch64-linux-android" : "x86_64-unknown-linux-gnu";
        assert.notEqual(run(image, { MOCK_MISSING_TARGET: target }), 0, `${image} missing target`);
      }
      const wrongJava = runResult("tauri-release-ci", { MOCK_JAVA_VERSION: "21.0.1" });
      assert.notEqual(wrongJava.status, 0);
      assert.match(wrongJava.stdout, /openjdk version "21\.0\.1"/);
      const failedJava = runResult("tauri-release-ci", { MOCK_JAVA_EXIT: "1" });
      assert.notEqual(failedJava.status, 0);
      assert.match(failedJava.stderr, /openjdk version "17\.0\.1"/);
      assert.notEqual(run("tauri-release-ci", { MOCK_PKG_FAIL: "1" }), 0);
      assert.notEqual(run("tauri-release-ci", { MOCK_CC_FAIL: "1" }), 0);
      assert.deepEqual(readdirSync(scratch), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
