import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import {
  AgentGatewayConfigResourceInput,
  AgentGatewayConfigResourceSet,
  JsonValue,
} from "../providers/agent-gateway";
import { WorkloadLabelArgs, WorkloadLabels, withWorkloadLabels } from "../types";

export interface AgentGatewayProviderConfig {
  name: string;
  credentialEnvVar?: string;
  provider: Record<string, unknown>;
  policies?: Record<string, unknown>;
  secret?: {
    value: pulumi.Input<string>;
  };
}

export const EXTERNAL_DNS_HOSTNAME_ANNOTATION = "external-dns.alpha.kubernetes.io/hostname";
export const AGENT_GATEWAY_NAME = "default-gateway";
export const AGENT_GATEWAY_NAMESPACE = "ingress";
export const AGENT_GATEWAY_PORT = 4000;
export const AGENT_GATEWAY_METRICS_PORT = 15020;
export const AGENT_GATEWAY_HEALTH_PORT = 15021;
export const AGENT_GATEWAY_REPLICAS = 2;
export const AGENT_GATEWAY_TERMINATION_GRACE_PERIOD_SECONDS = 660;
export const AGENT_GATEWAY_CONNECTION_TERMINATION_DEADLINE = "600s";
export const AGENT_GATEWAY_TRACE_ENDPOINT = "https://telemetry.holdenitdown.net:4317";
export const AGENT_GATEWAY_MIGRATION_ROUTE_PREFIX = "pulumi-migration-";
export const CLOUD_NATIVE_PG_CLUSTER_RESOURCE_TOKEN = "kubernetes:postgresql.cnpg.io/v1:Cluster";

export type AgentGatewayRouteStorageMode = "file" | "prepare-database" | "database" | "prepare-file";
export type AgentGatewayRoutingRepresentationMode = "routes" | "prepare-first-class" | "first-class" | "prepare-routes";

const AGENT_GATEWAY_SELECTOR_LABELS = {
  "app.kubernetes.io/name": "agent-gateway",
  "app.kubernetes.io/instance": "agent-gateway",
  "app.kubernetes.io/component": "llm-gateway",
};

const KUBERNETES_REFERENCE_VALUE_KEYS = new Set([
  "claimName",
  "configMapName",
  "secretName",
  "serviceAccountName",
  "serviceName",
]);

const KUBERNETES_REFERENCE_NAME_CONTEXTS = new Set([
  "backendRef",
  "backendRefs",
  "certificateRef",
  "certificateRefs",
  "configMap",
  "configMapKeyRef",
  "configMapRef",
  "containers",
  "ephemeralContainers",
  "imagePullSecrets",
  "initContainers",
  "localObjectReference",
  "objectRef",
  "ownerReferences",
  "parentRef",
  "parentRefs",
  "persistentVolumeClaim",
  "scaleTargetRef",
  "secret",
  "secretKeyRef",
  "secretRef",
  "targetRef",
  "targetRefs",
  "volumeMounts",
  "volumes",
]);

type RouteType = "completions" | "messages" | "models" | "passthrough" | "responses" | "embeddings";

interface AgentGatewayProvider {
  name: string;
  host?: string;
  port?: number;
  provider: "openAI" | "anthropic";
  credentialEnvVar?: string;
  routes: Record<string, RouteType>;
  modelAliases?: Record<string, string>;
  modelPrefix?: string;
  tlsHostname?: string;
}

export interface AgentGatewayRoute {
  name: string;
  gateways: string[];
  matches: Array<{
    path: { pathPrefix: string };
    headers: Array<{ name: string; value: { regex: string } }>;
  }>;
  policies: {
    timeout: { requestTimeout: string };
  };
  backends: Array<{
    ai: {
      name: string;
      provider: Record<string, Record<string, never>>;
      hostOverride?: string;
    };
    policies: {
      ai: {
        routes: Record<string, RouteType>;
        modelAliases?: Record<string, string>;
        transformations?: { model: string };
      };
      backendAuth?: { key: { value: string } };
      backendTLS?: { hostname: string };
    };
  }>;
}

export interface AgentGatewayBootstrapConfig {
  config: {
    adminAddr: string;
    statsAddr: string;
    readinessAddr: string;
    connectionTerminationDeadline: string;
    tracing: {
      otlpEndpoint: string;
      otlpProtocol: "grpc";
      path: string;
      clientSampling: boolean;
      randomSampling: boolean;
    };
  };
  gateways: {
    default: {
      port: number;
      transformations: {
        conditional: Array<{
          condition: string;
          request: { set: { "x-model": string } };
        }>;
      };
    };
  };
  routes?: AgentGatewayRoute[];
  llm?: { gateways: string[]; models: [] };
  policies?: Array<{
    name: { namespace: string; name: string };
    target: { route: { namespace: string; name: string } };
    policy: { timeout: { requestTimeout: string } };
  }>;
  ui: { gateways: string[] };
}

export interface AgentGatewayArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
  hostname: pulumi.Input<string>;
  providers: AgentGatewayProviderConfig[];
  databaseUrl: pulumi.Input<string>;
  routeStorageMode: AgentGatewayRouteStorageMode;
  routingRepresentationMode: AgentGatewayRoutingRepresentationMode;
  requestTimeout?: string;
  modelExtractionExclusionPaths?: string[];
}

export function parseAgentGatewayRouteStorageMode(value: string): AgentGatewayRouteStorageMode {
  if (value === "file" || value === "prepare-database" || value === "database" || value === "prepare-file") {
    return value;
  }
  throw new Error(`Invalid Agent Gateway route storage mode: ${value}`);
}

export function validateResolvedProviderCredential(value: string, environmentVariable: string): string {
  if (!value.trim()) {
    throw new Error(`Resolved provider credential Stash output is empty for ${environmentVariable}`);
  }
  return value;
}

export function parseAgentGatewayRoutingRepresentationMode(value: string): AgentGatewayRoutingRepresentationMode {
  if (value === "routes" || value === "prepare-first-class" || value === "first-class" || value === "prepare-routes") {
    return value;
  }
  throw new Error(`Invalid Agent Gateway routing representation mode: ${value}`);
}

export function validateAgentGatewayRoutingModes(
  routeStorageMode: AgentGatewayRouteStorageMode,
  routingRepresentationMode: AgentGatewayRoutingRepresentationMode
): void {
  if (routingRepresentationMode !== "routes" && routeStorageMode !== "database") {
    throw new Error(`${routingRepresentationMode} requires Agent Gateway route storage mode database`);
  }
}

export function generateAgentGatewayBootstrapConfig(
  providers: AgentGatewayProviderConfig[],
  routeStorageMode: AgentGatewayRouteStorageMode,
  routingRepresentationMode: AgentGatewayRoutingRepresentationMode,
  modelExtractionExclusionPaths: string[] = [],
  requestTimeout: string = AGENT_GATEWAY_CONNECTION_TERMINATION_DEADLINE
): AgentGatewayBootstrapConfig {
  const modelExtractionCondition = [
    'request.path != "/"',
    'request.path != "/config_dump"',
    'request.path != "/ui"',
    '!request.path.startsWith("/ui/")',
    'request.path != "/api"',
    '!request.path.startsWith("/api/")',
    ...modelExtractionExclusionPaths.map((path) => `request.path != "${escapeCelString(path)}"`),
  ].join(" && ");

  return {
    config: {
      adminAddr: "127.0.0.1:15000",
      statsAddr: `0.0.0.0:${AGENT_GATEWAY_METRICS_PORT}`,
      readinessAddr: `0.0.0.0:${AGENT_GATEWAY_HEALTH_PORT}`,
      connectionTerminationDeadline: AGENT_GATEWAY_CONNECTION_TERMINATION_DEADLINE,
      tracing: {
        otlpEndpoint: AGENT_GATEWAY_TRACE_ENDPOINT,
        otlpProtocol: "grpc",
        path: "/v1/traces",
        clientSampling: true,
        randomSampling: true,
      },
    },
    gateways: {
      default: {
        port: AGENT_GATEWAY_PORT,
        transformations: {
          conditional: [{
            condition: modelExtractionCondition,
            request: { set: { "x-model": "json(request.body).model" } },
          }],
        },
      },
    },
    ...(routeStorageMode === "file" || routeStorageMode === "prepare-database"
      ? { routes: generateAgentGatewayRoutes(providers, requestTimeout) }
      : {}),
    ...(routingRepresentationMode === "routes" ? {} : {
      llm: { gateways: ["default"], models: [] as [] },
      policies: [{
        name: { namespace: "internal", name: "llm-request-timeout" },
        target: { route: { namespace: "internal", name: "llm:request" } },
        policy: { timeout: { requestTimeout } },
      }],
    }),
    ui: { gateways: ["default"] },
  };
}

export function generateAgentGatewayRouteResources(
  providers: AgentGatewayProviderConfig[],
  routeStorageMode: AgentGatewayRouteStorageMode,
  routingRepresentationMode: AgentGatewayRoutingRepresentationMode,
  requestTimeout: string = AGENT_GATEWAY_CONNECTION_TERMINATION_DEADLINE
): AgentGatewayConfigResourceInput[] {
  if (routeStorageMode === "file") return [];
  return generateAgentGatewayRoutes(providers, requestTimeout)
    .filter((route) => routingRepresentationMode !== "first-class" || route.name === "bifrost")
    .map((route) => {
    const name = routeStorageMode === "prepare-database" || routeStorageMode === "prepare-file"
      ? `${AGENT_GATEWAY_MIGRATION_ROUTE_PREFIX}${route.name}`
      : route.name;
    return { id: name, value: { ...route, name } as unknown as JsonValue };
    });
}

export function generateAgentGatewayProviderResources(
  providers: AgentGatewayProviderConfig[]
): AgentGatewayConfigResourceInput[] {
  return providers.map(convertProvider).filter(({ name }) => name !== "bifrost").map((provider) => {
    const params = {
      ...(provider.credentialEnvVar ? { apiKey: `$${provider.credentialEnvVar}` } : {}),
      ...(provider.host ? {
        baseUrl: `${provider.tlsHostname ? "https" : "http"}://${provider.host}:${provider.port}`,
      } : {}),
    };
    const defaults = {
      ...(provider.modelPrefix ? {
        transformation: {
          model: `llmRequest.model.stripPrefix("${escapeCelString(provider.modelPrefix)}")`,
        },
      } : {}),
      ...(provider.tlsHostname ? { tls: { hostname: provider.tlsHostname } } : {}),
    };
    const value = {
      name: provider.name,
      provider: provider.provider,
      ...(Object.keys(params).length > 0 ? { params } : {}),
      ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
    };
    return { id: provider.name, value: value as unknown as JsonValue };
  });
}

export function generateAgentGatewayModelResources(
  providers: AgentGatewayProviderConfig[]
): AgentGatewayConfigResourceInput[] {
  return providers.map(convertProvider).filter(({ name }) => name !== "bifrost").flatMap((provider) => {
    const models = [
      ...(provider.modelPrefix ? [{ name: `${provider.modelPrefix}*`, model: undefined }] : []),
      ...Object.entries(provider.modelAliases ?? {}).map(([name, model]) => ({ name, model })),
    ];
    return models.map(({ name, model }) => ({
      id: name,
      value: {
        id: name,
        name,
        provider: { reference: provider.name },
        ...(model ? { params: { model } } : {}),
      },
    }));
  });
}

export function getDatabaseUrlRemainder(databaseUrl: pulumi.Input<string>): pulumi.Output<string> {
  return pulumi.secret(pulumi.output(databaseUrl).apply((url) => {
    const match = url.match(/^postgres(?:ql)?:\/\/(.+)$/);
    if (!match) throw new Error("Agent Gateway database URL must use postgres:// or postgresql://");
    return match[1];
  }));
}

export function applyAgentGatewayChartResource(
  type: string,
  props: Record<string, any>,
  workloadLabels?: WorkloadLabels
): Record<string, any> {
  const metadata = normalizeKubernetesMetadata(props.metadata, workloadLabels, true);
  if (type === "kubernetes:core/v1:ConfigMap") {
    metadata.annotations = {
      ...metadata.annotations,
      "pulumi.com/patchForce": "true",
    };
  }
  const normalized = {
    ...props,
    metadata,
    ...(props.spec ? { spec: normalizeKubernetesReferences(props.spec) } : {}),
  };

  if (type === "kubernetes:apps/v1:Deployment") {
    const spec = normalized.spec;
    const template = spec.template;
    return {
      ...normalized,
      spec: {
        ...spec,
        selector: {
          ...spec.selector,
          matchLabels: AGENT_GATEWAY_SELECTOR_LABELS,
        },
        template: {
          ...template,
          metadata: normalizeKubernetesMetadata(template.metadata, workloadLabels),
          spec: {
            ...template.spec,
            terminationGracePeriodSeconds: AGENT_GATEWAY_TERMINATION_GRACE_PERIOD_SECONDS,
          },
        },
      },
    };
  }

  if (type === "kubernetes:core/v1:Service") {
    return {
      ...normalized,
      spec: {
        ...normalized.spec,
        selector: AGENT_GATEWAY_SELECTOR_LABELS,
      },
    };
  }

  return normalized;
}

export function applyAgentGatewayDatabaseBootstrap(
  type: string,
  props: Record<string, any>,
  inheritedLabels: Record<string, string> = {}
): Record<string, any> {
  if (type !== CLOUD_NATIVE_PG_CLUSTER_RESOURCE_TOKEN) {
    return props;
  }
  return {
    ...props,
    spec: {
      ...props.spec,
      inheritedMetadata: {
        ...props.spec?.inheritedMetadata,
        labels: {
          ...inheritedLabels,
          ...props.spec?.inheritedMetadata?.labels,
        },
      },
      bootstrap: {
        initdb: {
          database: "agentgateway",
          owner: "agentgateway",
        },
      },
    },
  };
}

export class AgentGateway extends pulumi.ComponentResource {
  public readonly secret: k8s.core.v1.Secret;
  public readonly chart: k8s.helm.v4.Chart;
  public readonly pdb: k8s.policy.v1.PodDisruptionBudget;
  public readonly httpRoute: k8s.apiextensions.CustomResource;
  public readonly routeResources?: AgentGatewayConfigResourceSet;
  public readonly providerResources?: AgentGatewayConfigResourceSet;
  public readonly modelResources?: AgentGatewayConfigResourceSet;
  public readonly hostname: pulumi.Output<string>;
  public readonly gatewayName: pulumi.Output<string>;
  public readonly gatewayNamespace: pulumi.Output<string>;
  public readonly backendNames: string[];

  constructor(name: string, args: AgentGatewayArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:AgentGateway", name, {}, withWorkloadLabels(opts, args.workloadLabels));

    validateAgentGatewayRoutingModes(args.routeStorageMode, args.routingRepresentationMode);
    const config = generateAgentGatewayBootstrapConfig(
      args.providers,
      args.routeStorageMode,
      args.routingRepresentationMode,
      args.modelExtractionExclusionPaths,
      args.requestTimeout
    );
    const routeResources = generateAgentGatewayRouteResources(
      args.providers,
      args.routeStorageMode,
      args.routingRepresentationMode,
      args.requestTimeout
    );
    const credentialData = Object.fromEntries(args.providers.flatMap((provider) => {
      if (!provider.secret) return [];
      if (!provider.credentialEnvVar) {
        throw new Error(`Provider ${provider.name} requires credentialEnvVar`);
      }
      return [[provider.credentialEnvVar, provider.secret.value]];
    }));

    this.secret = new k8s.core.v1.Secret(`${name}-env`, {
      metadata: {
        name: `${name}-env`,
        namespace: args.namespace,
      },
      type: "Opaque",
      stringData: {
        DATABASE_URL_REMAINDER: getDatabaseUrlRemainder(args.databaseUrl),
        ...credentialData,
      },
    }, { parent: this });

    const envNames = ["DATABASE_URL_REMAINDER", ...Object.keys(credentialData)];
    this.chart = new k8s.helm.v4.Chart(`${name}-chart`, {
      ...createHelmChartArgs(HELM_CHARTS.AGENTGATEWAY_STANDALONE, args.namespace),
      name,
      values: {
        fullnameOverride: name,
        mode: args.routeStorageMode === "file" ? "readonly" : "database",
        replicaCount: AGENT_GATEWAY_REPLICAS,
        config,
        ...(args.routeStorageMode === "file" ? {} : { database: {
          postgres: {
            url: "postgresql://$DATABASE_URL_REMAINDER",
          },
        } }),
        gateway: {
          service: {
            enabled: true,
            type: "ClusterIP",
            ports: [{
              name: "http",
              port: AGENT_GATEWAY_PORT,
              targetPort: AGENT_GATEWAY_PORT,
              protocol: "TCP",
            }],
          },
        },
        podAnnotations: {
          "k8s.grafana.com/scrape": "true",
          "k8s.grafana.com/job": "agent-gateway",
          "k8s.grafana.com/instance": "agent-gateway",
          "k8s.grafana.com/metrics.path": "/metrics",
          "k8s.grafana.com/metrics.portNumber": AGENT_GATEWAY_METRICS_PORT.toString(),
          "k8s.grafana.com/metrics.scheme": "http",
          "k8s.grafana.com/metrics.scrapeInterval": "30s",
        },
        extraEnv: envNames.map((envName) => ({
          name: envName,
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: envName,
            },
          },
        })),
      },
    }, {
      parent: this,
      dependsOn: [this.secret],
      transforms: [(resourceArgs) => ({
        props: applyAgentGatewayChartResource(resourceArgs.type, resourceArgs.props, args.workloadLabels),
        opts: resourceArgs.opts,
      })],
    });

    this.pdb = new k8s.policy.v1.PodDisruptionBudget(`${name}-pdb`, {
      metadata: {
        name,
        namespace: args.namespace,
      },
      spec: {
        maxUnavailable: 1,
        selector: {
          matchLabels: AGENT_GATEWAY_SELECTOR_LABELS,
        },
      },
    }, { parent: this, dependsOn: [this.chart] });

    this.httpRoute = new k8s.apiextensions.CustomResource(`${name}-httproute`, {
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "HTTPRoute",
      metadata: {
        name,
        namespace: args.namespace,
        annotations: {
          [EXTERNAL_DNS_HOSTNAME_ANNOTATION]: args.hostname,
        },
      },
      spec: {
        parentRefs: [{
          group: "gateway.networking.k8s.io",
          kind: "Gateway",
          name: AGENT_GATEWAY_NAME,
          namespace: AGENT_GATEWAY_NAMESPACE,
        }],
        hostnames: [args.hostname],
        rules: [{
          timeouts: {
            request: args.requestTimeout ?? AGENT_GATEWAY_CONNECTION_TERMINATION_DEADLINE,
          },
          backendRefs: [{
            name,
            port: AGENT_GATEWAY_PORT,
          }],
        }],
      },
    }, { parent: this, dependsOn: [this.chart] });

    if (args.routingRepresentationMode !== "routes") {
      this.providerResources = new AgentGatewayConfigResourceSet(`${name}-providers`, {
        endpoint: pulumi.interpolate`https://${args.hostname}`,
        kind: "llm.provider",
        resources: generateAgentGatewayProviderResources(args.providers),
      }, { parent: this, dependsOn: [this.chart, this.httpRoute] });

      this.modelResources = new AgentGatewayConfigResourceSet(`${name}-models`, {
        endpoint: pulumi.interpolate`https://${args.hostname}`,
        kind: "llm.model",
        resources: generateAgentGatewayModelResources(args.providers),
      }, { parent: this, dependsOn: [this.providerResources] });
    }

    if (args.routeStorageMode !== "file") {
      this.routeResources = new AgentGatewayConfigResourceSet(`${name}-routes`, {
        endpoint: pulumi.interpolate`https://${args.hostname}`,
        kind: "traffic.route",
        resources: routeResources,
      }, {
        parent: this,
        dependsOn: [this.chart, this.httpRoute, ...(this.modelResources ? [this.modelResources] : [])],
      });
    }

    this.hostname = pulumi.output(args.hostname);
    this.gatewayName = pulumi.output(AGENT_GATEWAY_NAME);
    this.gatewayNamespace = pulumi.output(AGENT_GATEWAY_NAMESPACE);
    this.backendNames = args.providers.map((provider) => provider.name);

    this.registerOutputs({
      secret: this.secret,
      chart: this.chart,
      pdb: this.pdb,
      httpRoute: this.httpRoute,
      routeResources: this.routeResources,
      providerResources: this.providerResources,
      modelResources: this.modelResources,
      hostname: this.hostname,
      gatewayName: this.gatewayName,
      gatewayNamespace: this.gatewayNamespace,
      backendNames: this.backendNames,
    });
  }

  public getHttpRouteUrl(): pulumi.Output<string> {
    return this.hostname.apply((hostname) => `https://${hostname}`);
  }

  public getAdminUiUrl(): pulumi.Output<string> {
    return this.hostname.apply((hostname) => `https://${hostname}/ui/`);
  }
}

function convertProvider(provider: AgentGatewayProviderConfig): AgentGatewayProvider {
  const aiPolicies = asRecord(provider.policies?.ai);
  const providerConfig = provider.provider;
  const providerType = asRecord(providerConfig.anthropic) ? "anthropic" : "openAI";
  if (!asRecord(providerConfig.anthropic) && !asRecord(providerConfig.openai)) {
    throw new Error(`Unsupported provider type for ${provider.name}`);
  }
  const routes = asRecord(aiPolicies?.routes);
  if (!routes) {
    throw new Error(`Provider ${provider.name} requires AI routes`);
  }
  const modelAliases = asRecord(aiPolicies?.modelAliases);

  return {
    name: provider.name,
    provider: providerType,
    credentialEnvVar: provider.credentialEnvVar,
    ...(typeof providerConfig.host === "string" ? { host: providerConfig.host } : {}),
    ...(typeof providerConfig.port === "number" ? { port: providerConfig.port } : {}),
    routes: Object.fromEntries(Object.entries(routes).map(([path, route]) => [path, normalizeRouteType(route, provider.name)])),
    ...(modelAliases ? {
      modelAliases: Object.fromEntries(Object.entries(modelAliases).map(([alias, model]) => {
        if (typeof model !== "string") throw new Error(`Invalid model alias for ${provider.name}`);
        return [alias, model];
      })),
    } : {}),
    ...(typeof aiPolicies?.modelPrefix === "string" ? { modelPrefix: aiPolicies.modelPrefix } : {}),
    ...(typeof asRecord(provider.policies?.tls)?.sni === "string" ? {
      tlsHostname: asRecord(provider.policies?.tls)?.sni as string,
    } : {}),
  };
}

function generateAgentGatewayRoutes(
  providers: AgentGatewayProviderConfig[],
  requestTimeout: string
): AgentGatewayRoute[] {
  return providers.map(convertProvider).map((provider) => ({
    name: provider.name,
    gateways: ["default"],
    matches: [{
      path: { pathPrefix: "/" },
      headers: [{
        name: "x-model",
        value: { regex: `^(${getProviderRoutePatterns(provider).join("|")})$` },
      }],
    }],
    policies: { timeout: { requestTimeout } },
    backends: [{
      ai: {
        name: provider.name,
        provider: { [provider.provider]: {} },
        ...(provider.host ? { hostOverride: `${provider.host}:${provider.port}` } : {}),
      },
      policies: {
        ai: {
          routes: provider.routes,
          ...(provider.modelAliases ? { modelAliases: provider.modelAliases } : {}),
          ...(provider.modelPrefix ? {
            transformations: {
              model: `llmRequest.model.stripPrefix("${escapeCelString(provider.modelPrefix)}")`,
            },
          } : {}),
        },
        ...(provider.credentialEnvVar ? {
          backendAuth: { key: { value: `$${provider.credentialEnvVar}` } },
        } : {}),
        ...(provider.tlsHostname ? { backendTLS: { hostname: provider.tlsHostname } } : {}),
      },
    }],
  }));
}

function normalizeRouteType(value: unknown, providerName: string): RouteType {
  const normalized = typeof value === "string" ? value.charAt(0).toLowerCase() + value.slice(1) : "";
  if (normalized === "completions" || normalized === "messages" || normalized === "models" ||
      normalized === "passthrough" || normalized === "responses" || normalized === "embeddings") {
    return normalized;
  }
  throw new Error(`Unsupported AI route type for ${providerName}: ${String(value)}`);
}

function getProviderRoutePatterns(provider: AgentGatewayProvider): string[] {
  return [
    ...Object.keys(provider.modelAliases ?? {}).map(escapeRegex),
    ...(provider.modelPrefix ? [`${escapeRegex(provider.modelPrefix)}.+`] : []),
  ];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function normalizeChartLabels(
  labels: Record<string, pulumi.Input<string>> | undefined,
  workloadLabels: WorkloadLabels | undefined,
  includeChartLabel: boolean = false
): WorkloadLabels {
  const normalize = (configured: Record<string, pulumi.Input<string>>) => ({
    ...normalizeMetadataValues(labels),
    ...normalizeMetadataValues(configured),
    ...AGENT_GATEWAY_SELECTOR_LABELS,
    ...(includeChartLabel ? { "helm.sh/chart": "agent-gateway-v1.5.0" } : {}),
  });

  if (!pulumi.Output.isInstance(workloadLabels) && !(workloadLabels instanceof Promise)) {
    return normalize(workloadLabels ?? {});
  }

  return pulumi.output(workloadLabels).apply((configured) => normalize(configured));
}

function normalizeKubernetesMetadata(
  metadata: Record<string, any> | undefined,
  workloadLabels: WorkloadLabels | undefined,
  includeChartLabel: boolean = false
): Record<string, any> {
  return {
    ...metadata,
    ...(metadata?.name ? { name: normalizeKubernetesNameInput(metadata.name) } : {}),
    ...(metadata?.generateName ? { generateName: normalizeKubernetesNameInput(metadata.generateName) } : {}),
    labels: normalizeChartLabels(metadata?.labels, workloadLabels, includeChartLabel),
    ...(metadata?.annotations ? { annotations: normalizeMetadataValues(metadata.annotations) } : {}),
    ...(metadata?.ownerReferences ? {
      ownerReferences: normalizeKubernetesReferences(metadata.ownerReferences, "ownerReferences"),
    } : {}),
  };
}

function normalizeMetadataValues(
  values: Record<string, pulumi.Input<string>> | undefined
): Record<string, pulumi.Input<string>> {
  return Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [
    key,
    normalizeIdentityValueInput(value),
  ]));
}

function normalizeKubernetesReferences(value: any, context?: string): any {
  if (pulumi.Output.isInstance(value) || value instanceof Promise) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeKubernetesReferences(item, context));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (
      KUBERNETES_REFERENCE_VALUE_KEYS.has(key)
      || (key === "name" && context && KUBERNETES_REFERENCE_NAME_CONTEXTS.has(context))
    ) {
      return [key, normalizeKubernetesNameInput(child)];
    }
    return [key, normalizeKubernetesReferences(child, key)];
  }));
}

function normalizeKubernetesName(value: string): string {
  const normalized = value
    .replace(/agentgateway-standalone/g, "agent-gateway")
    .replace(/agent-gateway-standalone/g, "agent-gateway");
  return normalized === "standalone" ? "agent-gateway" : normalized;
}

function normalizeKubernetesNameInput(value: any): any {
  if (pulumi.Output.isInstance(value)) {
    return value.apply((resolved) => typeof resolved === "string" ? normalizeKubernetesName(resolved) : resolved);
  }
  if (value instanceof Promise) {
    return value.then((resolved) => typeof resolved === "string" ? normalizeKubernetesName(resolved) : resolved);
  }
  return typeof value === "string" ? normalizeKubernetesName(value) : value;
}

function normalizeIdentityValue(value: string): string {
  const normalized = normalizeKubernetesName(value);
  return value === "standalone" ? "llm-gateway" : normalized;
}

function normalizeIdentityValueInput(value: any): any {
  if (pulumi.Output.isInstance(value)) {
    return value.apply((resolved) => typeof resolved === "string" ? normalizeIdentityValue(resolved) : resolved);
  }
  if (value instanceof Promise) {
    return value.then((resolved) => typeof resolved === "string" ? normalizeIdentityValue(resolved) : resolved);
  }
  return typeof value === "string" ? normalizeIdentityValue(value) : value;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeCelString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
