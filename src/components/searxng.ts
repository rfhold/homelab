import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import { DOCKER_IMAGES } from "../docker-images";
import { createYAMLDocumentOutput } from "../utils/yaml";

export interface SearXNGArgs {
  namespace: pulumi.Input<string>;
  
  baseUrl?: pulumi.Input<string>;
  
  instanceName?: pulumi.Input<string>;
  
  limiter?: {
    enabled?: pulumi.Input<boolean>;
  };
  
  search?: {
    safeSearch?: pulumi.Input<number>;
    autocomplete?: pulumi.Input<string>;
    favicon?: pulumi.Input<string>;
    formats?: pulumi.Input<string[]>;
  };
  
  ui?: {
    infiniteScroll?: pulumi.Input<boolean>;
    theme?: pulumi.Input<string>;
    style?: pulumi.Input<string>;
    hotkeys?: pulumi.Input<string>;
  };
  
  valkey?: {
    url: pulumi.Input<string>;
  };
  
  engines?: pulumi.Input<string[]>;
  
  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };
  
  ingress?: {
    enabled?: pulumi.Input<boolean>;
    className?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    annotations?: pulumi.Input<{[key: string]: string}>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };
}

export class SearXNG extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly secret: k8s.core.v1.Secret;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: SearXNGArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:SearXNG", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const secretKey = new random.RandomPassword(`${name}-secret-key`, {
      length: 32,
      special: false,
    }, defaultResourceOptions);

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
      stringData: {
        SEARXNG_SECRET: secretKey.result,
      },
    }, defaultResourceOptions);

    const settingsConfig = pulumi.all([
      args.instanceName || "searxng",
      args.baseUrl || "",
      args.limiter?.enabled ?? false,
      args.search?.safeSearch ?? 0,
      args.search?.autocomplete ?? "duckduckgo",
      args.search?.favicon ?? "duckduckgo",
      args.search?.formats ?? ["html", "csv", "json", "rss"],
      args.ui?.infiniteScroll ?? true,
      args.ui?.theme ?? "simple",
      args.ui?.style ?? "dark",
      args.ui?.hotkeys ?? "vim",
      args.valkey?.url,
      args.engines ?? [],
      secretKey.result,
    ]).apply(([
      instanceName,
      baseUrl,
      limiterEnabled,
      safeSearch,
      autocomplete,
      favicon,
      formats,
      infiniteScroll,
      theme,
      style,
      hotkeys,
      valkeyUrl,
      engines,
      secretKeyValue,
    ]) => {
      const formatsArray = formats as string[];
      const enginesArray = engines as string[];
      
      const config: any = {
        general: {
          instance_name: instanceName,
          privacypolicy_url: false,
          donation_url: false,
          contact_url: false,
          enable_metrics: true,
        },
        brand: {
          new_issue_url: "https://github.com/searxng/searxng/issues/new",
          docs_url: "https://docs.searxng.org/",
          public_instances: "https://searx.space",
          wiki_url: "https://github.com/searxng/searxng/wiki",
          issue_url: "https://github.com/searxng/searxng/issues",
        },
        search: {
          safe_search: safeSearch,
          autocomplete: autocomplete,
          favicon_resolver: favicon,
          default_lang: "en",
          formats: formatsArray,
        },
        server: {
          base_url: baseUrl,
          limiter: limiterEnabled,
          secret_key: secretKeyValue,
          image_proxy: true,
          http_protocol_version: "1.1",
          method: "GET",
        },
        ui: {
          static_use_hash: true,
          infinite_scroll: infiniteScroll,
          default_theme: theme,
          theme_args: {
            simple_style: style,
          },
          hotkeys: hotkeys,
          query_in_title: true,
        },
        preferences: {
          lock: ["autocomplete", "safesearch", "theme", "method"],
        },
        enabled_plugins: [
          "Hash plugin",
          "Search on category select",
          "Self Information",
          "Tracker URL remover",
        ],
      };

      if (valkeyUrl) {
        config.valkey = {
          url: valkeyUrl,
        };
      }

      // Add default engines configuration
      config.engines = [
        { name: "google", engine: "google", shortcut: "go" },
        { name: "duckduckgo", engine: "duckduckgo", shortcut: "ddg" },
        { name: "github", engine: "github", shortcut: "gh" },
        { name: "stackoverflow", engine: "stackexchange", api_site: "stackoverflow", shortcut: "st" },
        { name: "docker hub", engine: "docker_hub", shortcut: "dh" },
      ];

      // Override with custom engines if provided
      if (enginesArray && enginesArray.length > 0) {
        config.engines = enginesArray.map((engine: string) => {
          // Map common engine names to their proper configuration
          const engineConfigs: Record<string, any> = {
            google: { name: "google", engine: "google", shortcut: "go" },
            duckduckgo: { name: "duckduckgo", engine: "duckduckgo", shortcut: "ddg" },
            github: { name: "github", engine: "github", shortcut: "gh" },
            stackoverflow: { name: "stackoverflow", engine: "stackexchange", api_site: "stackoverflow", shortcut: "st" },
            dockerhub: { name: "docker hub", engine: "docker_hub", shortcut: "dh" },
            wikipedia: { name: "wikipedia", engine: "wikipedia", shortcut: "wp" },
            youtube: { name: "youtube", engine: "youtube_noapi", shortcut: "yt" },
          };
          
          return engineConfigs[engine.toLowerCase()] || { name: engine, engine: engine, shortcut: engine.substring(0, 3).toLowerCase() };
        });
      }

      // Add required DOI resolver configuration
      config.doi_resolvers = {
        "oadoi.org": "https://oadoi.org/",
        "doi.org": "https://doi.org/",
      };
      config.default_doi_resolver = "oadoi.org";

      return config;
    });

    const settingsYml = createYAMLDocumentOutput(
      settingsConfig,
      "SearXNG settings",
      { indent: 2, lineWidth: -1 }
    );

    const limiterToml = pulumi.output(args.limiter?.enabled ?? false).apply(enabled => {
      if (!enabled) {
        return "";
      }
      
      return `[botdetection.ip_limit]
# activate link_token method in the ip_limit method
link_token = true

[botdetection.ip_lists]
# In the limiter, the ip_lists method has priority over the ip_limit method.
pass_ip = []
pass_searxng_org = true
`;
    });

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
      data: {
        "settings.yml": settingsYml,
        "limiter.toml": limiterToml,
      },
    }, defaultResourceOptions);

    const labels = { app: "searxng", component: name };

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {
            containers: [{
              name: "searxng",
              image: DOCKER_IMAGES.SEARXNG.image,
              ports: [{
                containerPort: 8080,
                name: "http",
              }],
              env: [
                {
                  name: "SEARXNG_BASE_URL",
                  value: args.baseUrl || "",
                },
                {
                  name: "SEARXNG_SECRET",
                  valueFrom: {
                    secretKeyRef: {
                      name: this.secret.metadata.name,
                      key: "SEARXNG_SECRET",
                    },
                  },
                },
                ...(args.valkey ? [{
                  name: "SEARXNG_VALKEY_URL",
                  value: args.valkey.url,
                }] : []),
              ],
              volumeMounts: [{
                name: "config",
                mountPath: "/etc/searxng",
              }],
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "256Mi",
                  cpu: args.resources?.requests?.cpu || "100m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "512Mi",
                  cpu: args.resources?.limits?.cpu || "500m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 8080,
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 8080,
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
            }],
            volumes: [{
              name: "config",
              configMap: {
                name: this.configMap.metadata.name,
              },
            }],
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 8080,
          targetPort: 8080,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);

    if (args.ingress?.enabled) {
      const ingressRules = [{
        host: args.ingress.host,
        http: {
          paths: [{
            path: "/",
            pathType: "Prefix" as const,
            backend: {
              service: {
                name: this.service.metadata.name,
                port: {
                  number: 8080,
                },
              },
            },
          }],
        },
      }];

      const ingressTls = args.ingress.tls?.enabled ? [{
        hosts: [args.ingress.host],
        secretName: args.ingress.tls.secretName,
      }] : undefined;

      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels: labels,
          annotations: args.ingress.annotations,
        },
        spec: {
          ingressClassName: args.ingress.className,
          rules: ingressRules,
          tls: ingressTls,
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      configMap: this.configMap,
      secret: this.secret,
      ingress: this.ingress,
    });
  }
}