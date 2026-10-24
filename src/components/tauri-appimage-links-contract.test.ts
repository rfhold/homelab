import assert = require("node:assert/strict");
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { parse } from "yaml";

const root = resolve(__dirname, "../..");
const task = parse(readFileSync(join(root, "src/components/tekton-tasks/tauri-release-build.yaml"), "utf8"));
const script: string = task.spec.steps.find((step: { name: string }) => step.name === "build-and-sign").script;
const start = script.indexOf("verify_appimage_links() (");
const end = script.indexOf('\nvalidate_relative_path "$APP_PATH"', start);
assert.ok(start > 0 && end > start);
const inspect = `set -euo pipefail\nexport LC_ALL=C\nfail() { printf '%s\\n' "$1" >&2; exit 1; }\n${script.slice(start, end)}\nverify_appimage_links "$1"\n`;

const readelf = `#!/bin/sh
set -eu
case "$(head -n 1 "$2")" in corrupt) exit 1 ;; esac
if [ "$1" = -h ]; then
  echo 'Class: ELF64'
  echo 'Machine: Advanced Micro Devices X86-64'
else
  if [ "$(head -n 1 "$2")" = noalsa ]; then
    echo '0x00000001 (NEEDED) Shared library: [libc.so.6]'
  else
    echo '0x00000001 (NEEDED) Shared library: [libasound.so.2]'
  fi
  echo '0x0000001d (RUNPATH) Library runpath: [$ORIGIN/../lib/private]'
fi
`;
const ldd = `#!/bin/sh
set -eu
[ "$#" = 1 ]
[ -z "\${ANDROID_SIGNING_STORE_PASSWORD:-}" ]
[ -z "\${LD_PRELOAD:-}" ]
[ "$LD_LIBRARY_PATH" = "$(dirname "$(dirname "$1")")/lib" ]
[ ! -e "$LD_LIBRARY_PATH/unrelated-plugin-was-inspected" ]
case "$(head -n 1 "$1")" in
  bundled)
    test -f "$LD_LIBRARY_PATH/libasound.so.2"
    printf '\tlibasound.so.2 => %s/libasound.so.2 (0x123)\n' "$LD_LIBRARY_PATH" ;;
  runpath)
    test -f "$LD_LIBRARY_PATH/private/libasound.so.2"
    printf '\tlibasound.so.2 => %s/private/libasound.so.2 (0x123)\n' "$LD_LIBRARY_PATH" ;;
  host) printf '\tlibasound.so.2 => /bin/sh (0x123)\n' ;;
  missing) printf '\tlibasound.so.2 => not found\n' ;;
  indirect)
    printf '\tlibasound.so.2 => /bin/sh (0x123)\n\tlibtransitive.so.1 => not found\n' ;;
  version) echo 'binary: /lib/libc.so.6: version GLIBC_99 not found'; exit 1 ;;
  noalsa) printf '\tlibc.so.6 => /bin/sh (0x123)\n' ;;
  invalidalsa) printf '\tlibasound.so.2 => /nonexistent-appimage-fixture/libasound.so.2 (0x123)\n' ;;
  lddfail) exit 1 ;;
  noisy) yes unresolved ;;
  *) exit 1 ;;
esac
`;

function fixture(mode: string, change?: (dir: string) => void): { status: number | null; stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "appimage links fixture "));
  try {
    const bin = join(dir, "tools");
    const appdir = join(dir, "fixture AppDir");
    const scratch = join(dir, "scratch");
    mkdirSync(scratch);
    mkdirSync(bin);
    mkdirSync(join(appdir, "usr/bin"), { recursive: true });
    mkdirSync(join(appdir, "usr/lib/private"), { recursive: true });
    writeFileSync(join(appdir, "app.desktop"), "[Desktop Entry]\nName=Fixture\nExec=fixture-app %U\nType=Application\n");
    writeFileSync(join(appdir, "usr/bin/fixture-app"), `${mode}\n`);
    writeFileSync(join(appdir, "usr/lib/libasound.so.2"), "fixture bundled ALSA\n");
    writeFileSync(join(appdir, "usr/lib/private/libasound.so.2"), "fixture RUNPATH ALSA\n");
    writeFileSync(join(appdir, "usr/lib/unrelated-plugin.so"), "unrelated plugin with intentionally missing optional deps\n");
    const image = join(dir, "fixture image.AppImage");
    writeFileSync(image, `#!/bin/sh\nset -eu\n[ "$#" = 1 ]\n[ "$1" = --appimage-extract ]\n[ -z "\${ANDROID_SIGNING_STORE_PASSWORD:-}" ]\n[ -z "\${LD_PRELOAD:-}" ]\ncp -R '${appdir}' squashfs-root\n`, { mode: 0o755 });
    for (const [name, contents] of Object.entries({ readelf, ldd })) {
      writeFileSync(join(bin, name), contents, { mode: 0o755 });
    }
    for (const tool of ["realpath", "timeout"]) {
      const toolPath = execFileSync("which", [process.platform === "darwin" ? `g${tool}` : tool], { encoding: "utf8" }).trim();
      symlinkSync(toolPath, join(bin, tool));
    }
    const checker = join(dir, "check.sh");
    writeFileSync(checker, inspect);
    change?.(dir);
    const result = spawnSync("bash", [checker, image], {
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: scratch, ANDROID_SIGNING_STORE_PASSWORD: "fixture-secret-do-not-log" },
    });
    assert.deepEqual(readdirSync(scratch), [], "inspection scratch must be cleaned on success and failure");
    return result;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("Tauri AppImage main ELF offline link acceptance", () => {
  it("has valid Bash syntax and gates asset installation and signing", () => {
    execFileSync("bash", ["-n"], { input: script });
    const call = script.indexOf('verify_appimage_links "${appimages[0]}"');
    assert.ok(call > script.indexOf("cargo tauri build"));
    assert.ok(call < script.indexOf("apksigner sign"));
    assert.ok(call < script.indexOf('install -m 0755 "${appimages[0]}"'));
    assert.match(script, /trap cleanup EXIT/);
    assert.match(script, /rm -f -- "\$response_file" "\$keystore_file"/);
  });

  for (const mode of ["bundled", "runpath", "host"]) {
    it(`accepts ${mode} resolution from the extracted artifact with spaces in paths`, () => {
      const result = fixture(mode);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, new RegExp(`libasound.so.2=${mode === "host" ? "builder-host" : "bundled"}`));
      assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret-do-not-log/);
    });
  }

  it("accepts a valid non-ALSA main ELF and reports not-linked", () => {
    const result = fixture("noalsa");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /libasound\.so\.2=not-linked/);
  });

  it("rejects unresolved ALSA rather than treating it as not-linked", () => {
    const result = fixture("missing");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unresolved dependencies/);
    assert.doesNotMatch(result.stdout, /not-linked/);
  });

  for (const [mode, message] of [
    ["missing", "unresolved dependencies"],
    ["indirect", "unresolved dependencies"],
    ["version", "dependency inspection failed"],
    ["corrupt", "not a readable ELF"],
    ["invalidalsa", "did not resolve libasound"],
    ["lddfail", "dependency inspection failed"],
    ["noisy", "dependency inspection failed"],
  ]) {
    it(`rejects ${mode} without leaking tool output`, () => {
      const result = fixture(mode);
      assert.notEqual(result.status, 0);
      assert.ok(result.stderr.includes(message), result.stderr);
      assert.ok(result.stdout.length + result.stderr.length < 2048);
      assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret-do-not-log|GLIBC_99|unresolved\nunresolved/);
    });
  }

  it("rejects a corrupt or non-extractable artifact", () => {
    const result = fixture("bundled", (dir) => {
      writeFileSync(join(dir, "fixture image.AppImage"), "#!/bin/sh\nexit 1\n");
      chmodSync(join(dir, "fixture image.AppImage"), 0o755);
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /extraction failed/);
  });

  it("accepts the linuxdeploy root desktop symlink into usr/share/applications", () => {
    const result = fixture("bundled", (dir) => {
      const appdir = join(dir, "fixture AppDir");
      mkdirSync(join(appdir, "usr/share/applications"), { recursive: true });
      writeFileSync(join(appdir, "usr/share/applications/app.desktop"), readFileSync(join(appdir, "app.desktop")));
      rmSync(join(appdir, "app.desktop"));
      symlinkSync("usr/share/applications/app.desktop", join(appdir, "app.desktop"));
    });
    assert.equal(result.status, 0, result.stderr);
  });

  it("rejects a root desktop symlink outside the extracted artifact", () => {
    const result = fixture("bundled", (dir) => {
      rmSync(join(dir, "fixture AppDir/app.desktop"));
      symlinkSync("/bin/sh", join(dir, "fixture AppDir/app.desktop"));
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /desktop entry escaped/);
  });

  it("rejects desktop Exec traversal", () => {
    const result = fixture("bundled", (dir) => {
      writeFileSync(join(dir, "fixture AppDir/app.desktop"), "[Desktop Entry]\nExec=../../host-app\n");
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /simple binary/);
  });

  it("rejects a main binary symlink escaping the artifact", () => {
    const result = fixture("bundled", (dir) => {
      const main = join(dir, "fixture AppDir/usr/bin/fixture-app");
      rmSync(main);
      symlinkSync("/bin/sh", main);
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /escaped usr\/bin/);
  });

  it("rejects missing main binaries and ambiguous desktop entries", () => {
    const missing = fixture("bundled", (dir) => rmSync(join(dir, "fixture AppDir/usr/bin/fixture-app")));
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /main binary is missing/);
    const ambiguous = fixture("bundled", (dir) => writeFileSync(join(dir, "fixture AppDir/extra.desktop"), "[Desktop Entry]\nExec=other\n"));
    assert.notEqual(ambiguous.status, 0);
    assert.match(ambiguous.stderr, /exactly one root desktop entry/);
  });
});
