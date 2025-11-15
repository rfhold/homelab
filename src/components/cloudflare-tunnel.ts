import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import { DOCKER_IMAGES } from "../docker-images";

export interface CloudflareTunnelRoute {
  hostname: pulumi.Input<string>;
  service: pulumi.Input<string>;
  path?: pulumi.Input<string>;
  originRequest?: {
    noTlsVerify?: pulumi.Input<boolean>;
    connectTimeout?: pulumi.Input<number>;
    tlsTimeout?: pulumi.Input<number>;
    httpHostHeader?: pulumi.Input<string>;
  };
}

export interface CloudflareTunnelArgs {
  namespace: pulumi.Input<string>;
  cloudflareAccountId: pulumi.Input<string>;
  tunnelName: pulumi.Input<string>;
  routes: CloudflareTunnelRoute[];
  zoneIds: Record<string, pulumi.Input<string>>;
  replicas?: pulumi.Input<number>;
  image?: pulumi.Input<string>;
  resources?: {
    requests?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
    limits?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
  };
  enableMetrics?: pulumi.Input<boolean>;
  useDaemonSet?: pulumi.Input<boolean>;
}

export class CloudflareTunnel extends pulumi.ComponentResource {
  public readonly tunnel: cloudflare.ZeroTrustTunnelCloudflared;
  public readonly tunnelConfig: cloudflare.ZeroTrustTunnelCloudflaredConfig;
  public readonly dnsRecords: cloudflare.DnsRecord[];
  public readonly deployment?: k8s.apps.v1.Deployment;
  public readonly daemonSet?: k8s.apps.v1.DaemonSet;
  public readonly tunnelCname: pulumi.Output<string>;
  public readonly tunnelId: pulumi.Output<string>;

  constructor(name: string, args: CloudflareTunnelArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:CloudflareTunnel", name, args, opts);

    const tunnelSecretBytes = new random.RandomBytes(`${name}-secret`, {
      length: 32,
    }, { parent: this });

    this.tunnel = new cloudflare.ZeroTrustTunnelCloudflared(`${name}-tunnel`, {
      accountId: args.cloudflareAccountId,
      name: args.tunnelName,
      configSrc: "cloudflare",
      tunnelSecret: tunnelSecretBytes.base64,
    }, { parent: this });

    const ingressRules = args.routes.map(route => {
      const rule: any = {
        hostname: route.hostname,
        service: route.service,
      };
      
      if (route.path) {
        rule.path = route.path;
      }
      
      if (route.originRequest) {
        rule.originRequest = route.originRequest;
      }
      
      return rule;
    });

    ingressRules.push({
      service: "http_status:404",
    });

    this.tunnelConfig = new cloudflare.ZeroTrustTunnelCloudflaredConfig(`${name}-config`, {
      accountId: args.cloudflareAccountId,
      tunnelId: this.tunnel.id,
      config: {
        ingresses: ingressRules,
      },
    }, { parent: this });

    this.tunnelCname = pulumi.interpolate`${this.tunnel.id}.cfargotunnel.com`;
    this.tunnelId = this.tunnel.id;

    this.dnsRecords = args.routes.map((route, index) => {
      const recordConfig = pulumi.all([
        route.hostname,
        pulumi.output(args.zoneIds),
      ]).apply(([hostname, zoneIds]) => {
        const parts = hostname.split(".");
        const domain = parts.slice(-2).join(".");
        const subdomain = parts.slice(0, -2).join(".");
        const recordName = subdomain || "@";

        const zoneId = zoneIds[domain];
        if (!zoneId) {
          throw new Error(`Zone ID not found for domain: ${domain}`);
        }

        return {
          zoneId,
          name: recordName,
        };
      });

      return new cloudflare.DnsRecord(`${name}-dns-${index}`, {
        zoneId: recordConfig.zoneId,
        name: recordConfig.name,
        type: "CNAME",
        content: this.tunnelCname,
        proxied: true,
        ttl: 1,
      }, { parent: this });
    });

    const tunnelToken = cloudflare.getZeroTrustTunnelCloudflaredTokenOutput({
      accountId: args.cloudflareAccountId,
      tunnelId: this.tunnel.id,
    });

    const containerArgs = pulumi.output(tunnelToken.token).apply(token => {
      const cmdArgs: string[] = [
        "tunnel",
        "--no-autoupdate",
      ];

      const enableMetrics = args.enableMetrics !== false;
      if (enableMetrics) {
        cmdArgs.push("--metrics", "0.0.0.0:2000");
      }

      cmdArgs.push("run", "--token", "$(TUNNEL_TOKEN)");

      return {
        name: "cloudflared",
        image: args.image || DOCKER_IMAGES.CLOUDFLARED.image,
        args: cmdArgs,
        env: [
          {
            name: "TUNNEL_TOKEN",
            value: token,
          },
        ],
        ...(enableMetrics && {
          livenessProbe: {
            httpGet: {
              path: "/ready",
              port: 2000,
            },
            failureThreshold: 1,
            initialDelaySeconds: 10,
            periodSeconds: 10,
          },
        }),
        resources: args.resources || {
          requests: {
            cpu: "50m",
            memory: "64Mi",
          },
          limits: {
            cpu: "200m",
            memory: "256Mi",
          },
        },
      };
    });

    const enableMetrics = args.enableMetrics !== false;
    const podAnnotations = enableMetrics ? {
      "k8s.grafana.com/scrape": "true",
      "k8s.grafana.com/job": "cloudflared",
      "k8s.grafana.com/metrics.path": "/metrics",
      "k8s.grafana.com/metrics.portNumber": "2000",
      "k8s.grafana.com/metrics.scheme": "http",
      "k8s.grafana.com/metrics.scrapeInterval": "60s",
    } : undefined;

    if (args.useDaemonSet) {
      this.daemonSet = new k8s.apps.v1.DaemonSet(`${name}-daemonset`, {
        metadata: {
          name: pulumi.interpolate`${args.tunnelName}-cloudflared`,
          namespace: args.namespace,
        },
        spec: {
          selector: {
            matchLabels: {
              app: "cloudflared",
            },
          },
          template: {
            metadata: {
              labels: {
                app: "cloudflared",
              },
              ...(podAnnotations && { annotations: podAnnotations }),
            },
            spec: {
              containers: [containerArgs],
            },
          },
        },
      }, { parent: this, dependsOn: [this.tunnelConfig] });
    } else {
      this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
        metadata: {
          name: pulumi.interpolate`${args.tunnelName}-cloudflared`,
          namespace: args.namespace,
        },
        spec: {
          replicas: args.replicas || 2,
          selector: {
            matchLabels: {
              app: "cloudflared",
            },
          },
          template: {
            metadata: {
              labels: {
                app: "cloudflared",
              },
              ...(podAnnotations && { annotations: podAnnotations }),
            },
            spec: {
              containers: [containerArgs],
            },
          },
        },
      }, { parent: this, dependsOn: [this.tunnelConfig] });
    }

    this.registerOutputs({
      tunnel: this.tunnel,
      tunnelConfig: this.tunnelConfig,
      dnsRecords: this.dnsRecords,
      deployment: this.deployment,
      daemonSet: this.daemonSet,
      tunnelCname: this.tunnelCname,
      tunnelId: this.tunnelId,
    });
  }
}
