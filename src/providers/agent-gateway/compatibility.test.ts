import assert = require("node:assert/strict");
import { readFileSync } from "node:fs";
import { createServer, Server } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { it } from "node:test";
import { parse, parseAllDocuments } from "yaml";
import {
  AgentGatewayProviderConfig,
  applyAgentGatewayChartResource,
  generateAgentGatewayBootstrapConfig,
  generateAgentGatewayProviderResources,
  generateAgentGatewayRouteResources,
} from "../../components/agent-gateway";

(process.env.AGENT_GATEWAY_VALIDATION_CHART ? it : it.skip)("renders the released chart with stable identities and database bootstrap", () => {
  const rendered = spawnSync("helm", ["template", "agent-gateway", process.env.AGENT_GATEWAY_VALIDATION_CHART!,
    "--namespace", "agentgateway-system", "-f", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      fullnameOverride: "agent-gateway", mode: "database", replicaCount: 2,
      database: { postgres: { url: "postgresql://$DATABASE_URL_REMAINDER" } },
      config: generateAgentGatewayBootstrapConfig([], "database", "first-class"),
      gateway: { service: { enabled: true, type: "ClusterIP", ports: [{ name: "http", port: 4000, targetPort: 4000, protocol: "TCP" }] } },
    }),
  });
  assert.equal(rendered.status, 0, rendered.stderr);
  const resources = parseAllDocuments(rendered.stdout).map((document) => document.toJSON()).map((resource) =>
    applyAgentGatewayChartResource(`kubernetes:${resource.apiVersion === "v1" ? "core/v1" : resource.apiVersion}:${resource.kind}`, resource));
  assert.deepEqual(resources.map(({ kind, metadata }) => `${kind}/${metadata.name}`).sort(), [
    "ConfigMap/agent-gateway-config", "Deployment/agent-gateway", "Service/agent-gateway", "ServiceAccount/agent-gateway",
  ]);
  const deployment = resources.find(({ kind }) => kind === "Deployment")!;
  assert.equal(deployment.spec.replicas, 2);
  assert.equal(deployment.spec.template.spec.terminationGracePeriodSeconds, 660);
  assert.deepEqual(deployment.spec.selector.matchLabels, resources.find(({ kind }) => kind === "Service")!.spec.selector);
  assert.equal(deployment.metadata.labels["helm.sh/chart"], "agent-gateway-v1.7.0");
  const container = deployment.spec.template.spec.containers[0];
  assert.match(container.image, /:1\.7\.0$|:v1\.7\.0$/);
  assert.equal(container.startupProbe.failureThreshold * container.startupProbe.periodSeconds, 60);
  assert.equal(container.readinessProbe.httpGet.port, 15021);
  const config = parse(resources.find(({ kind }) => kind === "ConfigMap")!.data["config.yaml"]);
  assert.equal(config.config.storage.mode, "hybrid");
  assert.equal(config.config.database.url, "postgresql://$DATABASE_URL_REMAINDER");
  assert.equal(config.llm.discovery, "disabled");
  assert.equal(config.frontendPolicies.http.maxBufferSize, 67_108_864);
});

async function listen(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return (server.address() as { port: number }).port;
}

it("declares upstream wire capabilities independently of the inbound route surface", () => {
  const stack = parse(readFileSync("programs/agent-gateway/Pulumi.pantheon.yaml", "utf8")).config;
  const providers: AgentGatewayProviderConfig[] = stack["agent-gateway:providers"];
  const resources = generateAgentGatewayProviderResources(providers);
  const values = Object.fromEntries(resources.map(({ id, value }) => [id, value])) as Record<string, any>;
  assert.equal(values.openai.provider, "openAI");
  assert.equal(values.anthropic.provider, "anthropic");
  assert.equal(values.claude.provider, "anthropic");
  const formats = {
    chutes: ["completions"],
    cerebras: ["completions"],
    codex: ["responses", "completions"],
    "vllm-local-embedding": ["embeddings"],
    "vllm-vulkan-embedding": ["embeddings"],
    "llama-cpp-local-small": ["completions"],
    "llama-cpp-vulkan-small": ["completions"],
    "llama-cpp-vulkan": ["completions"],
  };
  for (const [name, types] of Object.entries(formats)) {
    const expected = { custom: { formats: types.map((type) => ({ type })) } };
    assert.deepEqual(values[name].provider, expected);
    const legacy = generateAgentGatewayRouteResources(providers, "database", "routes").find(({ id }) => id === name);
    assert.deepEqual((legacy!.value as any).backends[0].ai.provider, expected);
  }
  assert.ok(resources.filter(({ id }) => id !== "openai" && id !== "anthropic")
    .every(({ value }: any) => value.params.baseUrl.endsWith("/v1")));
  for (const upstreamFormats of [[], ["responses", "responses"], ["models"]]) {
    assert.throws(() => generateAgentGatewayProviderResources([{
      ...providers.find(({ name }) => name === "codex")!,
      upstreamFormats: upstreamFormats as AgentGatewayProviderConfig["upstreamFormats"],
    }]), /Invalid upstream formats/);
  }
});

(process.env.AGENT_GATEWAY_VALIDATION_BINARY ? it : it.skip)("checks v1.7 paths, conversions, wildcard inventory, and bounded retries against loopback backends", async () => {
  const binary = process.env.AGENT_GATEWAY_VALIDATION_BINARY!;
  assert.equal(spawnSync(binary, ["-V"], { encoding: "utf8" }).stdout.trim(), "1.7.0");
  const requests: Array<{ path: string; body: any }> = [];
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ path: request.url!, body: JSON.parse(Buffer.concat(chunks).toString()) });
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "synthetic unavailable", type: "server_error" } }));
  });
  const upstreamPort = await listen(upstream);
  const reservation = createServer();
  const gatewayPort = await listen(reservation);
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const stack = parse(readFileSync("programs/agent-gateway/Pulumi.pantheon.yaml", "utf8")).config;
  const bootstrap = generateAgentGatewayBootstrapConfig([], "database", "first-class", [], "5s", stack["agent-gateway:requestRetry"]);
  const candidate = {
    ...bootstrap,
    routes: generateAgentGatewayBootstrapConfig([{
      name: "bifrost", provider: { openai: {}, host: "127.0.0.1", port: upstreamPort },
      policies: { ai: { routes: { "/openai/v1/chat/completions": "Completions", "*": "Passthrough" }, modelPrefix: "bifrost/" } },
    }], "file", "routes").routes,
    config: { adminAddr: "127.0.0.1:0", statsAddr: "127.0.0.1:0", readinessAddr: "127.0.0.1:0" },
    gateways: { default: { ...bootstrap.gateways.default, port: gatewayPort, bindAddress: "127.0.0.1" } },
    llm: {
      ...bootstrap.llm,
      models: [
        { name: "claude-test", provider: "anthropic", params: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1` } },
        { name: "chat/*", provider: { custom: { formats: [{ type: "completions" }] } }, params: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1` } },
        { name: "local-embedding", provider: { custom: { formats: [{ type: "embeddings" }] } }, params: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1` } },
        { name: "other-embedding", provider: { custom: { formats: [{ type: "embeddings" }] } }, params: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1` } },
      ],
    },
  };
  const child = spawn(binary, ["-c", JSON.stringify(candidate)], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const endpoint = `http://127.0.0.1:${gatewayPort}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        const response = await fetch(`${endpoint}/v1/models`);
        if (response.ok) {
          const inventory = await response.json() as { data: Array<{ id: string }> };
          assert.deepEqual(inventory.data.map(({ id }) => id).sort(), ["chat/*", "claude-test", "local-embedding", "other-embedding"]);
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(ready, output);
    assert.equal(requests.length, 0);
    for (const size of [67_108_864, 67_108_865]) {
      requests.length = 0;
      const prefix = '{"model":"chat/test","messages":[{"role":"user","content":"';
      const suffix = '"}]}';
      const body = prefix + "x".repeat(size - prefix.length - suffix.length) + suffix;
      assert.equal(Buffer.byteLength(body), size);
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: "POST", headers: { "content-type": "application/json" }, body,
      });
      await response.text();
      if (size === 67_108_864) {
        assert.equal(response.status, 503, output);
        assert.equal(requests.length, 1);
      } else {
        assert.equal(response.status, 413, output);
        assert.equal(requests.length, 0);
      }
    }
    for (const [path, body, expectedPath, count] of [
      ["/openai/v1/chat/completions", { model: "bifrost/test", messages: [{ role: "user", content: "test" }] }, "/openai/v1/chat/completions", 1],
      ["/v1/messages", { model: "claude-test", max_tokens: 8, messages: [{ role: "user", content: "test" }] }, "/v1/messages", 1],
      ["/v1/messages", { model: "chat/test", max_tokens: 8, messages: [{ role: "user", content: "test" }] }, "/v1/chat/completions", 1],
      ["/v1/responses", { model: "chat/test", input: "test" }, "/v1/chat/completions", 1],
      ["/v1/chat/completions", { model: "chat/test", messages: [{ role: "user", content: "test" }] }, "/v1/chat/completions", 1],
      ["/v1/embeddings", { model: "local-embedding", input: "test" }, "/v1/embeddings", 2],
      ["/v1/embeddings", { model: "other-embedding", input: "test" }, "/v1/embeddings", 1],
    ] as const) {
      requests.length = 0;
      const response = await fetch(`${endpoint}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      await response.text();
      assert.equal(response.status, 503, output);
      assert.equal(requests.length, count, `${path}: ${output}`);
      assert.ok(requests.every(({ path }) => path === expectedPath));
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await once(child, "exit");
    }
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
