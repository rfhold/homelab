import assert = require("node:assert/strict");
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { parse } from "yaml";

type Result = {exitCode: number | null; signalCode?: string; stdout?: Buffer; stderr?: Buffer};

const task = parse(readFileSync(resolve(__dirname, "tekton-tasks/service-pulumi-up-v1.yaml"), "utf8"));
const script: string = task.spec.steps.find((step: {name: string}) => step.name === "execute").script;
const runScript = new Function("Bun", "process", "console", "realpathSync", "mkdirSync", "rmSync", "resolve", "relative", "isAbsolute",
  `return (async () => {${script.replace(/^#![^\n]*\n/, "").replace(/^import .*;\n/gm, "")}\n})();`) as
  (...args: unknown[]) => Promise<void>;

async function execute(update: Result | Error, version: Result = {exitCode: 0, stdout: Buffer.from("v3.253.0")}):
Promise<{exitCode: number; errors: string[]}> {
  const calls: {args: string[]; stdout: string; stderr: string}[] = [];
  const spawnSync = (args: string[], options: {stdout: string; stderr: string}): Result => {
    calls.push({args, stdout: options.stdout, stderr: options.stderr});
    if (args[0] === "bun" && args[1] === "--version") return {exitCode: 0, stdout: Buffer.from("1.3.5")};
    if (args[0] === "bun" && args[1] === "install") return {exitCode: 0, stdout: Buffer.alloc(0)};
    if (args[0] === "pulumi" && args[1] === "version") return version;
    if (update instanceof Error) throw update;
    return update;
  };
  const env = {
    SOURCE: "/workspace/source", SOURCE_SUBDIR: "infra", STACK: "preview",
    IMAGE_CONFIG: JSON.stringify({image: `registry.example/test/image@sha256:${"a".repeat(64)}`}),
    OPENBAO_ENABLED: "false", AUTHENTIK_ENABLED: "false", GRAFANA_ENABLED: "false", NATS_ENABLED: "false",
  };
  const proc = {env, once: () => {}, exitCode: 0};
  const errors: string[] = [];
  const removed: string[] = [];
  try {
    await runScript({spawnSync}, proc, {error: (message: string) => errors.push(message)}, (path: string) => path,
      () => {}, (path: string) => removed.push(path), resolve, relative, isAbsolute);
  } finally {
    assert.deepEqual(removed, ["/var/run/secrets/openbao-ci/session/token", "/session/pulumi", "/session/home"]);
  }
  assert.deepEqual(calls, [
    {args: ["bun", "--version"], stdout: "pipe", stderr: "pipe"},
    {args: ["pulumi", "version"], stdout: "pipe", stderr: "pipe"},
    {args: ["bun", "install", "--frozen-lockfile"], stdout: "pipe", stderr: "pipe"},
    {args: ["pulumi", "up", "--stack", "preview", "--yes", "--skip-preview", "--config",
      `image=registry.example/test/image@sha256:${"a".repeat(64)}`], stdout: "inherit", stderr: "inherit"},
  ]);
  return {exitCode: proc.exitCode, errors};
}

describe("shared Pulumi update diagnostics", () => {
  it("streams both update outputs on success without changing the command", async () => {
    assert.deepEqual(await execute({exitCode: 0}), {exitCode: 0, errors: []});
  });

  it("streams failures and preserves the nonzero exit code through cleanup", async () => {
    assert.deepEqual(await execute({exitCode: 255}), {exitCode: 255, errors: ["pulumi up failed (exit 255)"]});
  });

  it("fails after a signal even when there is no numeric exit status", async () => {
    assert.deepEqual(await execute({exitCode: null, signalCode: "SIGPIPE"}),
      {exitCode: 1, errors: ["pulumi up failed (SIGPIPE)"]});
  });

  it("handles startup errors without printing internal exception details", async () => {
    assert.deepEqual(await execute(new Error("private runtime error")),
      {exitCode: 1, errors: ["pulumi up could not start"]});
  });

  it("distinguishes version failures without printing version command output", async () => {
    await assert.rejects(execute({exitCode: 0}, {exitCode: 1, stderr: Buffer.from("private path")}),
      {message: "Pulumi version check failed"});
    await assert.rejects(execute({exitCode: 0}, {exitCode: 0, stdout: Buffer.from("private value")}),
      {message: "Pulumi version mismatch"});
  });
});
