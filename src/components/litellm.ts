import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface LiteLLMModelConfig {
  name: string;
  litellmModel: string;
  apiBase?: pulumi.Input<string>;
  apiKeyEnvVar?: string;
}

export interface LiteLLMProviderConfig {
  apiKey?: pulumi.Input<string>;
  apiBase?: pulumi.Input<string>;
  models: LiteLLMModelConfig[];
}

export interface LiteLLMVllmConfig {
  name: string;
  apiBase: pulumi.Input<string>;
  model: pulumi.Input<string>;
}

export interface LiteLLMArgs {
  namespace: pulumi.Input<string>;
  masterKey?: pulumi.Input<string>;

  providers?: {
    openai?: LiteLLMProviderConfig;
    anthropic?: LiteLLMProviderConfig;
    cerebras?: LiteLLMProviderConfig;
    chutes?: LiteLLMProviderConfig;
  };

  vllm?: LiteLLMVllmConfig[];

  replicas?: pulumi.Input<number>;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };

  httpRoute?: {
    enabled?: boolean;
    hostname: pulumi.Input<string>;
    gatewayRef: {
      name: pulumi.Input<string>;
      namespace: pulumi.Input<string>;
    };
    requestTimeout?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
  };

  metrics?: {
    enabled?: boolean;
    scrapeInterval?: string;
  };
}

interface ModelListEntry {
  model_name: string;
  litellm_params: {
    model: string;
    api_key?: string;
    api_base?: string;
  };
}

export class LiteLLM extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly secret: k8s.core.v1.Secret;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly httpRoute?: k8s.apiextensions.CustomResource;
  public readonly httpRouteHostname?: pulumi.Output<string>;

  constructor(
    name: string,
    args: LiteLLMArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("homelab:components:LiteLLM", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };
    const labels = { app: name, "app.kubernetes.io/name": "litellm" };

    const secretData: Record<string, pulumi.Input<string>> = {};
    if (args.masterKey) {
      secretData["LITELLM_MASTER_KEY"] = args.masterKey;
    }

    if (args.providers?.openai?.apiKey) {
      secretData["OPENAI_API_KEY"] = args.providers.openai.apiKey;
    }
    if (args.providers?.anthropic?.apiKey) {
      secretData["ANTHROPIC_API_KEY"] = args.providers.anthropic.apiKey;
    }
    if (args.providers?.cerebras?.apiKey) {
      secretData["CEREBRAS_API_KEY"] = args.providers.cerebras.apiKey;
    }
    if (args.providers?.chutes?.apiKey) {
      secretData["CHUTES_API_KEY"] = args.providers.chutes.apiKey;
    }

    this.secret = new k8s.core.v1.Secret(
      `${name}-secret`,
      {
        metadata: {
          name: `${name}-secret`,
          namespace: args.namespace,
          labels,
        },
        stringData: secretData,
      },
      defaultResourceOptions
    );

    const configYaml = this.generateConfig(args);

    this.configMap = new k8s.core.v1.ConfigMap(
      `${name}-config`,
      {
        metadata: {
          name: `${name}-config`,
          namespace: args.namespace,
          labels,
        },
        data: {
          "config.yaml": configYaml,
        },
      },
      defaultResourceOptions
    );

    this.deployment = new k8s.apps.v1.Deployment(
      `${name}-deployment`,
      {
        metadata: {
          name,
          namespace: args.namespace,
          labels,
        },
        spec: {
          replicas: args.replicas ?? 1,
          selector: { matchLabels: labels },
          template: {
            metadata: { labels },
            spec: {
              containers: [
                {
                  name: "litellm",
                  image: DOCKER_IMAGES.LITELLM.image,
                  args: ["--config", "/app/config.yaml"],
                  ports: [
                    { name: "http", containerPort: 4000, protocol: "TCP" },
                  ],
                  envFrom: [
                    {
                      secretRef: {
                        name: this.secret.metadata.name,
                      },
                    },
                  ],
                  volumeMounts: [
                    {
                      name: "config",
                      mountPath: "/app/config.yaml",
                      subPath: "config.yaml",
                      readOnly: true,
                    },
                  ],
                  resources: {
                    requests: {
                      cpu: args.resources?.requests?.cpu ?? "100m",
                      memory: args.resources?.requests?.memory ?? "256Mi",
                    },
                    limits: {
                      cpu: args.resources?.limits?.cpu ?? "1000m",
                      memory: args.resources?.limits?.memory ?? "1Gi",
                    },
                  },
                  livenessProbe: {
                    httpGet: {
                      path: "/health/liveliness",
                      port: 4000,
                    },
                    initialDelaySeconds: 10,
                    periodSeconds: 30,
                  },
                  readinessProbe: {
                    httpGet: {
                      path: "/health/readiness",
                      port: 4000,
                    },
                    initialDelaySeconds: 5,
                    periodSeconds: 10,
                  },
                },
              ],
              volumes: [
                {
                  name: "config",
                  configMap: {
                    name: this.configMap.metadata.name,
                  },
                },
              ],
            },
          },
        },
      },
      defaultResourceOptions
    );

    const serviceAnnotations: Record<string, string> = {};
    if (args.metrics?.enabled) {
      serviceAnnotations["k8s.grafana.com/scrape"] = "true";
      serviceAnnotations["k8s.grafana.com/job"] = name;
      serviceAnnotations["k8s.grafana.com/instance"] = name;
      serviceAnnotations["k8s.grafana.com/metrics.path"] = "/metrics";
      serviceAnnotations["k8s.grafana.com/metrics.portNumber"] = "4000";
      serviceAnnotations["k8s.grafana.com/metrics.scheme"] = "http";
      serviceAnnotations["k8s.grafana.com/metrics.scrapeInterval"] =
        args.metrics.scrapeInterval ?? "30s";
    }

    this.service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          name,
          namespace: args.namespace,
          labels,
          annotations: serviceAnnotations,
        },
        spec: {
          type: "ClusterIP",
          selector: labels,
          ports: [
            {
              name: "http",
              port: 4000,
              targetPort: 4000,
              protocol: "TCP",
            },
          ],
        },
      },
      defaultResourceOptions
    );

    if (args.httpRoute?.enabled) {
      this.httpRouteHostname = pulumi.output(args.httpRoute.hostname);
      this.httpRoute = new k8s.apiextensions.CustomResource(
        `${name}-httproute`,
        {
          apiVersion: "gateway.networking.k8s.io/v1",
          kind: "HTTPRoute",
          metadata: {
            name,
            namespace: args.namespace,
            labels,
            annotations: args.httpRoute.annotations ?? {},
          },
          spec: {
            parentRefs: [
              {
                group: "gateway.networking.k8s.io",
                kind: "Gateway",
                name: args.httpRoute.gatewayRef.name,
                namespace: args.httpRoute.gatewayRef.namespace,
              },
            ],
            hostnames: [args.httpRoute.hostname],
            rules: [
              {
                matches: [{ path: { type: "PathPrefix", value: "/" } }],
                backendRefs: [
                  {
                    name: this.service.metadata.name,
                    port: 4000,
                  },
                ],
                timeouts: args.httpRoute.requestTimeout
                  ? { request: args.httpRoute.requestTimeout }
                  : undefined,
              },
            ],
          },
        },
        defaultResourceOptions
      );
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      secret: this.secret,
      configMap: this.configMap,
      httpRoute: this.httpRoute,
      httpRouteHostname: this.httpRouteHostname,
    });
  }

  private generateConfig(args: LiteLLMArgs): pulumi.Output<string> {
    const modelListInputs: pulumi.Input<ModelListEntry>[] = [];

    if (args.providers?.openai?.models) {
      for (const model of args.providers.openai.models) {
        modelListInputs.push({
          model_name: model.name,
          litellm_params: {
            model: model.litellmModel,
            api_key: "os.environ/OPENAI_API_KEY",
          },
        });
      }
    }

    if (args.providers?.anthropic?.models) {
      for (const model of args.providers.anthropic.models) {
        modelListInputs.push({
          model_name: model.name,
          litellm_params: {
            model: model.litellmModel,
            api_key: "os.environ/ANTHROPIC_API_KEY",
          },
        });
      }
    }

    if (args.providers?.cerebras?.models) {
      for (const model of args.providers.cerebras.models) {
        const entry: ModelListEntry = {
          model_name: model.name,
          litellm_params: {
            model: model.litellmModel,
            api_key: "os.environ/CEREBRAS_API_KEY",
          },
        };
        if (args.providers.cerebras.apiBase) {
          modelListInputs.push(
            pulumi.output(args.providers.cerebras.apiBase).apply((base) => ({
              ...entry,
              litellm_params: { ...entry.litellm_params, api_base: base },
            }))
          );
        } else {
          modelListInputs.push(entry);
        }
      }
    }

    if (args.providers?.chutes?.models) {
      for (const model of args.providers.chutes.models) {
        const entry: ModelListEntry = {
          model_name: model.name,
          litellm_params: {
            model: model.litellmModel,
            api_key: "os.environ/CHUTES_API_KEY",
          },
        };
        if (args.providers.chutes.apiBase) {
          modelListInputs.push(
            pulumi.output(args.providers.chutes.apiBase).apply((base) => ({
              ...entry,
              litellm_params: { ...entry.litellm_params, api_base: base },
            }))
          );
        } else {
          modelListInputs.push(entry);
        }
      }
    }

    if (args.vllm) {
      for (const vllm of args.vllm) {
        modelListInputs.push(
          pulumi
            .all([vllm.apiBase, vllm.model])
            .apply(([apiBase, model]) => ({
              model_name: vllm.name,
              litellm_params: {
                model: `hosted_vllm/${model}`,
                api_base: apiBase,
              },
            }))
        );
      }
    }

    return pulumi.all(modelListInputs).apply((modelList) => {
      const config: Record<string, unknown> = {
        model_list: modelList,
        litellm_settings: {
          callbacks: ["prometheus"],
          drop_params: true,
          request_timeout: 600,
        },
      };

      if (args.masterKey) {
        config.general_settings = {
          master_key: "os.environ/LITELLM_MASTER_KEY",
        };
      }

      return this.toYaml(config);
    });
  }

  private toYaml(obj: unknown, indent = 0): string {
    const spaces = "  ".repeat(indent);

    if (obj === null || obj === undefined) {
      return "null";
    }

    if (typeof obj === "string") {
      if (
        obj.includes("\n") ||
        obj.includes(":") ||
        obj.includes("#") ||
        obj.startsWith(" ") ||
        obj.endsWith(" ")
      ) {
        return `"${obj.replace(/"/g, '\\"')}"`;
      }
      return obj;
    }

    if (typeof obj === "number" || typeof obj === "boolean") {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      return obj
        .map((item) => {
          const itemYaml = this.toYaml(item, indent + 1);
          if (typeof item === "object" && item !== null && !Array.isArray(item)) {
            const lines = itemYaml.split("\n");
            return `${spaces}- ${lines[0]}\n${lines.slice(1).map((l) => `${spaces}  ${l}`).join("\n")}`;
          }
          return `${spaces}- ${itemYaml}`;
        })
        .join("\n");
    }

    if (typeof obj === "object") {
      const entries = Object.entries(obj as Record<string, unknown>);
      if (entries.length === 0) return "{}";
      return entries
        .map(([key, value]) => {
          if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
          ) {
            return `${spaces}${key}:\n${this.toYaml(value, indent + 1)}`;
          }
          if (Array.isArray(value)) {
            return `${spaces}${key}:\n${this.toYaml(value, indent + 1)}`;
          }
          return `${spaces}${key}: ${this.toYaml(value, indent)}`;
        })
        .join("\n");
    }

    return String(obj);
  }

  public getApiUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:4000`;
  }

  public getHttpRouteUrl(): pulumi.Output<string> | undefined {
    if (!this.httpRouteHostname) return undefined;
    return this.httpRouteHostname.apply((hostname) => `https://${hostname}`);
  }
}
