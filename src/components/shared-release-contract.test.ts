import assert = require("node:assert/strict");
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import * as ts from "typescript";
import { parse } from "yaml";

const root = resolve(__dirname, "../..");
const source = (file: string): string => readFileSync(resolve(root, file), "utf8");
const program = source("programs/tekton/index.ts");
const component = source("src/components/tekton.ts");
const task = parse(source("src/components/tekton-tasks/tauri-release-build.yaml"));
const script: string = task.spec.steps.find((step: { name: string }) => step.name === "build-and-sign").script;
const transpile = (text: string): string => ts.transpileModule(text, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

function captureSharedResources(enabled: boolean, signer?: string): { resources: any[]; outputs: any } {
  const resources: any[] = [];
  class Resource {
    metadata: any;
    name: string;
    constructor(name: string, args: any, opts: any) {
      this.name = args.name;
      this.metadata = args.metadata;
      resources.push({ name, args, opts, kind: new.target.name });
    }
  }
  const output = (value: unknown): unknown => value;
  const shared = program.slice(program.indexOf('const tauriReleaseBuildIdentity ='), program.indexOf('new KvmDevicePlugin('));
  const outputs = program.slice(program.indexOf('export const tauriReleaseBuildOpenBaoContract ='), program.indexOf('export const kuriTauriBuildOpenBaoContract ='));
  const result = {};
  new Function("exports", "pulumi", "k8s", "vault", "tekton", "openbaoAdministration", "openbaoProvider", "releaseTrustedSigners", transpile(shared + outputs))(
    result,
    { output, interpolate: (parts: TemplateStringsArray, ...values: string[]) => parts.reduce((s, part, i) => s + part + (values[i] ?? ""), "") },
    { core: { v1: { ServiceAccount: class ServiceAccount extends Resource {}, Secret: class Secret extends Resource {} } } },
    { Policy: class Policy extends Resource {}, kubernetes: { AuthBackendRole: class AuthBackendRole extends Resource {} } },
    { pacNamespace: "pipelines-as-code" },
    enabled ? { kvMountPath: "kv", authMountPath: "kubernetes" } : undefined,
    enabled ? {} : undefined,
    signer
  );
  return { resources, outputs: result };
}

function capturePacRepositories(mapping: Record<string, string> | undefined): any[] {
  const ast = ts.createSourceFile("tekton.ts", component, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find((s): s is ts.ClassDeclaration => ts.isClassDeclaration(s) && s.name?.text === "Tekton")!;
  const method = declaration.members.find((m) => m.name?.getText(ast) === "createPacGitConfig")!;
  const resources: any[] = [];
  class Resource {
    result = "offline-placeholder";
    constructor(_name: string, args: any) { resources.push(args); }
  }
  const factory = new Function("exports", "k8s", "random", transpile(`class Capture { ${method.getText(ast)} }\nexports.call = Capture.prototype.createPacGitConfig;`) + "\nreturn exports.call;");
  const call = factory({}, { core: { v1: { Secret: Resource } }, apiextensions: { CustomResource: Resource } }, { RandomPassword: Resource });
  call.call({}, "offline", { host: "git.example.test", token: "placeholder", repositories: ["rfhold/kuri", "rfhold/waltr", "rfhold/other"] }, undefined, "b".repeat(64), mapping, undefined, undefined, undefined, undefined, {});
  return resources.filter((r) => r.kind === "Repository");
}

describe("shared release contracts", () => {
  it("creates two exact purpose-specific identities without firmware access", () => {
    const { resources, outputs } = captureSharedResources(true, "public-key-fixture");
    for (const [identity, path] of [["tauri-release-build-v1", "kv/data/ci/signing/android/release"], ["forgejo-release-v1", "kv/data/ci/forgejo/release"]]) {
      const owned = resources.filter((r) => r.name === identity);
      assert.equal(owned.length, 3);
      const sa = owned.find((r) => r.kind === "ServiceAccount").args;
      assert.deepEqual(sa, { metadata: { name: identity, namespace: "pipelines-as-code" }, automountServiceAccountToken: false });
      const policy = owned.find((r) => r.kind === "Policy").args;
      assert.equal(policy.name, identity);
      assert.equal(policy.allowOverwrite, false);
      assert.deepEqual([...policy.policy.matchAll(/path "([^"]+)"/g)].map((m) => m[1]), [path, "auth/token/lookup-self"]);
      assert.equal((policy.policy.match(/capabilities = \["read"\]/g) ?? []).length, 2);
      assert.doesNotMatch(policy.policy, /\*|esp|private-key/);
      const role = owned.find((r) => r.kind === "AuthBackendRole").args;
      assert.deepEqual(role, { backend: "kubernetes", roleName: identity, boundServiceAccountNames: [identity], boundServiceAccountNamespaces: ["pipelines-as-code"], audience: identity, tokenNoDefaultPolicy: true, tokenPolicies: [identity], tokenTtl: 900, tokenMaxTtl: 900, tokenType: "batch" });
    }
    assert.equal(outputs.tauriReleaseBuildOpenBaoContract.logicalSecretPath, "ci/signing/android/release");
    assert.deepEqual(outputs.tauriReleaseBuildOpenBaoContract.secretFields, ["keystore-base64", "store-password", "key-alias", "key-password"]);
    assert.deepEqual(outputs.forgejoReleaseOpenBaoContract.secretFields, ["token"]);
    const signer = resources.find((r) => r.kind === "Secret");
    assert.deepEqual(signer.args, { metadata: { name: "release-trusted-signers", namespace: "pipelines-as-code" }, stringData: { "signing-key.asc": "public-key-fixture" } });
    assert.deepEqual(captureSharedResources(false).resources, []);
    assert.equal(captureSharedResources(true).resources.length, 6);
  });

  it("preserves all legacy identity resources and output definitions verbatim", () => {
    const before = execFileSync("git", ["show", "HEAD:programs/tekton/index.ts"], { cwd: root, encoding: "utf8" });
    const legacyStart = 'const kuriTauriBuildServiceAccountName =';
    const legacyEnd = '\nnew KvmDevicePlugin(';
    const oldResources = before.slice(before.indexOf(legacyStart), before.indexOf(legacyEnd)).trim();
    assert.ok(program.includes(oldResources));
    const outputs = before.slice(before.indexOf('export const kuriTauriBuildOpenBaoContract ='));
    assert.ok(program.endsWith(outputs));
    assert.match(program, /config.get\("release-trusted-signers"\)/);
    assert.match(program, /config.getObject<Record<string, string>>\("android-signing-cert-sha256-by-repository"\)/);
  });

  it("emits generic fingerprints only on mapped enrolled repositories and preserves Kuri params", () => {
    const fingerprint = "a".repeat(64);
    const repos = capturePacRepositories({ "rfhold/waltr": fingerprint });
    const params = (name: string): any[] => repos.find((r) => r.metadata.name === name).spec.params ?? [];
    assert.deepEqual(params("global-git-config"), []);
    assert.deepEqual(params("pac-rfhold-waltr"), [{ name: "ANDROID_SIGNING_CERT_SHA256", value: fingerprint }]);
    assert.deepEqual(params("pac-rfhold-kuri"), [{ name: "KURI_ANDROID_SIGNING_CERT_SHA256", value: "b".repeat(64) }]);
    assert.deepEqual(params("pac-rfhold-other"), []);
    assert.ok(capturePacRepositories(undefined).every((r) => !(r.spec.params ?? []).some((p: any) => p.name === "ANDROID_SIGNING_CERT_SHA256")));
  });

  it("rejects malformed fingerprints and unenrolled or case-mismatched targets", () => {
    const start = component.indexOf("export function validateAndroidSigningCertSha256ByRepository(");
    const end = component.indexOf("export class Tekton", start);
    const exports: any = {};
    new Function("exports", transpile(component.slice(start, end)))(exports);
    const validate = exports.validateAndroidSigningCertSha256ByRepository;
    validate(undefined, []);
    validate({ "rfhold/waltr": "A".repeat(64) }, ["rfhold/waltr"]);
    for (const value of ["", "a".repeat(63), "a".repeat(65), "gg".repeat(32), "aa:".repeat(31) + "aa", "a".repeat(64) + "\n", null, 123]) {
      assert.throws(() => validate({ "rfhold/waltr": value }, ["rfhold/waltr"]));
    }
    for (const repo of ["rfhold/other", "rfhold/Waltr", "rfhold/waltr/", "rfhold/*"]) assert.throws(() => validate({ [repo]: "a".repeat(64) }, ["rfhold/waltr"]));
    assert.throws(() => validate([], []));
    assert.match(component, /validateAndroidSigningCertSha256ByRepository\(\s*args.pac\?\.androidSigningCertSha256ByRepository,/);
  });

  it("defaults to legacy filenames but validates generic artifact prefixes before secret retrieval", () => {
    assert.equal(task.spec.params.find((p: any) => p.name === "artifact-prefix").default, "kuri");
    const env = task.spec.steps.find((s: any) => s.name === "build-and-sign").env;
    assert.deepEqual(env.find((e: any) => e.name === "ARTIFACT_PREFIX"), { name: "ARTIFACT_PREFIX", value: "$(params.artifact-prefix)" });
    execFileSync("bash", ["-n"], { input: script });
    const start = script.indexOf('[[ "$ARTIFACT_PREFIX" =~');
    const end = script.indexOf('\n[[ "$VERSION" =~', start);
    assert.ok(start > 0 && end > start && end < script.indexOf("http_code=$(curl"));
    const validation = `fail() { exit 7; }\n${script.slice(start, end)}\n`;
    const run = (prefix: string): number | null => spawnSync("bash", ["-c", validation], { env: { ...process.env, ARTIFACT_PREFIX: prefix } }).status;
    for (const prefix of ["kuri", "waltr", "app-2", "a".repeat(63)]) assert.equal(run(prefix), 0);
    for (const prefix of ["", "../waltr", "/waltr", "--waltr", "waltr/other", "waltr\\other", "waltr;exit 0", "$(exit 0)", "waltr\nother", "WALTR", "waltr_2", "waltr.", "waltr-", "waltr--a", "a".repeat(64)]) assert.notEqual(run(prefix), 0, prefix);
    assert.match(script, /\$OUTPUT_ROOT\/\$\{ARTIFACT_PREFIX\}-\$\{VERSION\}-android-universal\.apk/);
    assert.match(script, /\$OUTPUT_ROOT\/\$\{ARTIFACT_PREFIX\}-\$\{VERSION\}-linux-amd64\.AppImage/);
    assert.doesNotMatch(script, /KURI_/);
    assert.match(script, /--ks-pass env:ANDROID_SIGNING_STORE_PASSWORD/);
    assert.match(script, /unset ANDROID_SIGNING_STORE_PASSWORD ANDROID_SIGNING_KEY_ALIAS ANDROID_SIGNING_KEY_PASSWORD/);
  });
});
