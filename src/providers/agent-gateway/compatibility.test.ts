import assert = require("node:assert/strict");
import { readFileSync } from "node:fs";
import { createServer, Server } from "node:http";
import { connect } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { it } from "node:test";
import { parse, parseAllDocuments } from "yaml";
import {
  AgentGatewayProviderConfig,
  applyAgentGatewayChartResource,
  generateAgentGatewayBootstrapConfig,
  generateAgentGatewayModelResources,
  generateAgentGatewayProviderResources,
  generateAgentGatewayRouteResources,
  generateAgentGatewayVirtualModelResources,
} from "../../components/agent-gateway";

(process.env.AGENT_GATEWAY_VALIDATION_CHART ? it : it.skip)("renders the released chart with stable identities and database bootstrap", () => {
  const stack = parse(readFileSync("programs/agent-gateway/Pulumi.pantheon.yaml", "utf8")).config;
  const rendered = spawnSync("helm", ["template", "agent-gateway", process.env.AGENT_GATEWAY_VALIDATION_CHART!,
    "--namespace", "agentgateway-system", "-f", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      fullnameOverride: "agent-gateway", mode: "database", replicaCount: 2,
      database: { postgres: { url: "postgresql://$DATABASE_URL_REMAINDER" } },
      config: generateAgentGatewayBootstrapConfig(
        stack["agent-gateway:providers"], "database", "first-class",
        stack["agent-gateway:modelExtractionExclusionPaths"], undefined, stack["agent-gateway:requestRetry"], {
          modelDiscovery: stack["agent-gateway:modelDiscovery"],
          responseIdleTimeout: stack["agent-gateway:responseIdleTimeout"],
          accessLogDatabaseLlm: stack["agent-gateway:accessLogDatabaseLlm"],
        }
      ),
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
  const configMap = resources.find(({ kind }) => kind === "ConfigMap")!;
  assert.notEqual(configMap.immutable, true);
  assert.equal(configMap.metadata.annotations["pulumi.com/patchForce"], "true");
  const config = parse(configMap.data["config.yaml"]);
  assert.equal(config.config.storage.mode, "hybrid");
  assert.equal(config.config.database.url, "postgresql://$DATABASE_URL_REMAINDER");
  assert.equal(config.llm.discovery, "catalog");
  assert.deepEqual(config.llm.policies, { apiKey: { mode: "permissive", keys: [] } });
  assert.equal(config.frontendPolicies.http.maxBufferSize, 67_108_864);
  assert.deepEqual(config.frontendPolicies.accessLog, { database: { llm: "metadata" } });
  assert.deepEqual(config.policies[0].policy, { timeout: { requestTimeout: "600s", responseIdleTimeout: "120s" } });
  assert.deepEqual(config.policies[1].policy, { retry: stack["agent-gateway:requestRetry"] });
  assert.deepEqual(config.frontendPolicies.tracing, {
    host: "telemetry.holdenitdown.net:4317", policies: { backendTLS: {} }, protocol: "grpc", path: "/v1/traces",
    clientSampling: "true", randomSampling: "true",
  });
  assert.ok(!("tracing" in config.config));
  assert.ok(!("modelCatalog" in config.config));
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
    const expected = { custom: { formats: types.map((type) => ({ type })), ...(name === "codex" ? { providerOverride: "openai" } : {}) } };
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

(process.env.AGENT_GATEWAY_VALIDATION_BINARY ? it : it.skip)("checks v1.7 paths, conversions, wildcard inventory, retries, and response body idle cutoff against loopback backends", async () => {
  const binary = process.env.AGENT_GATEWAY_VALIDATION_BINARY!;
  assert.equal(spawnSync(binary, ["-V"], { encoding: "utf8" }).stdout.trim(), "1.7.0");
  const requests: Array<{ path: string; body: any }> = [];
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests.push({ path: request.url!, body });
    if (body.stream) {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write('data: {"id":"chatcmpl-stalled","object":"chat.completion.chunk","created":0,"model":"chat/test","choices":[{"index":0,"delta":{"content":"first frame"},"finish_reason":null}]}\n\n');
      return;
    }
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "synthetic unavailable", type: "server_error" } }));
  });
  const upstreamPort = await listen(upstream);
  const reservation = createServer();
  const gatewayPort = await listen(reservation);
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const stack = parse(readFileSync("programs/agent-gateway/Pulumi.pantheon.yaml", "utf8")).config;
  const bootstrap = generateAgentGatewayBootstrapConfig(
    [], "database", "first-class", ["/v1/embeddings"], "5s", stack["agent-gateway:requestRetry"],
    { responseIdleTimeout: "300ms" }
  );
  const embedding = generateAgentGatewayVirtualModelResources(
    stack["agent-gateway:providers"], stack["agent-gateway:virtualModels"]
  ).find(({ id }) => id === "local-embedding")!.value;
  const candidate = {
    ...bootstrap,
    frontendPolicies: { http: bootstrap.frontendPolicies.http },
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
        ...["local-embedding-athena", "local-embedding-vulkan"].map((name) => ({
          name,
          visibility: "internal",
          provider: { custom: { formats: [{ type: "embeddings" }, { type: "completions" }] } },
          params: { baseUrl: `http://127.0.0.1:${upstreamPort}/${name}/v1`, model: "qwen-fixture" },
          health: { eviction: { consecutiveFailures: 1, duration: "30s" } },
        })),
        { name: "other-embedding", provider: { custom: { formats: [{ type: "embeddings" }] } }, params: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1` } },
      ],
      virtualModels: [embedding],
    },
  };
  const child = spawn(binary, ["-c", JSON.stringify(candidate)], { env: {}, stdio: ["ignore", "pipe", "pipe"] });
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
    for (const [path, body, expectedPath, count, modelHeader] of [
      ["/openai/v1/chat/completions", { model: "bifrost/test", messages: [{ role: "user", content: "test" }] }, "/openai/v1/chat/completions", 1],
      ["/v1/messages", { model: "claude-test", max_tokens: 8, messages: [{ role: "user", content: "test" }] }, "/v1/messages", 1],
      ["/v1/messages", { model: "chat/test", max_tokens: 8, messages: [{ role: "user", content: "test" }] }, "/v1/chat/completions", 1],
      ["/v1/responses", { model: "chat/test", input: "test" }, "/v1/chat/completions", 1],
      ["/v1/chat/completions", { model: "chat/test", messages: [{ role: "user", content: "test" }] }, "/v1/chat/completions", 1],
      ["/v1/chat/completions", { model: "local-embedding", messages: [{ role: "user", content: "test" }] }, "/v1/chat/completions", 1],
      ["/v1/embeddings", { model: "local-embedding", input: "test" }, "/v1/embeddings", 2],
      ["/v1/embeddings", { model: "local-embedding", input: "test" }, "/v1/embeddings", 2, "other-embedding"],
      ["/v1/embeddings", { model: "other-embedding", input: "test" }, "/v1/embeddings", 1, "local-embedding"],
    ] as const) {
      requests.length = 0;
      const headers = { "content-type": "application/json", ...(modelHeader ? { "x-model": modelHeader } : {}) };
      const response = await fetch(`${endpoint}${path}`, {
        method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(5_000),
      });
      await response.text();
      assert.equal(response.status, 503, output);
      assert.equal(requests.length, count, `${path}: ${output}`);
      if (body.model === "bifrost/test") assert.equal(requests[0].body.model, "test");
      if (body.model === "local-embedding") {
        assert.ok(requests.every(({ body, path }) =>
          body.model === "qwen-fixture" && ["athena", "vulkan"].some((target) => path === `/local-embedding-${target}${expectedPath}`)
        ));
      } else {
        assert.ok(requests.every(({ path }) => path === expectedPath));
      }
    }
    requests.length = 0;
    const noModel = await fetch(`${endpoint}/v1/embeddings`, {
      method: "POST", headers: { "content-type": "application/json", "x-model": "local-embedding" },
      body: JSON.stringify({ input: "test" }), signal: AbortSignal.timeout(5_000),
    });
    assert.equal(noModel.status, 400, output);
    assert.match(await noModel.text(), /missing_model/);
    assert.equal(requests.length, 0);

    const body = JSON.stringify({ model: "chat/test", messages: [{ role: "user", content: "test" }], stream: true });
    const stream = connect({ host: "127.0.0.1", port: gatewayPort });
    let received = "";
    stream.setEncoding("utf8");
    stream.on("data", (frame) => { received += frame; });
    stream.setTimeout(2_500, () => stream.destroy(new Error("fixture wait for response body idle cutoff expired")));
    stream.write(`POST /v1/chat/completions HTTP/1.1\r\nHost: 127.0.0.1:${gatewayPort}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    await once(stream, "close");
    assert.match(received, /^HTTP\/1\.1 200 OK\r\n/);
    assert.match(received, /\r\ntransfer-encoding: chunked\r\n/i);
    assert.match(received, /first frame/);
    assert.ok(!received.endsWith("\r\n0\r\n\r\n"), output);
    assert.equal(requests.length, 1, output);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await once(child, "exit");
    }
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});

(process.env.AGENT_GATEWAY_VALIDATION_BINARY ? it : it.skip)("discovers and prices models from the v1.7 built-in catalog without storing LLM payloads", async () => {
  const binary = process.env.AGENT_GATEWAY_VALIDATION_BINARY!;
  assert.equal(spawnSync(binary, ["-V"], { encoding: "utf8" }).stdout.trim(), "1.7.0");
  const cases = [
    { request: "dreamer", upstream: "gpt-6.2-astra", returned: "gpt-6.2-astra", cost: null },
    { request: "codex/gpt-6.2-astra", upstream: "gpt-6.2-astra", returned: "unlisted-response", cost: null },
    { request: "workhorse", upstream: "gpt-6.2-sol", returned: "gpt-6.2-sol", cost: null },
    { request: "codex/gpt-6.2-sol", upstream: "gpt-6.2-sol", returned: "gpt-6.2-sol", cost: null },
    { request: "turbo", upstream: "gpt-6-luna", returned: "unlisted-response", cost: 0.000127 },
    { request: "codex/gpt-6-luna", upstream: "gpt-6-luna", returned: "gpt-6-luna", cost: 0.000127 },
    { request: "dreamer", upstream: "gpt-6.2-astra", returned: "gpt-6-luna", cost: 0.000127 },
    { request: "codex/gpt-6.2-astra-unknown", upstream: "gpt-6.2-astra-unknown", returned: "gpt-6.2-astra-unknown", cost: null },
    { request: "claude/claude-sonnet-4-6", upstream: "claude-sonnet-4-6", returned: "claude-sonnet-4-6", cost: 0.00375, claude: true },
  ];
  const requests: Array<{ path: string; model: string; authenticated: boolean }> = [];
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const fixture = cases[requests.length];
    requests.push({
      path: request.url!,
      model: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()).model : "",
      authenticated: Boolean(request.headers.authorization || request.headers["x-api-key"]),
    });
    if (request.method !== "POST" || !fixture) {
      response.writeHead(500).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(fixture.claude ? {
      id: "msg_fixture", type: "message", role: "assistant", model: fixture.returned,
      content: [{ type: "text", text: "synthetic completion" }],
      stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 50 },
    } : {
      id: "resp_fixture", status: "completed", model: fixture.returned, output: [],
      usage: {
        input_tokens: 1000, output_tokens: 50,
        input_tokens_details: {
          cached_tokens: 200, cache_write_tokens: 300, cache_write_tokens_details: { ttl_12h_tokens: 100 },
        },
      },
    }));
  });
  const upstreamPort = await listen(upstream);
  const reservation = createServer();
  const gatewayPort = await listen(reservation);
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const stack = parse(readFileSync("programs/agent-gateway/Pulumi.pantheon.yaml", "utf8")).config;
  const configured: AgentGatewayProviderConfig[] = stack["agent-gateway:providers"];
  const providers = configured.map((provider) => ({
    ...provider,
    provider: { ...provider.provider, host: "127.0.0.1", port: upstreamPort },
  }));
  const bootstrap = generateAgentGatewayBootstrapConfig(providers, "database", "first-class", [], "5s", undefined, {
    modelDiscovery: stack["agent-gateway:modelDiscovery"],
    accessLogDatabaseLlm: stack["agent-gateway:accessLogDatabaseLlm"],
  });
  const models = generateAgentGatewayModelResources(providers);
  const virtualModels = generateAgentGatewayVirtualModelResources(providers, stack["agent-gateway:virtualModels"]);
  const candidate = {
    ...bootstrap,
    frontendPolicies: {
      http: bootstrap.frontendPolicies.http,
      accessLog: {
        database: {
          ...bootstrap.frontendPolicies.accessLog!.database,
          add: { "fixture.prompt": "llm.prompt", "fixture.completion": "llm.completion" },
        },
      },
    },
    config: {
      ...bootstrap.config,
      adminAddr: "127.0.0.1:0",
      statsAddr: "127.0.0.1:0",
      readinessAddr: "127.0.0.1:0",
      storage: { mode: "readOnly" },
      logging: { database: { url: "sqlite::memory:", maxConnections: 1 } },
    },
    gateways: { default: { ...bootstrap.gateways.default, port: gatewayPort, bindAddress: "127.0.0.1" } },
    llm: {
      ...bootstrap.llm,
      providers: generateAgentGatewayProviderResources(providers).map(({ value }) => value),
      models: models.map(({ value }) => value),
      virtualModels: virtualModels.map(({ value }) => value),
    },
  };
  const child = spawn(binary, ["-c", JSON.stringify(candidate)], { env: {}, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const endpoint = `http://127.0.0.1:${gatewayPort}`;
  const post = (path: string, body: object): Promise<Response> => fetch(`${endpoint}${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  });
  try {
    let inventory: Set<string> | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(output);
      const response = await fetch(`${endpoint}/v1/models`).catch(() => undefined);
      if (response?.ok) {
        const { data } = await response.json() as { data: Array<{ id: string }> };
        inventory = new Set(data.map(({ id }) => id));
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(inventory, output);
    assert.equal(requests.length, 0, "inventory must not contact an upstream provider");
    for (const { id, value } of models) {
      if (id.endsWith("/*")) {
        assert.ok(!inventory.has(id), id);
      } else if (typeof value === "object" && value !== null && "visibility" in value && value.visibility === "internal") {
        assert.ok(!inventory.has(id), id);
      } else {
        assert.ok(inventory.has(id), id);
      }
    }
    for (const { id } of virtualModels) assert.ok(typeof id === "string" && inventory.has(id), String(id));
    for (const id of [
      "openai/gpt-6-luna", "codex/gpt-6-luna", "anthropic/claude-sonnet-4-6", "claude/claude-sonnet-4-6",
    ]) assert.ok(inventory.has(id), id);
    for (const id of [
      "gpt-6-luna", "claude-sonnet-4-6", "claude/gpt-6-luna", "codex/claude-sonnet-4-6",
      "openai/gpt-6.2-astra", "openai/gpt-6.2-sol", "codex/gpt-6.2-astra", "codex/gpt-6.2-sol",
    ]) assert.ok(!inventory.has(id), id);
    for (const fixture of cases) {
      const path = fixture.claude ? "/v1/messages" : "/v1/responses";
      const response = await post(path, fixture.claude
        ? { model: fixture.request, max_tokens: 100, messages: [{ role: "user", content: "synthetic" }] }
        : { model: fixture.request, input: "synthetic" });
      assert.equal(response.status, 200, await response.text());
      assert.deepEqual(requests.at(-1), { path, model: fixture.upstream, authenticated: false });
    }
    const filters = { provider: ["openai", "anthropic"] };
    const response = await post("/api/logs/search", { filters });
    assert.equal(response.status, 200, output);
    const { logs } = await response.json() as {
      logs: Array<{
        id: string; cost: number | null; genAi: { providerName: string; requestModel: string; responseModel: string };
        httpStatus: number; hasPayload: boolean; promptPreview: string | null;
        usage: { inputTokens: number; outputTokens: number }; startedAt: string; completedAt: string; durationMs: number;
      }>;
    };
    assert.equal(logs.length, cases.length, JSON.stringify(logs));
    for (const [index, log] of logs.reverse().entries()) {
      const fixture = cases[index];
      assert.equal(log.genAi.providerName, fixture.claude ? "anthropic" : "openai");
      assert.equal(log.genAi.requestModel, fixture.upstream);
      assert.equal(log.genAi.responseModel, fixture.returned);
      assert.equal(log.httpStatus, 200);
      assert.equal(log.hasPayload, false);
      assert.equal(log.promptPreview, null);
      assert.equal(log.usage.inputTokens, 1000);
      assert.equal(log.usage.outputTokens, 50);
      assert.ok(Date.parse(log.completedAt) >= Date.parse(log.startedAt) && log.durationMs >= 0);
      if (fixture.cost === null) assert.equal(log.cost, null);
      else assert.ok(log.cost !== null && Math.abs(log.cost - fixture.cost) < 1e-10, JSON.stringify(log));
      if (fixture.claude) {
        const detail = await post("/api/logs/get", { id: log.id, includePayload: true });
        assert.equal(detail.status, 200, output);
        const { log: stored } = await detail.json() as { log: { attributes: Record<string, unknown>; payload: unknown } };
        assert.match(JSON.stringify(stored.attributes["fixture.prompt"]), /synthetic/);
        assert.match(JSON.stringify(stored.attributes["fixture.completion"]), /synthetic completion/);
        assert.deepEqual(stored.payload, { requestPrompt: null, responseCompletion: null });
      }
    }
    const analytics = await post("/api/logs/analytics/summary", { filters, groupBy: [{ field: "provider" }] });
    assert.equal(analytics.status, 200, await analytics.clone().text());
    const { groups } = await analytics.json() as { groups: Array<{ group: { provider: string }; cost: number }> };
    assert.equal(groups.length, 2);
    for (const { group, cost } of groups) {
      const expected = cases.filter(({ claude }) => (claude ? "anthropic" : "openai") === group.provider)
        .reduce((sum, fixture) => sum + (fixture.cost ?? 0), 0);
      assert.ok(Math.abs(cost - expected) < 1e-10, JSON.stringify(groups));
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await once(child, "exit");
    }
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
