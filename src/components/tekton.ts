import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

const TEKTON_VERSIONS = {
  pipelines: "v1.9.0",
  triggers: "v0.34.0",
  dashboard: "v0.64.0",
  pac: "v0.41.1",
} as const;

const TEKTON_RELEASE_BASE =
  "https://objectstorage.us-ashburn-1.oraclecloud.com/n/idvmneyfvsey/b/tekton-releases/o";
const PAC_RELEASE_BASE =
  "https://github.com/openshift-pipelines/pipelines-as-code/releases/download";

export interface IngressConfig {
  enabled: boolean;
  className?: string;
  host: string;
  annotations?: Record<string, string>;
  tls?: {
    enabled: boolean;
    secretName?: string;
  };
}

export interface TektonArgs {
  versions?: Partial<typeof TEKTON_VERSIONS>;
  dashboard?: {
    ingress?: IngressConfig;
    resources?: {
      requests?: { memory?: string; cpu?: string };
      limits?: { memory?: string; cpu?: string };
    };
  };
  pac?: {
    ingress?: IngressConfig;
    gitea?: {
      host: string;
      token: pulumi.Input<string>;
    };
  };
}

export class Tekton extends pulumi.ComponentResource {
  public readonly pipelinesNamespace: pulumi.Output<string>;
  public readonly pacNamespace: pulumi.Output<string>;
  public readonly dashboardUrl?: pulumi.Output<string>;
  public readonly pacWebhookUrl?: pulumi.Output<string>;
  public readonly pacWebhookSecret?: pulumi.Output<string>;

  constructor(
    name: string,
    args: TektonArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("homelab:components:Tekton", name, {}, opts);

    const versions = { ...TEKTON_VERSIONS, ...args.versions };

    const pipelines = new k8s.yaml.ConfigFile(
      `${name}-pipelines`,
      {
        file: `${TEKTON_RELEASE_BASE}/pipeline/previous/${versions.pipelines}/release.yaml`,
      },
      { parent: this }
    );

    const triggers = new k8s.yaml.ConfigFile(
      `${name}-triggers`,
      {
        file: `${TEKTON_RELEASE_BASE}/triggers/previous/${versions.triggers}/release.yaml`,
      },
      { parent: this, dependsOn: [pipelines] }
    );

    new k8s.yaml.ConfigFile(
      `${name}-triggers-interceptors`,
      {
        file: `${TEKTON_RELEASE_BASE}/triggers/previous/${versions.triggers}/interceptors.yaml`,
      },
      { parent: this, dependsOn: [triggers] }
    );

    const dashboard = new k8s.yaml.ConfigFile(
      `${name}-dashboard`,
      {
        file: `${TEKTON_RELEASE_BASE}/dashboard/previous/${versions.dashboard}/release.yaml`,
      },
      { parent: this, dependsOn: [pipelines] }
    );

    const pac = new k8s.yaml.ConfigFile(
      `${name}-pac`,
      {
        file: `${PAC_RELEASE_BASE}/${versions.pac}/release.k8s.yaml`,
      },
      { parent: this, dependsOn: [pipelines, triggers] }
    );

    this.pipelinesNamespace = pulumi.output("tekton-pipelines");
    this.pacNamespace = pulumi.output("pipelines-as-code");

    if (args.dashboard?.ingress?.enabled) {
      this.createIngress(
        `${name}-dashboard-ingress`,
        {
          namespace: "tekton-pipelines",
          serviceName: "tekton-dashboard",
          servicePort: 9097,
          ...args.dashboard.ingress,
        },
        { parent: this, dependsOn: [dashboard] }
      );
      this.dashboardUrl = pulumi.interpolate`https://${args.dashboard.ingress.host}`;
    }

    if (args.pac?.ingress?.enabled) {
      this.createIngress(
        `${name}-pac-ingress`,
        {
          namespace: "pipelines-as-code",
          serviceName: "pipelines-as-code-controller",
          servicePort: 8080,
          ...args.pac.ingress,
        },
        { parent: this, dependsOn: [pac] }
      );
      this.pacWebhookUrl = pulumi.interpolate`https://${args.pac.ingress.host}`;
    }

    if (args.pac?.gitea) {
      const webhookSecret = this.createPacGiteaConfig(
        name,
        args.pac.gitea,
        { parent: this, dependsOn: [pac] }
      );
      this.pacWebhookSecret = webhookSecret;
    }

    this.registerOutputs({
      pipelinesNamespace: this.pipelinesNamespace,
      pacNamespace: this.pacNamespace,
      dashboardUrl: this.dashboardUrl,
      pacWebhookUrl: this.pacWebhookUrl,
      pacWebhookSecret: this.pacWebhookSecret,
    });
  }

  private createIngress(
    name: string,
    config: {
      namespace: string;
      serviceName: string;
      servicePort: number;
      host: string;
      className?: string;
      annotations?: Record<string, string>;
      tls?: {
        enabled: boolean;
        secretName?: string;
      };
    },
    opts: pulumi.CustomResourceOptions
  ): k8s.networking.v1.Ingress {
    return new k8s.networking.v1.Ingress(
      name,
      {
        metadata: {
          name: name,
          namespace: config.namespace,
          annotations: config.annotations,
        },
        spec: {
          ingressClassName: config.className ?? "traefik",
          rules: [
            {
              host: config.host,
              http: {
                paths: [
                  {
                    path: "/",
                    pathType: "Prefix",
                    backend: {
                      service: {
                        name: config.serviceName,
                        port: { number: config.servicePort },
                      },
                    },
                  },
                ],
              },
            },
          ],
          tls: config.tls?.enabled
            ? [
                {
                  hosts: [config.host],
                  secretName: config.tls.secretName ?? `${name}-tls`,
                },
              ]
            : undefined,
        },
      },
      opts
    );
  }

  private createPacGiteaConfig(
    name: string,
    gitea: NonNullable<NonNullable<TektonArgs["pac"]>["gitea"]>,
    opts: pulumi.CustomResourceOptions
  ): pulumi.Output<string> {
    const webhookSecret = new random.RandomPassword(
      `${name}-pac-webhook-secret`,
      {
        length: 32,
        special: false,
      },
      { parent: this }
    );

    new k8s.core.v1.Secret(
      `${name}-gitea-token`,
      {
        metadata: {
          name: "gitea-pac-token",
          namespace: "pipelines-as-code",
        },
        stringData: {
          token: gitea.token,
        },
      },
      opts
    );

    new k8s.core.v1.Secret(
      `${name}-webhook-secret`,
      {
        metadata: {
          name: "gitea-pac-webhook",
          namespace: "pipelines-as-code",
        },
        stringData: {
          secret: webhookSecret.result,
        },
      },
      opts
    );

    new k8s.core.v1.ConfigMap(
      `${name}-pac-config`,
      {
        metadata: {
          name: "pipelines-as-code",
          namespace: "pipelines-as-code",
        },
        data: {
          "application-name": "Tekton CI",
        },
      },
      opts
    );

    new k8s.apiextensions.CustomResource(
      `${name}-pac-global-repo`,
      {
        apiVersion: "pipelinesascode.tekton.dev/v1alpha1",
        kind: "Repository",
        metadata: {
          name: "global-gitea",
          namespace: "pipelines-as-code",
        },
        spec: {
          url: `https://${gitea.host}`,
          git_provider: {
            type: "gitea",
            secret: {
              name: "gitea-pac-token",
              key: "token",
            },
            webhook_secret: {
              name: "gitea-pac-webhook",
              key: "secret",
            },
          },
        },
      },
      opts
    );

    return webhookSecret.result;
  }
}
