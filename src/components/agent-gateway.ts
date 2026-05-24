import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface AgentGatewayProviderConfig {
  name: string;
  provider: Record<string, unknown>;
  policies?: Record<string, unknown>;
  secret?: {
    value: pulumi.Input<string>;
    key?: string;
  };
}

export interface AgentGatewayArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
  hostname: pulumi.Input<string>;
  gatewayName?: pulumi.Input<string>;
  gatewayClassName?: pulumi.Input<string>;
  gatewayAnnotations?: Record<string, pulumi.Input<string>>;
  installGatewayApiCRDs?: pulumi.Input<boolean>;
  gatewayApiVersion?: pulumi.Input<string>;
  providers?: AgentGatewayProviderConfig[];
  httpRoute?: {
    name?: pulumi.Input<string>;
    requestTimeout?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
  };
  tls?: {
    secretName: pulumi.Input<string>;
  };
}

export class AgentGateway extends pulumi.ComponentResource {
  public readonly gatewayApiCrds?: k8s.yaml.v2.ConfigFile;
  public readonly crdsChart: k8s.helm.v4.Chart;
  public readonly chart: k8s.helm.v4.Chart;
  public readonly gateway: k8s.apiextensions.CustomResource;
  public readonly providerSecrets: k8s.core.v1.Secret[];
  public readonly backends: k8s.apiextensions.CustomResource[];
  public readonly modelRoutingPolicy?: k8s.apiextensions.CustomResource;
  public readonly telemetryBackend: k8s.apiextensions.CustomResource;
  public readonly tracingPolicy: k8s.apiextensions.CustomResource;
  public readonly httpRoute?: k8s.apiextensions.CustomResource;
  public readonly gatewayName: pulumi.Output<string>;
  public readonly hostname: pulumi.Output<string>;

  constructor(name: string, args: AgentGatewayArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:AgentGateway", name, {}, withWorkloadLabels(opts, args.workloadLabels));

    const installGatewayApiCRDs = args.installGatewayApiCRDs ?? false;
    const gatewayApiVersion = args.gatewayApiVersion ?? "v1.5.0";
    const gatewayName = args.gatewayName ?? "agentgateway-proxy";
    const gatewayClassName = args.gatewayClassName ?? "agentgateway";
    const providers = args.providers ?? [];
    const gatewayAnnotations = {
      "external-dns.alpha.kubernetes.io/hostname": args.hostname,
      ...(args.gatewayAnnotations ?? {}),
    };
    const listeners = [
      {
        name: "http",
        protocol: "HTTP",
        port: 80,
        allowedRoutes: {
          namespaces: {
            from: "All",
          },
        },
      },
      ...(args.tls ? [
        {
          name: "https",
          protocol: "HTTPS",
          port: 443,
          hostname: args.hostname,
          tls: {
            mode: "Terminate",
            certificateRefs: [
              {
                kind: "Secret",
                name: args.tls.secretName,
              },
            ],
          },
          allowedRoutes: {
            namespaces: {
              from: "All",
            },
          },
        },
      ] : []),
    ];

    if (installGatewayApiCRDs) {
      this.gatewayApiCrds = new k8s.yaml.v2.ConfigFile(
        `${name}-gateway-api-crds`,
        {
          file: `https://github.com/kubernetes-sigs/gateway-api/releases/download/${gatewayApiVersion}/standard-install.yaml`,
        },
        { parent: this }
      );
    }

    this.crdsChart = new k8s.helm.v4.Chart(
      `${name}-crds-chart`,
      {
        ...createHelmChartArgs(HELM_CHARTS.AGENTGATEWAY_CRDS, args.namespace),
      },
      {
        parent: this,
        dependsOn: this.gatewayApiCrds ? [this.gatewayApiCrds] : [],
        ignoreChanges: ["chart"],
      }
    );

    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        ...createHelmChartArgs(HELM_CHARTS.AGENTGATEWAY, args.namespace),
      },
      { parent: this, dependsOn: [this.crdsChart] }
    );

    this.gateway = new k8s.apiextensions.CustomResource(
      `${name}-gateway`,
      {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "Gateway",
        metadata: {
          name: gatewayName,
          namespace: args.namespace,
          annotations: gatewayAnnotations,
        },
        spec: {
          gatewayClassName,
          infrastructure: {
            annotations: {
              "k8s.grafana.com/scrape": "true",
              "k8s.grafana.com/job": "agent-gateway",
              "k8s.grafana.com/instance": "agent-gateway",
              "k8s.grafana.com/metrics.path": "/metrics",
              "k8s.grafana.com/metrics.portNumber": "15020",
              "k8s.grafana.com/metrics.scheme": "http",
              "k8s.grafana.com/metrics.scrapeInterval": "30s",
            },
          },
          listeners,
        },
      },
      { parent: this, dependsOn: [this.chart] }
    );

    this.telemetryBackend = new k8s.apiextensions.CustomResource(
      `${name}-telemetry-backend`,
      {
        apiVersion: "agentgateway.dev/v1alpha1",
        kind: "AgentgatewayBackend",
        metadata: {
          name: `${name}-telemetry`,
          namespace: args.namespace,
        },
        spec: {
          static: {
            host: "telemetry.holdenitdown.net",
            port: 4317,
          },
          policies: {
            tls: {
              sni: "telemetry.holdenitdown.net",
            },
          },
        },
      },
      { parent: this }
    );

    this.tracingPolicy = new k8s.apiextensions.CustomResource(
      `${name}-tracing-policy`,
      {
        apiVersion: "agentgateway.dev/v1alpha1",
        kind: "AgentgatewayPolicy",
        metadata: {
          name: `${name}-tracing`,
          namespace: args.namespace,
        },
        spec: {
          targetRefs: [
            {
              group: "gateway.networking.k8s.io",
              kind: "Gateway",
              name: gatewayName,
            },
          ],
          frontend: {
            tracing: {
              backendRef: {
                group: "agentgateway.dev",
                kind: "AgentgatewayBackend",
                name: `${name}-telemetry`,
                namespace: args.namespace,
                port: 4317,
              },
              protocol: "GRPC",
              clientSampling: "true",
              randomSampling: "true",
              resources: [
                {
                  name: "service.name",
                  expression: '"agent-gateway"',
                },
                {
                  name: "deployment.environment.name",
                  expression: '"pantheon"',
                },
              ],
              attributes: {
                add: [
                  {
                    name: "host",
                    expression: "request.host",
                  },
                  {
                    name: "model",
                    expression: 'request.headers["x-model"]',
                  },
                ],
              },
            },
          },
        },
      },
      { parent: this, dependsOn: [this.gateway, this.telemetryBackend] }
    );

    this.providerSecrets = providers
      .filter((provider) => provider.secret)
      .map((provider) => new k8s.core.v1.Secret(
        `${name}-${provider.name}-secret`,
        {
          metadata: {
            name: `${provider.name}-secret`,
            namespace: args.namespace,
          },
          type: "Opaque",
          stringData: {
            [provider.secret?.key ?? "Authorization"]: provider.secret!.value,
          },
        },
        { parent: this }
      ));

    this.backends = providers.map((provider) => {
      const policies = provider.secret
        ? {
            policies: {
              ...provider.policies,
              auth: {
                secretRef: {
                  name: `${provider.name}-secret`,
                },
              },
            },
          }
        : provider.policies
          ? { policies: provider.policies }
          : {};

      return new k8s.apiextensions.CustomResource(
        `${name}-${provider.name}-backend`,
        {
          apiVersion: "agentgateway.dev/v1alpha1",
          kind: "AgentgatewayBackend",
          metadata: {
            name: provider.name,
            namespace: args.namespace,
          },
          spec: {
            ai: {
              provider: provider.provider,
            },
            ...policies,
          },
        },
        { parent: this, dependsOn: [this.crdsChart, ...this.providerSecrets] }
      );
    });

    const providerRoutes = providers.flatMap((provider) => {
      const aliases = getModelAliases(provider.policies);
      if (aliases.length === 0) return [];

      return [
        {
          matches: [
            {
              path: { type: "PathPrefix", value: "/" },
              headers: [
                {
                  type: "RegularExpression",
                  name: "x-model",
                  value: `^(${aliases.map(escapeRegex).join("|")})$`,
                },
              ],
            },
          ],
          backendRefs: [
            {
              group: "agentgateway.dev",
              kind: "AgentgatewayBackend",
              name: provider.name,
              namespace: args.namespace,
            },
          ],
          timeouts: args.httpRoute?.requestTimeout
            ? { request: args.httpRoute.requestTimeout }
            : undefined,
        },
      ];
    });

    if (providerRoutes.length > 0) {
      this.modelRoutingPolicy = new k8s.apiextensions.CustomResource(
        `${name}-model-routing-policy`,
        {
          apiVersion: "agentgateway.dev/v1alpha1",
          kind: "AgentgatewayPolicy",
          metadata: {
            name: `${name}-model-routing`,
            namespace: args.namespace,
          },
          spec: {
            targetRefs: [
              {
                group: "gateway.networking.k8s.io",
                kind: "Gateway",
                name: gatewayName,
              },
            ],
            traffic: {
              phase: "PreRouting",
              transformation: {
                request: {
                  set: [
                    {
                      name: "x-model",
                      value: "json(request.body).model",
                    },
                  ],
                },
              },
            },
          },
        },
        { parent: this, dependsOn: [this.gateway] }
      );

      this.httpRoute = new k8s.apiextensions.CustomResource(
        `${name}-httproute`,
        {
          apiVersion: "gateway.networking.k8s.io/v1",
          kind: "HTTPRoute",
          metadata: {
            name: args.httpRoute?.name ?? name,
            namespace: args.namespace,
            annotations: args.httpRoute?.annotations ?? {},
          },
          spec: {
            parentRefs: [
              {
                group: "gateway.networking.k8s.io",
                kind: "Gateway",
                name: gatewayName,
                namespace: args.namespace,
              },
            ],
            hostnames: [args.hostname],
            rules: providerRoutes,
          },
        },
        { parent: this, dependsOn: [this.gateway, this.modelRoutingPolicy, ...this.backends] }
      );
    }

    this.gatewayName = pulumi.output(gatewayName);
    this.hostname = pulumi.output(args.hostname);

    this.registerOutputs({
      gatewayApiCrds: this.gatewayApiCrds,
      crdsChart: this.crdsChart,
      chart: this.chart,
      gateway: this.gateway,
      telemetryBackend: this.telemetryBackend,
      tracingPolicy: this.tracingPolicy,
      providerSecrets: this.providerSecrets,
      backends: this.backends,
      modelRoutingPolicy: this.modelRoutingPolicy,
      httpRoute: this.httpRoute,
      gatewayName: this.gatewayName,
      hostname: this.hostname,
    });
  }

  public getHttpRouteUrl(): pulumi.Output<string> {
    return this.hostname.apply((hostname) => `https://${hostname}`);
  }
}

function getModelAliases(policies: Record<string, unknown> | undefined): string[] {
  const ai = policies?.ai;
  if (!isRecord(ai)) return [];

  const modelAliases = ai.modelAliases;
  if (!isRecord(modelAliases)) return [];

  return Object.keys(modelAliases);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
