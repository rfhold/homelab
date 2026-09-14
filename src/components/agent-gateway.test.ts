import assert = require("node:assert/strict");
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as pulumi from "@pulumi/pulumi";
import {
  AgentGatewayProviderConfig,
  applyAgentGatewayDatabaseBootstrap,
  applyAgentGatewayChartResource,
  AGENT_GATEWAY_MIGRATION_ROUTE_PREFIX,
  CLOUD_NATIVE_PG_CLUSTER_RESOURCE_TOKEN,
  EXTERNAL_DNS_HOSTNAME_ANNOTATION,
  generateAgentGatewayBootstrapConfig,
  generateAgentGatewayModelResources,
  generateAgentGatewayProviderResources,
  generateAgentGatewayRouteResources,
  getDatabaseUrlRemainder,
  parseAgentGatewayRouteStorageMode,
  parseAgentGatewayRoutingRepresentationMode,
  validateAgentGatewayRoutingModes,
  validateResolvedProviderCredential,
  AgentGateway,
  AGENT_GATEWAY_CONNECTION_TERMINATION_DEADLINE,
  AGENT_GATEWAY_NAME,
  AGENT_GATEWAY_NAMESPACE,
  AGENT_GATEWAY_PORT,
  AGENT_GATEWAY_HEALTH_PORT,
  AGENT_GATEWAY_METRICS_PORT,
  AGENT_GATEWAY_REPLICAS,
  AGENT_GATEWAY_TERMINATION_GRACE_PERIOD_SECONDS,
  AGENT_GATEWAY_TRACE_ENDPOINT,
} from "./agent-gateway";
import { HELM_CHARTS } from "../helm-charts";
import { PostgreSQLImplementation, PostgreSQLModule } from "../modules/postgres";

const { mock } = require("bun:test");

mock.module("../providers/agent-gateway", () => ({
  AgentGatewayConfigResourceSet: class extends pulumi.CustomResource {
    constructor(name: string, args: pulumi.Inputs, opts?: pulumi.CustomResourceOptions) {
      super("pulumi-nodejs:dynamic/agent-gateway:ConfigResourceSet", name, args, opts);
    }
  },
}));

const defaultRoutes = {
  "/v1/responses": "Responses",
  "/v1/chat/completions": "Completions",
  "/v1/models": "Models",
  "*": "Passthrough",
};
const messagesRoutes = {
  "/v1/messages": "Messages",
  "/v1/models": "Models",
  "*": "Passthrough",
};
const embeddingRoutes = {
  "/v1/embeddings": "Embeddings",
  "/v1/models": "Models",
  "*": "Passthrough",
};
const chutesAliases = {
  "chutes/moonshotai/Kimi-K2-Instruct-0905": "moonshotai/Kimi-K2-Instruct-0905",
  "chutes/moonshotai/Kimi-K2-Thinking-TEE": "moonshotai/Kimi-K2-Thinking-TEE",
  "chutes/moonshotai/Kimi-K2.5-TEE": "moonshotai/Kimi-K2.5-TEE",
  "chutes/Qwen/Qwen3-235B-A22B-Instruct-2507-TEE": "Qwen/Qwen3-235B-A22B-Instruct-2507-TEE",
  "chutes/Qwen/Qwen3-Coder-Next-TEE": "Qwen/Qwen3-Coder-Next-TEE",
  "chutes/zai-org/GLM-5-TEE": "zai-org/GLM-5-TEE",
  "chutes/Qwen/Qwen3.5-397B-A17B-TEE": "Qwen/Qwen3.5-397B-A17B-TEE",
};
const cerebrasAliases = { "cerebras/zai-org/zai-glm-4.7": "zai-glm-4.7" };
const embeddingAliases = { "local-embedding": "Qwen/Qwen3-Embedding-0.6B" };
const smallAliases = { "local-small": "qwen3.8-27b" };
const fastAliases = { "local-fast": "qwen3.6-35b-a3b" };

const providers: AgentGatewayProviderConfig[] = [
  provider("openai", { openai: {} }, prefix("openai/"), "OPENAI_API_KEY"),
  provider("anthropic", { anthropic: {} }, prefix("anthropic/", messagesRoutes), "ANTHROPIC_API_KEY"),
  provider("claude", { host: "claude-proxy.claude-proxy.svc.cluster.local", port: 8080, anthropic: {} }, prefix("claude/", messagesRoutes)),
  provider("chutes", { host: "llm.chutes.ai", port: 443, openai: {} }, aliases(chutesAliases, "llm.chutes.ai"), "CHUTES_API_KEY"),
  provider("codex", { host: "codex-proxy.codex-proxy.svc.cluster.local", port: 8080, openai: {} }, prefix("codex/")),
  provider("cerebras", { host: "api.cerebras.ai", port: 443, openai: {} }, aliases(cerebrasAliases, "api.cerebras.ai"), "CEREBRAS_API_KEY"),
  provider("bifrost", { host: "gateway.skysquid.net", port: 443, openai: {} }, prefix("bifrost/", {
    "/openai/v1/chat/completions": "Completions",
    "*": "Passthrough",
  }, "gateway.skysquid.net")),
  provider("vllm-local-embedding", { host: "qwen3-embedding.vllm.svc.cluster.local", port: 8000, openai: {} }, aliases(embeddingAliases, undefined, embeddingRoutes)),
  provider("llama-cpp-local-small", { host: "qwen3-8-27b-llama-cpp.llama-cpp.svc.cluster.local", port: 8000, openai: {} }, aliases(smallAliases)),
  provider("llama-cpp-vulkan", { host: "vulkan.holdenitdown.net", port: 8000, openai: {} }, aliases(fastAliases)),
];

describe("Agent Gateway config", () => {
  it("separates bootstrap config from database-owned route records", () => {
    const config = generateAgentGatewayBootstrapConfig(
      providers,
      "database",
      "routes",
      ["/v1/audio/transcriptions", "/v1/audio/speech"],
      "600s"
    );
    const resources = generateAgentGatewayRouteResources(providers, "database", "routes", "600s");
    const routes = Object.fromEntries(resources.map((resource) => [resource.id, resource.value])) as Record<string, any>;

    assert.deepEqual(resources.map(({ id }) => id), providers.map((providerConfig) => providerConfig.name));
    assert.equal(resources.length, 10);
    assert.ok(!("routes" in config));
    assert.ok(!("database" in config.config));
    assert.equal(config.gateways.default.port, AGENT_GATEWAY_PORT);
    assert.equal(config.config.statsAddr, `0.0.0.0:${AGENT_GATEWAY_METRICS_PORT}`);
    assert.equal(config.config.readinessAddr, `0.0.0.0:${AGENT_GATEWAY_HEALTH_PORT}`);
    assert.equal(config.config.adminAddr, "127.0.0.1:15000");
    assert.equal(config.config.connectionTerminationDeadline, AGENT_GATEWAY_CONNECTION_TERMINATION_DEADLINE);
    assert.equal(config.config.tracing.otlpEndpoint, AGENT_GATEWAY_TRACE_ENDPOINT);
    assert.equal(config.config.tracing.path, "/v1/traces");
    assert.deepEqual(config.ui.gateways, ["default"]);
    assert.ok(config.gateways.default.transformations.conditional[0].condition.includes('/v1/audio/transcriptions'));
    assert.ok(config.gateways.default.transformations.conditional[0].condition.includes('/v1/audio/speech'));
    assert.ok(Object.values(routes).every((route) => route.policies.timeout.requestTimeout === "600s"));

    assertPrefix(routes.openai, "openai/");
    assertPrefix(routes.anthropic, "anthropic/");
    assertPrefix(routes.claude, "claude/");
    assertPrefix(routes.codex, "codex/");
    assertPrefix(routes.bifrost, "bifrost/");
    assertAliases(routes.chutes, chutesAliases);
    assertAliases(routes.cerebras, cerebrasAliases);
    assertAliases(routes["vllm-local-embedding"], embeddingAliases);
    assertAliases(routes["llama-cpp-local-small"], smallAliases);
    assertAliases(routes["llama-cpp-vulkan"], fastAliases);
    assert.equal(routes.bifrost.backends[0].policies.ai.routes["/openai/v1/chat/completions"], "completions");
    assert.deepEqual(routes.openai.backends[0].policies.ai.routes, normalizeRoutes(defaultRoutes));
    assert.deepEqual(routes.anthropic.backends[0].policies.ai.routes, normalizeRoutes(messagesRoutes));
    assert.deepEqual(routes.claude.backends[0].policies.ai.routes, normalizeRoutes(messagesRoutes));
    assert.deepEqual(routes.codex.backends[0].policies.ai.routes, normalizeRoutes(defaultRoutes));
    assert.deepEqual(routes["vllm-local-embedding"].backends[0].policies.ai.routes, normalizeRoutes(embeddingRoutes));
    assert.equal(routes.chutes.backends[0].policies.backendTLS?.hostname, "llm.chutes.ai");
    assert.equal(routes.claude.backends[0].ai.hostOverride, "claude-proxy.claude-proxy.svc.cluster.local:8080");
    assert.equal(routes.codex.backends[0].ai.hostOverride, "codex-proxy.codex-proxy.svc.cluster.local:8080");
    assert.equal(routes.chutes.backends[0].ai.hostOverride, "llm.chutes.ai:443");
    assert.equal(routes.cerebras.backends[0].ai.hostOverride, "api.cerebras.ai:443");
    assert.equal(routes.bifrost.backends[0].ai.hostOverride, "gateway.skysquid.net:443");
    assert.equal(routes["vllm-local-embedding"].backends[0].ai.hostOverride, "qwen3-embedding.vllm.svc.cluster.local:8000");
    assert.equal(routes["llama-cpp-local-small"].backends[0].ai.hostOverride, "qwen3-8-27b-llama-cpp.llama-cpp.svc.cluster.local:8000");
    assert.equal(routes["llama-cpp-vulkan"].backends[0].ai.hostOverride, "vulkan.holdenitdown.net:8000");
    assert.equal(routes.cerebras.backends[0].policies.backendTLS?.hostname, "api.cerebras.ai");
    assert.equal(routes.bifrost.backends[0].policies.backendTLS?.hostname, "gateway.skysquid.net");
    assert.deepEqual(
      Object.values(routes).filter((route) => route.backends[0].policies.backendAuth).map((route) => route.name),
      ["openai", "anthropic", "chutes", "cerebras"]
    );
    assert.ok(!JSON.stringify(resources).includes("synthetic-secret-value"));
    assert.ok(JSON.stringify(resources).includes("$OPENAI_API_KEY"));
  });

  it("generates reversible route-storage ownership states", () => {
    assert.equal(parseAgentGatewayRouteStorageMode("file"), "file");
    assert.equal(parseAgentGatewayRouteStorageMode("prepare-database"), "prepare-database");
    assert.equal(parseAgentGatewayRouteStorageMode("database"), "database");
    assert.equal(parseAgentGatewayRouteStorageMode("prepare-file"), "prepare-file");
    assert.throws(
      () => parseAgentGatewayRouteStorageMode("invalid"),
      /Invalid Agent Gateway route storage mode: invalid/
    );

    const fileConfig = generateAgentGatewayBootstrapConfig(providers, "file", "routes");
    const prepareDatabaseConfig = generateAgentGatewayBootstrapConfig(providers, "prepare-database", "routes");
    const databaseConfig = generateAgentGatewayBootstrapConfig(providers, "database", "routes");
    const prepareFileConfig = generateAgentGatewayBootstrapConfig(providers, "prepare-file", "routes");
    const fileResources = generateAgentGatewayRouteResources(providers, "file", "routes");
    const prepareDatabaseResources = generateAgentGatewayRouteResources(providers, "prepare-database", "routes");
    const databaseResources = generateAgentGatewayRouteResources(providers, "database", "routes");
    const prepareFileResources = generateAgentGatewayRouteResources(providers, "prepare-file", "routes");

    assert.deepEqual(fileConfig.routes?.map(({ name }) => name), providers.map(({ name }) => name));
    assert.deepEqual(prepareDatabaseConfig.routes, fileConfig.routes);
    assert.ok(!("routes" in databaseConfig));
    assert.ok(!("routes" in prepareFileConfig));
    assert.deepEqual(fileResources, []);
    assert.deepEqual(
      prepareDatabaseResources.map(({ id }) => id),
      providers.map(({ name }) => `${AGENT_GATEWAY_MIGRATION_ROUTE_PREFIX}${name}`)
    );
    assert.deepEqual(prepareFileResources, prepareDatabaseResources);
    assert.deepEqual(databaseResources.map(({ id }) => id), providers.map(({ name }) => name));
    for (let index = 0; index < databaseResources.length; index += 1) {
      const temporary = prepareDatabaseResources[index] as { id: string; value: Record<string, unknown> };
      const final = databaseResources[index] as { id: string; value: Record<string, unknown> };
      assert.equal((temporary.value as { name: string }).name, temporary.id);
      assert.deepEqual({ ...temporary.value, name: final.id }, final.value);
    }
  });

  it("accepts retained credentials and rejects newly empty Stash outputs", () => {
    assert.equal(
      validateResolvedProviderCredential("retained-provider-credential", "OPENAI_API_KEY"),
      "retained-provider-credential"
    );
    assert.throws(
      () => validateResolvedProviderCredential("", "OPENAI_API_KEY"),
      /Resolved provider credential Stash output is empty for OPENAI_API_KEY/
    );
    assert.throws(
      () => validateResolvedProviderCredential(" \t\n", "ANTHROPIC_API_KEY"),
      /Resolved provider credential Stash output is empty for ANTHROPIC_API_KEY/
    );
  });

  it("generates first-class provider and model migration states", () => {
    for (const mode of ["routes", "prepare-first-class", "first-class", "prepare-routes"] as const) {
      assert.equal(parseAgentGatewayRoutingRepresentationMode(mode), mode);
    }
    assert.throws(
      () => parseAgentGatewayRoutingRepresentationMode("invalid"),
      /Invalid Agent Gateway routing representation mode: invalid/
    );
    assert.doesNotThrow(() => validateAgentGatewayRoutingModes("database", "prepare-first-class"));
    assert.throws(
      () => validateAgentGatewayRoutingModes("prepare-database", "prepare-first-class"),
      /prepare-first-class requires Agent Gateway route storage mode database/
    );

    const providerResources = generateAgentGatewayProviderResources(providers);
    const modelResources = generateAgentGatewayModelResources(providers);
    const expectedProviderIds = [
      "openai", "anthropic", "claude", "chutes", "codex", "cerebras",
      "vllm-local-embedding", "llama-cpp-local-small", "llama-cpp-vulkan",
    ];
    const expectedModelIds = [
      "openai/*", "anthropic/*", "claude/*",
      ...Object.keys(chutesAliases),
      "codex/*", ...Object.keys(cerebrasAliases),
      "local-embedding", "local-small", "local-fast",
    ];
    assert.deepEqual(providerResources.map(({ id }) => id), expectedProviderIds);
    assert.deepEqual(modelResources.map(({ id }) => id), expectedModelIds);
    assert.equal(providerResources.length, 9);
    assert.equal(modelResources.length, 15);

    const providerValues = Object.fromEntries(
      providerResources.map(({ id, value }) => [id, value])
    ) as Record<string, any>;
    assert.equal(providerValues.openai.provider, "openAI");
    assert.equal(providerValues.openai.params.apiKey, "$OPENAI_API_KEY");
    assert.equal(providerValues.anthropic.provider, "anthropic");
    assert.equal(providerValues.anthropic.params.apiKey, "$ANTHROPIC_API_KEY");
    assert.equal(providerValues.claude.params.baseUrl, "http://claude-proxy.claude-proxy.svc.cluster.local:8080");
    assert.equal(providerValues.chutes.params.baseUrl, "https://llm.chutes.ai:443");
    assert.equal(providerValues.chutes.defaults.tls.hostname, "llm.chutes.ai");
    assert.equal(providerValues.codex.params.baseUrl, "http://codex-proxy.codex-proxy.svc.cluster.local:8080");
    assert.equal(providerValues.cerebras.params.apiKey, "$CEREBRAS_API_KEY");
    assert.equal(providerValues.cerebras.params.baseUrl, "https://api.cerebras.ai:443");
    assert.equal(providerValues.cerebras.defaults.tls.hostname, "api.cerebras.ai");
    assert.equal(providerValues["vllm-local-embedding"].params.baseUrl, "http://qwen3-embedding.vllm.svc.cluster.local:8000");
    assert.equal(providerValues["llama-cpp-local-small"].params.baseUrl, "http://qwen3-8-27b-llama-cpp.llama-cpp.svc.cluster.local:8000");
    assert.equal(providerValues["llama-cpp-vulkan"].params.baseUrl, "http://vulkan.holdenitdown.net:8000");
    assert.equal(
      providerValues.codex.defaults.transformation.model,
      'llmRequest.model.stripPrefix("codex/")'
    );
    assert.ok(!("bifrost" in providerValues));
    assert.deepEqual(
      Object.fromEntries(expectedProviderIds.flatMap((id) =>
        providerValues[id].params?.apiKey ? [[id, providerValues[id].params.apiKey]] : []
      )),
      {
        openai: "$OPENAI_API_KEY",
        anthropic: "$ANTHROPIC_API_KEY",
        chutes: "$CHUTES_API_KEY",
        cerebras: "$CEREBRAS_API_KEY",
      }
    );

    const modelValues = Object.fromEntries(
      modelResources.map(({ id, value }) => [id, value])
    ) as Record<string, any>;
    assert.deepEqual(modelValues["openai/*"].provider, { reference: "openai" });
    assert.deepEqual(
      Object.fromEntries(Object.keys(chutesAliases).map((id) => [id, modelValues[id].params.model])),
      chutesAliases
    );
    assert.equal(modelValues["cerebras/zai-org/zai-glm-4.7"].params.model, "zai-glm-4.7");
    assert.equal(modelValues["local-embedding"].params.model, "Qwen/Qwen3-Embedding-0.6B");
    assert.ok(modelResources.every(({ id, value }: any) => value.id === id && value.name === id));
    assert.ok(!JSON.stringify([providerResources, modelResources]).includes("synthetic-secret-value"));

    const routes = generateAgentGatewayRouteResources(providers, "database", "routes");
    const preparing = generateAgentGatewayRouteResources(providers, "database", "prepare-first-class");
    const active = generateAgentGatewayRouteResources(providers, "database", "first-class");
    const reversing = generateAgentGatewayRouteResources(providers, "database", "prepare-routes");
    assert.deepEqual(preparing, routes);
    assert.deepEqual(reversing, routes);
    assert.deepEqual(active, [routes.find(({ id }) => id === "bifrost")]);

    const bootstrap = generateAgentGatewayBootstrapConfig(providers, "database", "first-class", [], "615s");
    assert.deepEqual(bootstrap.llm, { gateways: ["default"], models: [] });
    assert.deepEqual(bootstrap.policies, [{
      name: { namespace: "internal", name: "llm-request-timeout" },
      target: { route: { namespace: "internal", name: "llm:request" } },
      policy: { timeout: { requestTimeout: "615s" } },
    }]);
    assert.ok(!("llm" in generateAgentGatewayBootstrapConfig(providers, "database", "routes")));
  });

  it("pins the standalone chart and production Gateway parent", () => {
    assert.deepEqual(HELM_CHARTS.AGENTGATEWAY_STANDALONE, {
      chart: "oci://cr.agentgateway.dev/charts/agentgateway-standalone",
      version: "v1.5.0",
    });
    assert.equal(AGENT_GATEWAY_NAME, "default-gateway");
    assert.equal(AGENT_GATEWAY_NAMESPACE, "ingress");
  });

  it("normalizes chart labels and matching selectors", () => {
    const workloadLabels = {
      "app.kubernetes.io/name": "agent-gateway",
      "app.kubernetes.io/instance": "agent-gateway",
      "app.kubernetes.io/component": "llm-gateway",
      "app.kubernetes.io/part-of": "agent-gateway",
      "app.kubernetes.io/managed-by": "pulumi",
      "rholden.dev/workload-layer": "application",
    };
    const transformed = applyAgentGatewayChartResource(
      "kubernetes:apps/v1:Deployment",
      {
        metadata: {
          name: "agentgateway-standalone",
          labels: { "helm.sh/chart": "agentgateway-standalone-v1.5.0" },
          annotations: {
            "example.com/identity": "agent-gateway-standalone",
            "example.com/component": "standalone",
          },
        },
        spec: {
          selector: { matchLabels: { "app.kubernetes.io/component": "standalone" } },
          template: {
            metadata: {
              labels: { "app.kubernetes.io/name": "agentgateway-standalone" },
              annotations: { "example.com/identity": "agentgateway-standalone" },
            },
            spec: {
              serviceAccountName: "agentgateway-standalone",
              containers: [{
                name: "agentgateway-standalone",
                volumeMounts: [{ name: "agentgateway-standalone-config", mountPath: "/config" }],
                env: [{
                  name: "UPSTREAM_IDENTITY",
                  value: "agentgateway-standalone",
                }, {
                  name: "SECRET_VALUE",
                  valueFrom: { secretKeyRef: { name: "agent-gateway-standalone-env", key: "value" } },
                }],
              }],
              volumes: [{
                name: "agentgateway-standalone-config",
                configMap: { name: "agentgateway-standalone-config" },
              }],
            },
          },
        },
      },
      workloadLabels
    );
    assert.equal(transformed.spec.template.spec.terminationGracePeriodSeconds, AGENT_GATEWAY_TERMINATION_GRACE_PERIOD_SECONDS);
    assert.equal(transformed.metadata.labels["helm.sh/chart"], "agent-gateway-v1.5.0");
    assert.equal(transformed.metadata.labels["app.kubernetes.io/managed-by"], "pulumi");
    assert.equal(transformed.metadata.name, "agent-gateway");
    assert.equal(transformed.metadata.annotations["example.com/identity"], "agent-gateway");
    assert.equal(transformed.metadata.annotations["example.com/component"], "llm-gateway");
    assert.deepEqual(transformed.spec.selector.matchLabels, {
      "app.kubernetes.io/name": "agent-gateway",
      "app.kubernetes.io/instance": "agent-gateway",
      "app.kubernetes.io/component": "llm-gateway",
    });
    assert.deepEqual(transformed.spec.template.metadata.labels, workloadLabels);
    assert.equal(
      transformed.spec.template.metadata.annotations["example.com/identity"],
      "agent-gateway"
    );
    assert.equal(transformed.spec.template.spec.serviceAccountName, "agent-gateway");
    assert.equal(transformed.spec.template.spec.containers[0].name, "agent-gateway");
    assert.equal(transformed.spec.template.spec.containers[0].volumeMounts[0].name, "agent-gateway-config");
    assert.equal(transformed.spec.template.spec.volumes[0].name, "agent-gateway-config");
    assert.equal(transformed.spec.template.spec.volumes[0].configMap.name, "agent-gateway-config");
    assert.equal(
      transformed.spec.template.spec.containers[0].env[1].valueFrom.secretKeyRef.name,
      "agent-gateway-env"
    );
    assert.equal(
      transformed.spec.template.spec.containers[0].env[0].value,
      "agentgateway-standalone"
    );
    assert.equal(AGENT_GATEWAY_REPLICAS, 2);

    const service = applyAgentGatewayChartResource(
      "kubernetes:core/v1:Service",
      {
        metadata: { labels: { "app.kubernetes.io/name": "agentgateway-standalone" } },
        spec: { selector: { "app.kubernetes.io/component": "standalone" } },
      },
      workloadLabels
    );
    assert.deepEqual(service.spec.selector, transformed.spec.selector.matchLabels);
    assert.ok(!JSON.stringify(service).includes("standalone"));

    const configMap = applyAgentGatewayChartResource(
      "kubernetes:core/v1:ConfigMap",
      {
        metadata: { name: "agentgateway-standalone-config" },
        data: { "config.yaml": "provider: agentgateway-standalone\nmode: standalone\n" },
      },
      workloadLabels
    );
    assert.equal(configMap.metadata.name, "agent-gateway-config");
    assert.equal(configMap.metadata.annotations["pulumi.com/patchForce"], "true");
    assert.equal(
      configMap.data["config.yaml"],
      "provider: agentgateway-standalone\nmode: standalone\n"
    );

    const references = applyAgentGatewayChartResource(
      "kubernetes:example.dev/v1:Example",
      {
        metadata: { name: "agent-gateway-standalone-references" },
        spec: {
          parentRefs: [{ name: "agentgateway-standalone" }],
          backendRefs: [{ name: "agent-gateway-standalone" }],
          targetRefs: [{ name: "standalone" }],
          provider: { name: "agentgateway-standalone" },
        },
      },
      workloadLabels
    );
    assert.deepEqual(references.spec.parentRefs, [{ name: "agent-gateway" }]);
    assert.deepEqual(references.spec.backendRefs, [{ name: "agent-gateway" }]);
    assert.deepEqual(references.spec.targetRefs, [{ name: "agent-gateway" }]);
    assert.equal(references.spec.provider.name, "agentgateway-standalone");
  });

  it("bootstraps the CloudNativePG database and owner", () => {
    const transformed = applyAgentGatewayDatabaseBootstrap(
      CLOUD_NATIVE_PG_CLUSTER_RESOURCE_TOKEN,
      { kind: "Cluster", spec: { instances: 1 } },
      {
        "app.kubernetes.io/name": "agent-gateway-postgres",
        "rholden.dev/workload-layer": "data",
      }
    );
    assert.deepEqual(transformed.spec.bootstrap.initdb, {
      database: "agentgateway",
      owner: "agentgateway",
    });
    assert.equal(transformed.spec.instances, 1);
    assert.deepEqual(transformed.spec.inheritedMetadata.labels, {
      "app.kubernetes.io/name": "agent-gateway-postgres",
      "rholden.dev/workload-layer": "data",
    });
    const unrelated = { kind: "Service", spec: { ports: [] } };
    assert.equal(
      applyAgentGatewayDatabaseBootstrap("kubernetes:core/v1:Service", unrelated),
      unrelated
    );
  });

  it("registers the database, chart, route, and outputs", async () => {
    const resources: pulumi.runtime.MockResourceArgs[] = [];
    const labels = {
      "app.kubernetes.io/name": "agent-gateway-postgres",
      "rholden.dev/workload-layer": "data",
    };
    pulumi.runtime.setMocks({
      newResource: (args: pulumi.runtime.MockResourceArgs) => {
        resources.push(args);
        return {
          id: args.id ?? `${args.name}-id`,
          state: args.type === "kubernetes:core/v1:Secret"
            ? {
                ...args.inputs,
                data: {
                  username: Buffer.from("agentgateway").toString("base64"),
                  password: Buffer.from("synthetic").toString("base64"),
                  dbname: Buffer.from("agentgateway").toString("base64"),
                },
              }
            : args.inputs,
        };
      },
      call: (args: pulumi.runtime.MockCallArgs) => args.inputs,
    }, "agent-gateway-test", "test", false);

    await pulumi.runtime.runInPulumiStack(async () => {
      const database = new PostgreSQLModule("agent-gateway-postgres", {
        namespace: "agentgateway-system",
        workloadLabels: labels,
        implementation: PostgreSQLImplementation.CLOUDNATIVE_PG,
        instances: 1,
        storage: { size: "10Gi" },
      }, {
        transformations: [(resourceArgs) => {
          const props = applyAgentGatewayDatabaseBootstrap(
            resourceArgs.type,
            resourceArgs.props,
            labels
          );
          return props === resourceArgs.props
            ? undefined
            : { props, opts: resourceArgs.opts };
        }],
      });
      assert.ok("cluster" in database.instance);
      await (database.instance.cluster.id as unknown as { promise(): Promise<string> }).promise();

      const gateway = new AgentGateway("agent-gateway", {
        namespace: "agentgateway-system",
        workloadLabels: {
          "app.kubernetes.io/name": "agent-gateway",
          "rholden.dev/workload-layer": "application",
        },
        hostname: "agent-gateway.holdenitdown.net",
        providers,
        databaseUrl: pulumi.secret("postgresql://agentgateway:$DATABASE_PASSWORD@postgres:5432/agentgateway"),
        routeStorageMode: "prepare-database",
        routingRepresentationMode: "routes",
        modelExtractionExclusionPaths: [
          "/v1/audio/transcriptions",
          "/v1/audio/speech",
        ],
      });
      await (gateway.httpRoute.id as unknown as { promise(): Promise<string> }).promise();
      assert.ok(gateway.routeResources);
      await (gateway.routeResources.id as unknown as { promise(): Promise<string> }).promise();

      const fileGateway = new AgentGateway("agent-gateway-file", {
        namespace: "agentgateway-system",
        hostname: "agent-gateway.holdenitdown.net",
        providers,
        databaseUrl: pulumi.secret("postgresql://agentgateway:$DATABASE_PASSWORD@postgres:5432/agentgateway"),
        routeStorageMode: "file",
        routingRepresentationMode: "routes",
      });
      await (fileGateway.httpRoute.id as unknown as { promise(): Promise<string> }).promise();
      assert.equal(fileGateway.routeResources, undefined);

      const databaseGateway = new AgentGateway("agent-gateway-database", {
        namespace: "agentgateway-system",
        hostname: "agent-gateway.holdenitdown.net",
        providers,
        databaseUrl: pulumi.secret("postgresql://agentgateway:$DATABASE_PASSWORD@postgres:5432/agentgateway"),
        routeStorageMode: "database",
        routingRepresentationMode: "routes",
      });
      assert.ok(databaseGateway.routeResources);
      await (databaseGateway.routeResources.id as unknown as { promise(): Promise<string> }).promise();

      const prepareFileGateway = new AgentGateway("agent-gateway-prepare-file", {
        namespace: "agentgateway-system",
        hostname: "agent-gateway.holdenitdown.net",
        providers,
        databaseUrl: pulumi.secret("postgresql://agentgateway:$DATABASE_PASSWORD@postgres:5432/agentgateway"),
        routeStorageMode: "prepare-file",
        routingRepresentationMode: "routes",
      });
      assert.ok(prepareFileGateway.routeResources);
      await (prepareFileGateway.routeResources.id as unknown as { promise(): Promise<string> }).promise();

      const firstClassGateway = new AgentGateway("agent-gateway-first-class", {
        namespace: "agentgateway-system",
        hostname: "agent-gateway.holdenitdown.net",
        providers,
        databaseUrl: pulumi.secret("postgresql://agentgateway:$DATABASE_PASSWORD@postgres:5432/agentgateway"),
        routeStorageMode: "database",
        routingRepresentationMode: "prepare-first-class",
      });
      assert.ok(firstClassGateway.providerResources);
      assert.ok(firstClassGateway.modelResources);
      assert.ok(firstClassGateway.routeResources);
      await (firstClassGateway.routeResources.id as unknown as { promise(): Promise<string> }).promise();

      const activeFirstClassGateway = new AgentGateway("agent-gateway-active-first-class", {
        namespace: "agentgateway-system",
        hostname: "agent-gateway.holdenitdown.net",
        providers,
        databaseUrl: pulumi.secret("postgresql://agentgateway:$DATABASE_PASSWORD@postgres:5432/agentgateway"),
        routeStorageMode: "database",
        routingRepresentationMode: "first-class",
      });
      assert.ok(activeFirstClassGateway.routeResources);
      await (activeFirstClassGateway.routeResources.id as unknown as { promise(): Promise<string> }).promise();

      const prepareRoutesGateway = new AgentGateway("agent-gateway-prepare-routes", {
        namespace: "agentgateway-system",
        hostname: "agent-gateway.holdenitdown.net",
        providers,
        databaseUrl: pulumi.secret("postgresql://agentgateway:$DATABASE_PASSWORD@postgres:5432/agentgateway"),
        routeStorageMode: "database",
        routingRepresentationMode: "prepare-routes",
      });
      assert.ok(prepareRoutesGateway.routeResources);
      await (prepareRoutesGateway.routeResources.id as unknown as { promise(): Promise<string> }).promise();
      const remainder = getDatabaseUrlRemainder(
        pulumi.secret("postgresql://agentgateway:$DATABASE_PASSWORD@postgres:5432/agentgateway")
      );
      assert.equal(
        await (remainder as unknown as { promise(): Promise<string> }).promise(),
        "agentgateway:$DATABASE_PASSWORD@postgres:5432/agentgateway"
      );
      assert.equal(await pulumi.isSecret(remainder), true);
      assert.equal(
        await (gateway.gatewayName as unknown as { promise(): Promise<string> }).promise(),
        "default-gateway"
      );
      assert.equal(
        await (gateway.gatewayNamespace as unknown as { promise(): Promise<string> }).promise(),
        "ingress"
      );
      assert.deepEqual(gateway.backendNames, providers.map((providerConfig) => providerConfig.name));
      assert.equal(
        await (gateway.getHttpRouteUrl() as unknown as { promise(): Promise<string> }).promise(),
        "https://agent-gateway.holdenitdown.net"
      );
      assert.equal(
        await (gateway.getAdminUiUrl() as unknown as { promise(): Promise<string> }).promise(),
        "https://agent-gateway.holdenitdown.net/ui/"
      );
    });

    const cluster = resources.find((resource) => resource.type === CLOUD_NATIVE_PG_CLUSTER_RESOURCE_TOKEN);
    assert.ok(cluster);
    assert.deepEqual(cluster.inputs.spec.bootstrap.initdb, {
      database: "agentgateway",
      owner: "agentgateway",
    });
    assert.deepEqual(cluster.inputs.spec.inheritedMetadata.labels, labels);
    assert.equal(cluster.inputs.spec.instances, 1);
    assert.deepEqual(cluster.inputs.spec.storage, { size: "10Gi" });

    const chart = resources.find((resource) =>
      resource.type === "kubernetes:helm.sh/v4:Chart" && resource.name === "agent-gateway-chart"
    );
    assert.ok(chart);
    assert.equal(chart.inputs.chart, HELM_CHARTS.AGENTGATEWAY_STANDALONE.chart);
    assert.equal(chart.inputs.version, HELM_CHARTS.AGENTGATEWAY_STANDALONE.version);
    assert.equal(chart.inputs.name, "agent-gateway");
    assert.equal(chart.inputs.values.fullnameOverride, "agent-gateway");
    assert.equal(chart.inputs.values.mode, "database");
    assert.equal(chart.inputs.values.database.postgres.url, "postgresql://$DATABASE_URL_REMAINDER");
    assert.equal(chart.inputs.values.config.routes.length, 10);
    assert.ok(!("database" in chart.inputs.values.config.config));
    assert.equal(chart.inputs.values.replicaCount, 2);
    assert.equal(chart.inputs.values.gateway.service.type, "ClusterIP");
    assert.equal(chart.inputs.values.gateway.service.ports[0].port, 4000);
    assert.equal(chart.inputs.values.podAnnotations["k8s.grafana.com/instance"], "agent-gateway");

    const component = resources.find((resource) => resource.name === "agent-gateway" &&
      resource.type === "homelab:components:AgentGateway");
    assert.ok(component);

    const secret = resources.find((resource) => resource.type === "kubernetes:core/v1:Secret" &&
      resource.name === "agent-gateway-env");
    assert.ok(secret);
    assert.equal(secret.inputs.metadata.name, "agent-gateway-env");
    const secretStringData = secret.inputs.stringData.value ?? secret.inputs.stringData;
    assert.ok("DATABASE_URL_REMAINDER" in secretStringData);
    assert.ok(!("DATABASE_URL" in secretStringData));

    const pdb = resources.find((resource) =>
      resource.type === "kubernetes:policy/v1:PodDisruptionBudget"
    );
    assert.ok(pdb);
    assert.equal(pdb.name, "agent-gateway-pdb");
    assert.equal(pdb.inputs.metadata.name, "agent-gateway");
    assert.equal(pdb.inputs.spec.maxUnavailable, 1);
    assert.deepEqual(pdb.inputs.spec.selector.matchLabels, {
      "app.kubernetes.io/name": "agent-gateway",
      "app.kubernetes.io/instance": "agent-gateway",
      "app.kubernetes.io/component": "llm-gateway",
    });

    const route = resources.find((resource) =>
      resource.type === "kubernetes:gateway.networking.k8s.io/v1:HTTPRoute"
    );
    assert.ok(route);
    assert.equal(route.name, "agent-gateway-httproute");
    assert.equal(route.inputs.metadata.name, "agent-gateway");
    assert.deepEqual(route.inputs.spec.hostnames, ["agent-gateway.holdenitdown.net"]);
    assert.deepEqual(route.inputs.spec.parentRefs, [{
      group: "gateway.networking.k8s.io",
      kind: "Gateway",
      name: "default-gateway",
      namespace: "ingress",
    }]);
    assert.equal(route.inputs.spec.rules[0].timeouts.request, "600s");
    assert.equal(
      route.inputs.metadata.annotations[EXTERNAL_DNS_HOSTNAME_ANNOTATION],
      "agent-gateway.holdenitdown.net"
    );

    const routeResourceSet = resources.find((resource) => resource.name === "agent-gateway-routes");
    assert.ok(routeResourceSet);
    assert.equal(routeResourceSet.inputs.endpoint, "https://agent-gateway.holdenitdown.net");
    assert.equal(routeResourceSet.inputs.kind, "traffic.route");
    assert.deepEqual(
      routeResourceSet.inputs.resources.map(({ id }: { id: string }) => id),
      providers.map((providerConfig) => `${AGENT_GATEWAY_MIGRATION_ROUTE_PREFIX}${providerConfig.name}`)
    );
    assert.ok(routeResourceSet.inputs.resources.every(
      ({ id, value }: { id: string; value: { name: string } }) => value.name === id
    ));
    assert.ok(!JSON.stringify(routeResourceSet.inputs.resources).includes("synthetic-secret-value"));

    const fileChart = resources.find((resource) => resource.name === "agent-gateway-file-chart");
    assert.ok(fileChart);
    assert.equal(fileChart.inputs.values.mode, "readonly");
    assert.equal(fileChart.inputs.values.config.routes.length, 10);
    assert.ok(!("database" in fileChart.inputs.values));
    assert.ok(!resources.some((resource) => resource.name === "agent-gateway-file-routes"));

    const databaseChart = resources.find((resource) => resource.name === "agent-gateway-database-chart");
    assert.ok(databaseChart);
    assert.equal(databaseChart.inputs.values.mode, "database");
    assert.ok(!("routes" in databaseChart.inputs.values.config));
    const databaseRouteSet = resources.find((resource) => resource.name === "agent-gateway-database-routes");
    assert.ok(databaseRouteSet);
    assert.deepEqual(
      databaseRouteSet.inputs.resources.map(({ id }: { id: string }) => id),
      providers.map(({ name }) => name)
    );

    const prepareFileChart = resources.find((resource) => resource.name === "agent-gateway-prepare-file-chart");
    assert.ok(prepareFileChart);
    assert.equal(prepareFileChart.inputs.values.mode, "database");
    assert.ok(!("routes" in prepareFileChart.inputs.values.config));
    const prepareFileRouteSet = resources.find((resource) => resource.name === "agent-gateway-prepare-file-routes");
    assert.ok(prepareFileRouteSet);
    assert.deepEqual(
      prepareFileRouteSet.inputs.resources.map(({ id }: { id: string }) => id),
      providers.map(({ name }) => `${AGENT_GATEWAY_MIGRATION_ROUTE_PREFIX}${name}`)
    );

    const firstClassChart = resources.find((resource) => resource.name === "agent-gateway-first-class-chart");
    assert.ok(firstClassChart);
    assert.deepEqual(firstClassChart.inputs.values.config.llm, { gateways: ["default"], models: [] });
    assert.equal(firstClassChart.inputs.values.config.policies[0].policy.timeout.requestTimeout, "600s");
    const firstClassProviders = resources.find((resource) => resource.name === "agent-gateway-first-class-providers");
    const firstClassModels = resources.find((resource) => resource.name === "agent-gateway-first-class-models");
    const firstClassRoutes = resources.find((resource) => resource.name === "agent-gateway-first-class-routes");
    assert.ok(firstClassProviders);
    assert.ok(firstClassModels);
    assert.ok(firstClassRoutes);
    assert.equal(firstClassProviders.inputs.kind, "llm.provider");
    assert.equal(firstClassModels.inputs.kind, "llm.model");
    assert.equal(firstClassRoutes.inputs.kind, "traffic.route");
    assert.equal(firstClassProviders.inputs.resources.length, 9);
    assert.equal(firstClassModels.inputs.resources.length, 15);
    assert.equal(firstClassRoutes.inputs.resources.length, 10);

    const activeFirstClassRoutes = resources.find((resource) =>
      resource.name === "agent-gateway-active-first-class-routes"
    );
    const activeFirstClassProviders = resources.find((resource) =>
      resource.name === "agent-gateway-active-first-class-providers"
    );
    const activeFirstClassModels = resources.find((resource) =>
      resource.name === "agent-gateway-active-first-class-models"
    );
    assert.ok(activeFirstClassRoutes);
    assert.ok(activeFirstClassProviders);
    assert.ok(activeFirstClassModels);
    assert.deepEqual(activeFirstClassRoutes.inputs.resources.map(({ id }: { id: string }) => id), ["bifrost"]);

    const prepareRoutesRoutes = resources.find((resource) => resource.name === "agent-gateway-prepare-routes-routes");
    const prepareRoutesProviders = resources.find((resource) => resource.name === "agent-gateway-prepare-routes-providers");
    const prepareRoutesModels = resources.find((resource) => resource.name === "agent-gateway-prepare-routes-models");
    assert.ok(prepareRoutesRoutes);
    assert.ok(prepareRoutesProviders);
    assert.ok(prepareRoutesModels);
    assert.equal(prepareRoutesRoutes.inputs.resources.length, 10);
    assert.ok(!resources.some((resource) => resource.name === "agent-gateway-database-providers"));
    assert.ok(!resources.some((resource) => resource.name === "agent-gateway-database-models"));

    const programSource = readFileSync("programs/agent-gateway/index.ts", "utf8");
    assert.match(programSource, /new PostgreSQLModule\("agent-gateway-postgres",[\s\S]*?protect: true,/);
    assert.ok(
      programSource.indexOf("parseAgentGatewayRouteStorageMode(config.require")
      < programSource.indexOf("new pulumi.Stash")
    );
    assert.match(
      readFileSync("programs/agent-gateway/Pulumi.pantheon.yaml", "utf8"),
      /agent-gateway:routeStorageMode: database/
    );
    assert.match(
      readFileSync("programs/agent-gateway/Pulumi.pantheon.yaml", "utf8"),
      /agent-gateway:routingRepresentationMode: first-class/
    );
    assert.match(
      readFileSync("src/components/agent-gateway.ts", "utf8"),
      /dependsOn: \[this\.chart, this\.httpRoute, \.\.\.\(this\.modelResources \? \[this\.modelResources\] : \[\]\)\]/
    );
    assert.match(programSource, /input: pulumi\.secret\(process\.env\[provider\.envVar\] \?\? ""\)/);
    assert.match(
      programSource,
      /stash\.output\.apply\(\(value\) => validateResolvedProviderCredential\(value, provider\.envVar!\)\)/
    );
    assert.ok(resources.every((resource) => !resource.name.includes("standalone")));
  });
});

function provider(
  name: string,
  providerConfig: Record<string, unknown>,
  policies: Record<string, unknown>,
  credentialEnvVar?: string
): AgentGatewayProviderConfig {
  return {
    name,
    provider: providerConfig,
    policies,
    credentialEnvVar,
    ...(credentialEnvVar ? { secret: { value: "synthetic-secret-value" } } : {}),
  };
}

function prefix(
  modelPrefix: string,
  routes: Record<string, string> = defaultRoutes,
  sni?: string
): Record<string, unknown> {
  return {
    ...(sni ? { tls: { sni } } : {}),
    ai: { routes, modelPrefix },
  };
}

function aliases(
  modelAliases: Record<string, string>,
  sni?: string,
  routes: Record<string, string> = {
    "/v1/chat/completions": "Completions",
    "/v1/models": "Models",
    "*": "Passthrough",
  }
): Record<string, unknown> {
  return {
    ...(sni ? { tls: { sni } } : {}),
    ai: { routes, modelAliases },
  };
}

function assertPrefix(route: any, prefixValue: string): void {
  assert.ok(route.matches[0].headers[0].value.regex.includes(prefixValue.replace("/", "\\/")) ||
    route.matches[0].headers[0].value.regex.includes(prefixValue));
  assert.equal(route.backends[0].policies.ai.transformations.model, `llmRequest.model.stripPrefix("${prefixValue}")`);
}

function assertAliases(route: any, expected: Record<string, string>): void {
  assert.deepEqual(route.backends[0].policies.ai.modelAliases, expected);
  for (const alias of Object.keys(expected)) assert.ok(route.matches[0].headers[0].value.regex.includes(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

function normalizeRoutes(routes: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(routes).map(([path, route]) => [path, route.charAt(0).toLowerCase() + route.slice(1)]));
}
